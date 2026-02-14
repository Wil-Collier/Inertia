import type { SyncCollection } from "@/features/sync/schemas"
import { isRecord } from "@/features/sync/typeGuards"

type CloudRecord = Record<string, unknown>

export function toCloudRecord(collection: SyncCollection, record: unknown): CloudRecord | null {
  if (!isRecord(record)) return null

  switch (collection) {
    case "workouts": {
      const { exerciseIds: _exerciseIds, ...rest } = record
      return rest
    }
    case "activeSession": {
      const { id: _id, ...rest } = record
      return rest
    }
    case "templates":
      return record
    case "foods": {
      const { usageCount: _usageCount, ...rest } = record
      return rest
    }
    case "nutrition":
      return record
    case "mealTemplates":
      return record
    case "weight":
      return record
    case "settings":
      if (isRecord(record)) {
        const { id: _id, ...rest } = record
        return rest
      }
      return record
    case "exercises":
      return record
    default:
      return null
  }
}

export function fromCloudRecord(
  collection: SyncCollection,
  data: CloudRecord
): CloudRecord {
  switch (collection) {
    case "workouts": {
      const workout = data
      const exercises = Array.isArray(workout.exercises) ? workout.exercises : []
      const exerciseIds = exercises
        .map((exercise) =>
          isRecord(exercise) && typeof exercise.exerciseId === "string" ? exercise.exerciseId : null
        )
        .filter((value): value is string => typeof value === "string")
      return {
        ...workout,
        exerciseIds,
      }
    }
    case "activeSession":
      return data
    case "templates":
      return data
    case "foods":
      return data
    case "nutrition":
      return data
    case "mealTemplates":
      return data
    case "weight":
      return data
    case "settings":
      return data
    case "exercises":
      return data
    default:
      return data
  }
}
