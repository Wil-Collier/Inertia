import { db } from "@/services/db"
import type { SyncCollection } from "@/features/sync/model/schemas"
import { withSyncHooksSuppressed } from "@/features/sync/tracking/dexieHooks"
import { jsonDeepEqual } from "@/features/sync/model/jsonUtils"
import { getActiveEntries } from "@/lib/nutritionEntryUtils"

export async function rebuildLocalOnlyFields(changedCollections: Set<SyncCollection>): Promise<void> {
  const shouldRebuildWorkouts = changedCollections.has("workouts")
  const shouldRebuildFoods = changedCollections.has("nutrition") || changedCollections.has("foods")

  if (!shouldRebuildWorkouts && !shouldRebuildFoods) return

  await withSyncHooksSuppressed(async () => {
    await db.transaction("rw", [db.workoutSessions, db.nutritionLogs, db.foods], async () => {
      if (shouldRebuildWorkouts) {
        const workouts = await db.workoutSessions.toArray()
        await Promise.all(
          workouts.map(async (workout) => {
            const exerciseIds = workout.exercises.map((exercise) => exercise.exerciseId)
            if (jsonDeepEqual(workout.exerciseIds ?? [], exerciseIds)) return
            await db.workoutSessions.update(workout.id, { exerciseIds })
          })
        )
      }

      if (shouldRebuildFoods) {
        const logs = await db.nutritionLogs.toArray()
        const usageCounts = new Map<string, number>()
        for (const log of logs) {
          for (const entry of getActiveEntries(log.entries)) {
            usageCounts.set(entry.foodId, (usageCounts.get(entry.foodId) ?? 0) + 1)
          }
        }

        const foods = await db.foods.toArray()
        await Promise.all(
          foods.map((food) => db.foods.update(food.id, { usageCount: usageCounts.get(food.id) ?? 0 }))
        )
      }
    })
  })
}
