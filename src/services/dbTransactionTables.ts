import { db } from "@/services/db"

export const SYNC_TRACKING_TABLES = [db.syncPendingChanges, db.syncRecordVersions] as const

export const ACTIVE_SESSION_SYNC_WRITE_TABLES = [db.activeSession, ...SYNC_TRACKING_TABLES] as const

export const WORKOUT_SESSION_WRITE_TABLES = [db.workoutSessions] as const

export const WORKOUT_TEMPLATE_WRITE_TABLES = [db.workoutTemplates] as const

export const FOODS_SYNC_WRITE_TABLES = [db.foods, ...SYNC_TRACKING_TABLES] as const

export const NUTRITION_LOG_AND_FOODS_SYNC_WRITE_TABLES = [
  db.nutritionLogs,
  db.foods,
  ...SYNC_TRACKING_TABLES,
] as const

export const MEAL_TEMPLATES_SYNC_WRITE_TABLES = [db.mealTemplates, ...SYNC_TRACKING_TABLES] as const

export const SETTINGS_SYNC_WRITE_TABLES = [db.settings, ...SYNC_TRACKING_TABLES] as const

export const CUSTOM_EXERCISES_SYNC_WRITE_TABLES = [db.customExercises, ...SYNC_TRACKING_TABLES] as const

export const BODY_WEIGHT_SYNC_WRITE_TABLES = [db.bodyWeight, ...SYNC_TRACKING_TABLES] as const

export const WORKOUT_HISTORY_DERIVED_DATA_TABLES = [
  db.workoutSessions,
  db.userStats,
  db.achievements,
  db.workoutTemplates,
  db.personalRecords,
  db.customExercises,
  db.nutritionLogs,
] as const

export const WORKOUT_SESSION_SYNC_WRITE_TABLES = [...WORKOUT_SESSION_WRITE_TABLES, ...SYNC_TRACKING_TABLES] as const

export const WORKOUT_TEMPLATE_SYNC_WRITE_TABLES = [...WORKOUT_TEMPLATE_WRITE_TABLES, ...SYNC_TRACKING_TABLES] as const

export const WORKOUT_HISTORY_SYNC_WRITE_TABLES = [
  ...WORKOUT_HISTORY_DERIVED_DATA_TABLES,
  ...SYNC_TRACKING_TABLES,
] as const
