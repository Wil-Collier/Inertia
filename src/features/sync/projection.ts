import type { SyncCollection } from "@/features/sync/schemas"
import { isRecord } from "@/features/sync/typeGuards"

type CloudRecord = Record<string, unknown>

const TO_CLOUD_RECORD = {
  workouts: (record: CloudRecord) => {
    const { exerciseIds: _exerciseIds, ...rest } = record
    return rest
  },
  activeSession: (record: CloudRecord) => {
    const { id: _id, ...rest } = record
    return rest
  },
  templates: (record: CloudRecord) => record,
  foods: (record: CloudRecord) => {
    const { usageCount: _usageCount, ...rest } = record
    return rest
  },
  nutrition: (record: CloudRecord) => record,
  mealTemplates: (record: CloudRecord) => record,
  weight: (record: CloudRecord) => record,
  settings: (record: CloudRecord) => {
    const { id: _id, ...rest } = record
    return rest
  },
  exercises: (record: CloudRecord) => record,
} satisfies Record<SyncCollection, (record: CloudRecord) => CloudRecord>

const FROM_CLOUD_RECORD = {
  workouts: (data: CloudRecord) => {
    const exercises = Array.isArray(data.exercises) ? data.exercises : []
    const exerciseIds = exercises
      .map((exercise) =>
        isRecord(exercise) && typeof exercise.exerciseId === "string" ? exercise.exerciseId : null
      )
      .filter((value): value is string => typeof value === "string")

    return {
      ...data,
      exerciseIds,
    }
  },
  activeSession: (data: CloudRecord) => data,
  templates: (data: CloudRecord) => data,
  foods: (data: CloudRecord) => data,
  nutrition: (data: CloudRecord) => data,
  mealTemplates: (data: CloudRecord) => data,
  weight: (data: CloudRecord) => data,
  settings: (data: CloudRecord) => data,
  exercises: (data: CloudRecord) => data,
} satisfies Record<SyncCollection, (data: CloudRecord) => CloudRecord>

export function toCloudRecord(collection: SyncCollection, record: unknown): CloudRecord | null {
  if (!isRecord(record)) return null
  return TO_CLOUD_RECORD[collection](record)
}

export function fromCloudRecord(
  collection: SyncCollection,
  data: CloudRecord
): CloudRecord {
  return FROM_CLOUD_RECORD[collection](data)
}
