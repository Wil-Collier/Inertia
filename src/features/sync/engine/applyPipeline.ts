import { db } from "@/services/db"
import type {
  ActiveWorkoutSession,
  DailyNutrition,
  Exercise,
  FoodItem,
  MealTemplate,
  UserSettings,
  WeightEntry,
  Workout,
  WorkoutTemplate,
} from "@/lib/types"
import type { PullChange, SyncCollection } from "@/features/sync/schemas"
import { fromCloudRecord } from "@/features/sync/projection"
import { withSyncHooksSuppressed } from "@/features/sync/dexieHooks"
import { rebuildLocalOnlyFields } from "@/features/sync/localRebuild"
import { recalculateDerivedData } from "@/features/sync/derivedData"
import { invalidateQueriesForCollections } from "@/features/sync/queryInvalidation"
import { clearLocalDataOwnerUserId, setRecordVersion } from "@/features/sync/changeTracker"
import { runSequentially } from "../../../../shared/asyncUtils"
import { z } from "zod"

type LocalRecord =
  | Workout
  | ActiveWorkoutSession
  | WorkoutTemplate
  | FoodItem
  | DailyNutrition
  | MealTemplate
  | WeightEntry
  | UserSettings
  | Exercise

const SETTINGS_SINGLETON_ID = "settings"
const WeightUnitSchema = z.enum(["kg", "lbs"])
const WorkoutSetSchema = z.object({
  id: z.string(),
  reps: z.number(),
  weight: z.number(),
  isCompleted: z.boolean(),
})
const WorkoutExerciseSchema = z.object({
  id: z.string(),
  exerciseId: z.string(),
  sets: z.array(WorkoutSetSchema),
  notes: z.string().optional(),
  lastPerformanceDate: z.string().optional(),
})
const WorkoutSchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  exercises: z.array(WorkoutExerciseSchema),
  exerciseIds: z.array(z.string()).optional(),
  duration: z.number().optional(),
  completedAt: z.string().optional(),
  weightUnit: WeightUnitSchema,
  updatedAt: z.number().optional(),
})
const ActiveWorkoutSessionSchema = z.object({
  workout: WorkoutSchema,
  startedAt: z.string(),
  templateId: z.string().optional(),
  updatedAt: z.number().optional(),
})
const WorkoutTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  exercises: z.array(
    z.object({
      exerciseId: z.string(),
      targetSets: z.number(),
      targetReps: z.number().optional(),
      targetWeight: z.number().optional(),
    })
  ),
  updatedAt: z.number().optional(),
})
const FoodItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  brand: z.string().optional(),
  calories: z.number(),
  protein: z.number(),
  carbs: z.number(),
  fat: z.number(),
  fiber: z.number(),
  sugar: z.number(),
  servingSize: z.string(),
  servingGrams: z.number().optional(),
  barcode: z.string().optional(),
  isCustom: z.boolean(),
  isFavorite: z.boolean().optional(),
  usageCount: z.number().optional(),
  updatedAt: z.number().optional(),
})
const MealEntrySchema = z.object({
  id: z.string(),
  foodId: z.string(),
  quantity: z.number(),
  mealType: z.enum(["breakfast", "lunch", "dinner", "snack"]),
  templateId: z.string().optional(),
  templateInstanceId: z.string().optional(),
  templateName: z.string().optional(),
})
const DailyNutritionSchema = z.object({
  date: z.string(),
  entries: z.array(MealEntrySchema),
  updatedAt: z.number().optional(),
})
const MealTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  entries: z.array(MealEntrySchema.omit({ id: true })),
  updatedAt: z.number().optional(),
})
const WeightEntrySchema = z.object({
  id: z.string(),
  date: z.string(),
  weight: z.number(),
  note: z.string().optional(),
  updatedAt: z.number().optional(),
})
const UserSettingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  nutritionGoals: z.object({
    calories: z.number(),
    protein: z.number(),
    carbs: z.number(),
    fat: z.number(),
    fiber: z.number(),
    sugar: z.number(),
  }),
  restTimerDuration: z.number(),
  unitPreferences: z.object({
    weight: WeightUnitSchema,
    distance: z.enum(["mi", "km"]),
  }),
  areNotificationsEnabled: z.boolean(),
  updatedAt: z.number().optional(),
})
const ExerciseSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscleGroup: z.enum(["chest", "back", "shoulders", "arms", "legs", "core", "cardio"]),
  isCustom: z.boolean(),
  isWeighted: z.boolean(),
  isTimeBased: z.boolean(),
  description: z.string().optional(),
  createdAt: z.string().optional(),
  updatedAt: z.number().optional(),
})

