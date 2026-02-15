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
import type { SyncCollection } from "@/features/sync/schemas"

export type LocalRecord =
  | Workout
  | ActiveWorkoutSession
  | WorkoutTemplate
  | FoodItem
  | DailyNutrition
  | MealTemplate
  | WeightEntry
  | UserSettings
  | Exercise

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
