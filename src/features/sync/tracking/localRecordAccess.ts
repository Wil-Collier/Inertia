import type { SyncCollection } from "@/features/sync/model/schemas"
import { COLLECTION_REGISTRY, resolveCollectionLocalId, type SyncLocalRecord } from "@/features/sync/tracking/collectionRegistry"

export type LocalRecord = SyncLocalRecord

export async function getLocalRecord(collection: SyncCollection, id: string): Promise<LocalRecord | null> {
  const localId = resolveCollectionLocalId(collection, id)
  return await COLLECTION_REGISTRY[collection].get(localId)
}