function parseCloudRecord(collection: SyncCollection, data: unknown): LocalRecord | null {
  switch (collection) {
    case "workouts": {
      const parsed = WorkoutSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    case "activeSession": {
      const parsed = ActiveWorkoutSessionSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    case "templates": {
      const parsed = WorkoutTemplateSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    case "foods": {
      const parsed = FoodItemSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    case "nutrition": {
      const parsed = DailyNutritionSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    case "mealTemplates": {
      const parsed = MealTemplateSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    case "weight": {
      const parsed = WeightEntrySchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    case "settings": {
      const parsed = UserSettingsSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    case "exercises": {
      const parsed = ExerciseSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    }
    default:
      return null
  }
}

export async function applyPulledChanges(changes: PullChange[]): Promise<Set<SyncCollection>> {
  const affectedCollections = new Set<SyncCollection>()
  changes.forEach((change) => affectedCollections.add(change.collection))

  if (changes.length === 0) {
    return affectedCollections
  }

  await withSyncHooksSuppressed(async () => {
    await db.transaction(
      "rw",
      [
        db.workoutSessions,
        db.activeSession,
        db.workoutTemplates,
        db.foods,
        db.nutritionLogs,
        db.mealTemplates,
        db.bodyWeight,
        db.settings,
        db.customExercises,
        db.syncRecordVersions,
      ],
      async (transaction) => {
        await runSequentially(changes, async (change) => {
          const localId = resolveLocalId(change.collection, change.id)

          if (change.deleted) {
            await deleteLocalRecord(change.collection, localId)
            await setRecordVersion(change.collection, localId, change.version, transaction)
            return
          }

          if (!change.data) {
            // This shouldn't happen - non-deleted changes should always have data
            console.warn(`[Sync] Skipping non-deleted change with null data: ${change.collection}/${change.id}`)
            return
          }
          const local = fromCloudRecord(change.collection, change.data)
          const parsedLocal = parseCloudRecord(change.collection, local)

          const applied = await upsertLocalRecord(change.collection, localId, parsedLocal)
          if (!applied) {
            // Warn and skip invalid records instead of throwing — throwing would abort
            // the entire transaction, rolling back the cursor, and causing an infinite
            // retry loop since the same invalid record would be pulled again.
            console.warn(`[Sync] Skipping invalid pulled record for ${change.collection}:${change.id}`)
          }

          await setRecordVersion(change.collection, localId, change.version, transaction)
        })
      }
    )
  })

  await rebuildLocalOnlyFields(affectedCollections)
  await recalculateDerivedData(affectedCollections)
  invalidateQueriesForCollections(affectedCollections)

  return affectedCollections
}

export async function getLocalRecord(collection: SyncCollection, id: string): Promise<LocalRecord | null> {
  switch (collection) {
    case "workouts":
      return (await db.workoutSessions.get(id)) ?? null
    case "activeSession":
      return (await db.activeSession.get(id)) ?? null
    case "templates":
      return (await db.workoutTemplates.get(id)) ?? null
    case "foods":
      return (await db.foods.get(id)) ?? null
    case "nutrition":
      return (await db.nutritionLogs.get(id)) ?? null
    case "mealTemplates":
      return (await db.mealTemplates.get(id)) ?? null
    case "weight":
      return (await db.bodyWeight.get(id)) ?? null
    case "settings":
      return (await db.settings.get("settings")) ?? null
    case "exercises":
      return (await db.customExercises.get(id)) ?? null
    default:
      return null
  }
}

export async function clearLocalSyncData(): Promise<void> {
  await withSyncHooksSuppressed(async () => {
    await db.transaction(
      "rw",
      [
        db.workoutSessions,
        db.activeSession,
        db.workoutTemplates,
        db.personalRecords,
        db.foods,
        db.nutritionLogs,
        db.mealTemplates,
        db.bodyWeight,
        db.settings,
        db.achievements,
        db.userStats,
        db.customExercises,
        db.syncRecordVersions,
      ],
      async () => {
        await db.workoutSessions.clear()
        await db.activeSession.clear()
        await db.workoutTemplates.clear()
        await db.personalRecords.clear()
        await db.foods.clear()
        await db.nutritionLogs.clear()
        await db.mealTemplates.clear()
        await db.bodyWeight.clear()
        await db.customExercises.clear()
        await db.settings.delete("settings")
        await db.achievements.clear()
        await db.userStats.clear()
        await db.syncRecordVersions.clear()
      }
    )
  })
  await clearLocalDataOwnerUserId()
}

async function upsertLocalRecord(collection: SyncCollection, id: string, record: unknown): Promise<boolean> {
  switch (collection) {
    case "workouts":
      if (!isWorkout(record)) return false
      await db.workoutSessions.put(record)
      return true
    case "activeSession":
      if (!isActiveWorkoutSession(record)) return false
      await db.activeSession.put({ id, ...record })
      return true
    case "templates":
      if (!isWorkoutTemplate(record)) return false
      await db.workoutTemplates.put(record)
      return true
    case "foods":
      if (!isFoodItem(record)) return false
      await db.foods.put(record)
      return true
    case "nutrition":
      if (!isDailyNutrition(record)) return false
      await db.nutritionLogs.put(record)
      return true
    case "mealTemplates":
      if (!isMealTemplate(record)) return false
      await db.mealTemplates.put(record)
      return true
    case "weight":
      if (!isWeightEntry(record)) return false
      await db.bodyWeight.put(record)
      return true
    case "settings":
      if (!isUserSettings(record)) return false
      await db.settings.put({ id, ...record })
      return true
    case "exercises":
      if (!isExercise(record)) return false
      await db.customExercises.put(record)
      return true
    default:
      return false
  }
}

async function deleteLocalRecord(collection: SyncCollection, id: string): Promise<void> {
  switch (collection) {
    case "workouts":
      await db.workoutSessions.delete(id)
      return
    case "activeSession":
      await db.activeSession.delete(id)
      return
    case "templates":
      await db.workoutTemplates.delete(id)
      return
    case "foods":
      await db.foods.delete(id)
      return
    case "nutrition":
      await db.nutritionLogs.delete(id)
      return
    case "mealTemplates":
      await db.mealTemplates.delete(id)
      return
    case "weight":
      await db.bodyWeight.delete(id)
      return
    case "settings":
      await db.settings.delete(id)
      return
    case "exercises":
      await db.customExercises.delete(id)
      return
    default:
      return
  }
}

function resolveLocalId(collection: SyncCollection, incomingId: string): string {
  if (collection === "settings") return SETTINGS_SINGLETON_ID
  return incomingId
}

function isWorkout(record: unknown): record is Workout {
  return WorkoutSchema.safeParse(record).success
}

function isWorkoutTemplate(record: unknown): record is WorkoutTemplate {
  return WorkoutTemplateSchema.safeParse(record).success
}

function isActiveWorkoutSession(record: unknown): record is ActiveWorkoutSession {
  return ActiveWorkoutSessionSchema.safeParse(record).success
}

function isFoodItem(record: unknown): record is FoodItem {
  return FoodItemSchema.safeParse(record).success
}

function isDailyNutrition(record: unknown): record is DailyNutrition {
  return DailyNutritionSchema.safeParse(record).success
}

function isMealTemplate(record: unknown): record is MealTemplate {
  return MealTemplateSchema.safeParse(record).success
}

function isWeightEntry(record: unknown): record is WeightEntry {
  return WeightEntrySchema.safeParse(record).success
}

function isUserSettings(record: unknown): record is UserSettings {
  return UserSettingsSchema.safeParse(record).success
}

function isExercise(record: unknown): record is Exercise {
  return ExerciseSchema.safeParse(record).success
}
