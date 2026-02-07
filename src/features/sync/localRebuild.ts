import { db } from "@/services/db"
import type { SyncCollection } from "@/features/sync/schemas"
import { withSyncHooksSuppressed } from "@/features/sync/dexieHooks"

export async function rebuildLocalOnlyFields(changedCollections: Set<SyncCollection>): Promise<void> {
  const shouldRebuildWorkouts = changedCollections.has("workouts")
  const shouldRebuildFoods = changedCollections.has("nutrition") || changedCollections.has("foods")

  if (!shouldRebuildWorkouts && !shouldRebuildFoods) return

  await withSyncHooksSuppressed(async () => {
    await db.transaction("rw", [db.nutritionLogs, db.foods], async () => {
      // Note: workout exerciseIds rebuild is intentionally omitted here.
      // The exerciseIds field is already correctly computed during upsert
      // in fromCloudRecord (projection.ts) when applying pulled changes.

      if (shouldRebuildFoods) {
        const logs = await db.nutritionLogs.toArray()
        const usageCounts = new Map<string, number>()
        for (const log of logs) {
          for (const entry of log.entries) {
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
