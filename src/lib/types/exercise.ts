export type MuscleGroup =
  | "chest"
  | "back"
  | "shoulders"
  | "arms"
  | "legs"
  | "core"
  | "cardio"

import type { SyncableWithId } from "./syncable"

export interface Exercise extends SyncableWithId {
  name: string
  muscleGroup: MuscleGroup
  isCustom: boolean
  isWeighted: boolean
  isTimeBased: boolean
  createdAt?: string
  description?: string
}
