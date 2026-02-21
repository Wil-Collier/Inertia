import { db } from "@/services/db"
import type { SyncCollection } from "@/features/sync/model/schemas"
import {
  ActiveWorkoutSessionRecordSchema,
  DailyNutritionRecordSchema,
  ExerciseRecordSchema,
  FoodItemRecordSchema,
  MealTemplateRecordSchema,
  UserSettingsRecordSchema,
  WeightEntryRecordSchema,
  WorkoutRecordSchema,
  WorkoutTemplateRecordSchema,
} from "../../../../shared/syncSchemas"

const SETTINGS_SINGLETON_ID = "settings"

export type SyncCollectionRecord = {
  workouts: ReturnType<typeof WorkoutRecordSchema.parse>
  activeSession: ReturnType<typeof ActiveWorkoutSessionRecordSchema.parse>
  templates: ReturnType<typeof WorkoutTemplateRecordSchema.parse>
  foods: ReturnType<typeof FoodItemRecordSchema.parse>
  nutrition: ReturnType<typeof DailyNutritionRecordSchema.parse>
  mealTemplates: ReturnType<typeof MealTemplateRecordSchema.parse>
  weight: ReturnType<typeof WeightEntryRecordSchema.parse>
  settings: ReturnType<typeof UserSettingsRecordSchema.parse>
  exercises: ReturnType<typeof ExerciseRecordSchema.parse>
}

type RegistryEntry<TCollection extends SyncCollection> = {
  parse: (data: unknown) => SyncCollectionRecord[TCollection] | null
  get: (id: string) => Promise<SyncCollectionRecord[TCollection] | null>
  put: (id: string, record: SyncCollectionRecord[TCollection]) => Promise<void>
  del: (id: string) => Promise<void>
  resolveLocalId?: (incomingId: string) => string
}

export const COLLECTION_REGISTRY: {
  [K in SyncCollection]: RegistryEntry<K>
} = {
  workouts: {
    parse: (data) => {
      const parsed = WorkoutRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async (id) => (await db.workoutSessions.get(id)) ?? null,
    put: async (_id, record) => {
      await db.workoutSessions.put(record)
    },
    del: async (id) => {
      await db.workoutSessions.delete(id)
    },
  },
  activeSession: {
    parse: (data) => {
      const parsed = ActiveWorkoutSessionRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async (id) => (await db.activeSession.get(id)) ?? null,
    put: async (id, record) => {
      await db.activeSession.put({ id, ...record })
    },
    del: async (id) => {
      await db.activeSession.delete(id)
    },
  },
  templates: {
    parse: (data) => {
      const parsed = WorkoutTemplateRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async (id) => (await db.workoutTemplates.get(id)) ?? null,
    put: async (_id, record) => {
      await db.workoutTemplates.put(record)
    },
    del: async (id) => {
      await db.workoutTemplates.delete(id)
    },
  },
  foods: {
    parse: (data) => {
      const parsed = FoodItemRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async (id) => (await db.foods.get(id)) ?? null,
    put: async (_id, record) => {
      await db.foods.put(record)
    },
    del: async (id) => {
      await db.foods.delete(id)
    },
  },
  nutrition: {
    parse: (data) => {
      const parsed = DailyNutritionRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async (id) => (await db.nutritionLogs.get(id)) ?? null,
    put: async (_id, record) => {
      await db.nutritionLogs.put(record)
    },
    del: async (id) => {
      await db.nutritionLogs.delete(id)
    },
  },
  mealTemplates: {
    parse: (data) => {
      const parsed = MealTemplateRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async (id) => (await db.mealTemplates.get(id)) ?? null,
    put: async (_id, record) => {
      await db.mealTemplates.put(record)
    },
    del: async (id) => {
      await db.mealTemplates.delete(id)
    },
  },
  weight: {
    parse: (data) => {
      const parsed = WeightEntryRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async (id) => (await db.bodyWeight.get(id)) ?? null,
    put: async (_id, record) => {
      await db.bodyWeight.put(record)
    },
    del: async (id) => {
      await db.bodyWeight.delete(id)
    },
  },
  settings: {
    parse: (data) => {
      const parsed = UserSettingsRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async () => (await db.settings.get(SETTINGS_SINGLETON_ID)) ?? null,
    put: async (_id, record) => {
      await db.settings.put({ id: SETTINGS_SINGLETON_ID, ...record })
    },
    del: async (_id) => {
      await db.settings.delete(SETTINGS_SINGLETON_ID)
    },
    resolveLocalId: () => SETTINGS_SINGLETON_ID,
  },
  exercises: {
    parse: (data) => {
      const parsed = ExerciseRecordSchema.safeParse(data)
      return parsed.success ? parsed.data : null
    },
    get: async (id) => (await db.customExercises.get(id)) ?? null,
    put: async (_id, record) => {
      await db.customExercises.put(record)
    },
    del: async (id) => {
      await db.customExercises.delete(id)
    },
  },
}

export function resolveCollectionLocalId(collection: SyncCollection, incomingId: string): string {
  const resolver = COLLECTION_REGISTRY[collection].resolveLocalId
  return resolver ? resolver(incomingId) : incomingId
}

export type SyncLocalRecord = SyncCollectionRecord[SyncCollection]
