import { db } from "@/services/db"
import type {
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
import { removeRecordVersion, setRecordVersion } from "@/features/sync/changeTracker"

type LocalRecord =
  | Workout
  | WorkoutTemplate
  | FoodItem
  | DailyNutrition
  | MealTemplate
  | WeightEntry
  | (UserSettings & { id: string })
  | Exercise

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
          if (change.deleted) {
            await deleteLocalRecord(change.collection, change.id)
            await removeRecordVersion(change.collection, change.id, transaction)
            return
          }

          if (!change.data) return
          const local = fromCloudRecord(change.collection, change.data)
          if (isRecord(local)) {
            local.updatedAt = Date.now()
          }

          await upsertLocalRecord(change.collection, change.id, local)
          await setRecordVersion(change.collection, change.id, change.version, transaction)
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
        db.workoutTemplates,
        db.foods,
        db.nutritionLogs,
        db.mealTemplates,
        db.bodyWeight,
        db.settings,
        db.customExercises,
        db.syncRecordVersions,
      ],
      async () => {
        await db.workoutSessions.clear()
        await db.workoutTemplates.clear()
        await db.foods.clear()
        await db.nutritionLogs.clear()
        await db.mealTemplates.clear()
        await db.bodyWeight.clear()
        await db.customExercises.clear()
        await db.settings.delete("settings")
        await db.syncRecordVersions.clear()
      }
    )
  })
}

async function upsertLocalRecord(collection: SyncCollection, id: string, record: unknown): Promise<void> {
  switch (collection) {
    case "workouts":
      if (!isWorkout(record)) return
      await db.workoutSessions.put(record)
      return
    case "templates":
      if (!isWorkoutTemplate(record)) return
      await db.workoutTemplates.put(record)
      return
    case "foods":
      if (!isFoodItem(record)) return
      await db.foods.put(record)
      return
    case "nutrition":
      if (!isDailyNutrition(record)) return
      await db.nutritionLogs.put(record)
      return
    case "mealTemplates":
      if (!isMealTemplate(record)) return
      await db.mealTemplates.put(record)
      return
    case "weight":
      if (!isWeightEntry(record)) return
      await db.bodyWeight.put(record)
      return
    case "settings":
      if (!isUserSettings(record)) return
      await db.settings.put({ id, ...record })
      return
    case "exercises":
      if (!isExercise(record)) return
      await db.customExercises.put(record)
      return
    default:
      return
  }
}

async function deleteLocalRecord(collection: SyncCollection, id: string): Promise<void> {
  switch (collection) {
    case "workouts":
      await db.workoutSessions.delete(id)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function runSequentially<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  await items.reduce((promise, item) => promise.then(() => task(item)), Promise.resolve())
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string"
}

function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "number"
}

function hasBoolean(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "boolean"
}

function isWorkout(record: unknown): record is Workout {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "date") || !hasString(record, "name")) return false
  if (!Array.isArray(record.exercises)) return false
  return record.weightUnit === "kg" || record.weightUnit === "lbs"
}

function isWorkoutTemplate(record: unknown): record is WorkoutTemplate {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "name")) return false
  return Array.isArray(record.exercises)
}

function isFoodItem(record: unknown): record is FoodItem {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "name")) return false
  if (!hasNumber(record, "calories")) return false
  return hasBoolean(record, "isCustom")
}

function isDailyNutrition(record: unknown): record is DailyNutrition {
  if (!isRecord(record)) return false
  if (!hasString(record, "date")) return false
  return Array.isArray(record.entries)
}

function isMealTemplate(record: unknown): record is MealTemplate {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "name")) return false
  return Array.isArray(record.entries)
}

function isWeightEntry(record: unknown): record is WeightEntry {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "date")) return false
  return hasNumber(record, "weight")
}

function isUserSettings(record: unknown): record is UserSettings {
  if (!isRecord(record)) return false
  if (!hasString(record, "theme")) return false
  if (!hasNumber(record, "restTimerDuration")) return false
  return isRecord(record.unitPreferences) && isRecord(record.nutritionGoals) && hasBoolean(record, "areNotificationsEnabled")
}

function isExercise(record: unknown): record is Exercise {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "name")) return false
  if (!hasBoolean(record, "isCustom") || !hasBoolean(record, "isWeighted") || !hasBoolean(record, "isTimeBased")) return false
  return hasString(record, "muscleGroup")
}
