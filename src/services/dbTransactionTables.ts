import { db } from "@/services/db"

export const SYNC_TRACKING_TABLES = [db.syncPendingChanges, db.syncRecordVersions] as const

export const ACTIVE_SESSION_SYNC_WRITE_TABLES = [db.activeSession, ...SYNC_TRACKING_TABLES] as const

export const WORKOUT_HISTORY_SYNC_WRITE_TABLES = [
  db.workoutSessions,
  db.userStats,
  db.achievements,
  db.workoutTemplates,
  db.personalRecords,
  db.customExercises,
  db.nutritionLogs,
  db.settings,
  ...SYNC_TRACKING_TABLES,
] as const

