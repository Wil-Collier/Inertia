import { db } from "@/services/db"

export const SYNC_COLLECTION_TABLES = [
  db.workoutSessions,
  db.activeSession,
  db.workoutTemplates,
  db.foods,
  db.nutritionLogs,
  db.mealTemplates,
  db.bodyWeight,
  db.settings,
  db.customExercises,
] as const

export const SYNC_COLLECTION_TABLES_WITH_VERSIONS = [
  ...SYNC_COLLECTION_TABLES,
  db.syncRecordVersions,
] as const

export const CLEAR_LOCAL_SYNC_TABLES = [
  ...SYNC_COLLECTION_TABLES_WITH_VERSIONS,
  db.personalRecords,
  db.achievements,
  db.userStats,
] as const

export async function hasAnyLocalSyncData(): Promise<boolean> {
  const [
    workouts,
    activeSession,
    templates,
    foods,
    nutrition,
    mealTemplates,
    bodyWeight,
    exercises,
    settings,
    pendingChanges,
  ] = await Promise.all([
    db.workoutSessions.count(),
    db.activeSession.count(),
    db.workoutTemplates.count(),
    db.foods.count(),
    db.nutritionLogs.count(),
    db.mealTemplates.count(),
    db.bodyWeight.count(),
    db.customExercises.count(),
    db.settings.get("settings"),
    db.syncPendingChanges.count(),
  ])

  return (
    workouts + activeSession + templates + foods + nutrition + mealTemplates + bodyWeight + exercises + pendingChanges > 0 ||
    !!settings
  )
}
