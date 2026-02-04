export interface Syncable {
  /**
   * Unix timestamp (ms).
   * Optional for legacy local data; sync requires this to be present.
   */
  updatedAt?: number
}

export interface SyncableWithId extends Syncable {
  id: string
}
