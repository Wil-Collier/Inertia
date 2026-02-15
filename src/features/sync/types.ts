import type { SyncCollection } from "../../../shared/syncSchemas"

export const TABLE_TO_COLLECTION = {
  workoutSessions: "workouts",
  activeSession: "activeSession",
  workoutTemplates: "templates",
  foods: "foods",
  nutritionLogs: "nutrition",
  mealTemplates: "mealTemplates",
  bodyWeight: "weight",
  settings: "settings",
  customExercises: "exercises",
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

export type SyncStatus = "idle" | "syncing" | "success" | "error" | "offline"

export type InitialSyncStrategy = "merge" | "use-cloud" | "use-local"

export interface InitialSyncState {
  localHasData: boolean
  cloudHasData: boolean
}

export interface SyncAutoMergeSummary {
  resolvedAtMs: number
  pushed: number
  localWins: number
  remoteWins: number
  mergedRecords: number
  skippedEqual: number
}
