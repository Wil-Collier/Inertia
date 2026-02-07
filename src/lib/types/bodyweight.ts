import type { SyncableWithId } from "./syncable"

export interface WeightEntry extends SyncableWithId {
  date: string
  weight: number
  note?: string
}
