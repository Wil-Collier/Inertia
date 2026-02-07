import { db } from "@/services/db"

const TABLE_CLEARERS: Array<() => Promise<void>> = [
  () => db.customExercises.clear(),
  () => db.workoutSessions.clear(),
  () => db.workoutTemplates.clear(),
  () => db.personalRecords.clear(),
  () => db.foods.clear(),
  () => db.nutritionLogs.clear(),
  () => db.mealTemplates.clear(),
  () => db.settings.clear(),
  () => db.bodyWeight.clear(),
  () => db.achievements.clear(),
  () => db.restTimer.clear(),
  () => db.activeSession.clear(),
  () => db.metadata.clear(),
  () => db.userStats.clear(),
  () => db.syncPendingChanges.clear(),
  () => db.syncRecordVersions.clear(),
]

export async function clearDatabase(): Promise<void> {
  await db.transaction(
    "rw",
    [
      db.customExercises,
      db.workoutSessions,
      db.workoutTemplates,
      db.personalRecords,
      db.foods,
      db.nutritionLogs,
      db.mealTemplates,
      db.settings,
      db.bodyWeight,
      db.achievements,
      db.restTimer,
      db.activeSession,
      db.metadata,
      db.userStats,
      db.syncPendingChanges,
      db.syncRecordVersions,
    ],
    async () => {
      for (const clear of TABLE_CLEARERS) {
        // eslint-disable-next-line no-await-in-loop
        await clear()
      }
    }
  )

  localStorage.clear()
}

export async function flushAsyncTasks(): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}
