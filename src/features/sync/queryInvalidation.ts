import { queryClient } from "@/lib/queryClient"
import { queryKeys } from "@/lib/queryKeys"
import type { SyncCollection } from "@/features/sync/schemas"

const COLLECTION_INVALIDATIONS: Record<SyncCollection, readonly unknown[]> = {
  workouts: queryKeys.workouts.all,
  templates: queryKeys.templates.all,
  foods: queryKeys.foods.all,
  nutrition: queryKeys.nutrition.all,
  mealTemplates: queryKeys.foods.all,
  weight: queryKeys.bodyWeight.all,
  settings: queryKeys.settings.all,
  exercises: queryKeys.exercises.all,
}

export function invalidateQueriesForCollections(collections: Set<SyncCollection>): void {
  collections.forEach((collection) => {
    const queryKey = COLLECTION_INVALIDATIONS[collection]
    void queryClient.invalidateQueries({ queryKey })
  })

  if (
    collections.has("workouts") ||
    collections.has("nutrition") ||
    collections.has("templates") ||
    collections.has("exercises")
  ) {
    void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })
  }
}
