import type { SyncCollection } from "../../../shared/syncSchemas"

export const TABLE_TO_COLLECTION = {
  workoutSessions: "workouts",
  workoutTemplates: "templates",
  foods: "foods",
  nutritionLogs: "nutrition",
  mealTemplates: "mealTemplates",
  bodyWeight: "weight",
  settings: "settings",
  customExercises: "exercises",
} as const

export const COLLECTION_TO_TABLE = {
  workouts: "workoutSessions",
  templates: "workoutTemplates",
  foods: "foods",
  nutrition: "nutritionLogs",
  mealTemplates: "mealTemplates",
  weight: "bodyWeight",
  settings: "settings",
  exercises: "customExercises",
} as const

export type SyncableTableName = keyof typeof TABLE_TO_COLLECTION

export interface PendingChange {
  collection: SyncCollection
  id: string
  deleted: boolean
  baseVersion: number
  mutationId: string
  enqueuedAt: number
}

export interface PendingChangeKey {
  collection: SyncCollection
  id: string
}

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline"

export type InitialSyncStrategy = "merge" | "use-cloud" | "use-local"

export interface InitialSyncState {
  localHasData: boolean
  cloudHasData: boolean
}
