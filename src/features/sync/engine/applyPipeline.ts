import { db } from "@/services/db"
import type { PullChange, SyncCollection } from "@/features/sync/model/schemas"
import { fromCloudRecord } from "@/features/sync/tracking/projection"
import { withSyncHooksSuppressed } from "@/features/sync/tracking/dexieHooks"
import { rebuildLocalOnlyFields } from "@/features/sync/recovery/localRebuild"
import { recalculateDerivedData } from "@/features/sync/recovery/derivedData"
import { invalidateQueriesForCollections } from "@/features/sync/runtime/queryInvalidation"
import { clearLocalDataOwnerUserId } from "@/features/sync/tracking/changeTracker"
import { COLLECTION_REGISTRY, resolveCollectionLocalId } from "@/features/sync/tracking/collectionRegistry"
import { CLEAR_LOCAL_SYNC_TABLES, SYNC_COLLECTION_TABLES_WITH_VERSIONS } from "@/features/sync/engine/syncTables"
import { runSequentially } from "../../../../shared/asyncUtils"

export async function applyPulledChanges(changes: PullChange[]): Promise<Set<SyncCollection>> {
  const affectedCollections = await applyPulledChangesChunk(changes)
  await finalizeAppliedPullChanges(affectedCollections)
  return affectedCollections
}

export async function applyPulledChangesChunk(changes: PullChange[]): Promise<Set<SyncCollection>> {
  const affectedCollections = new Set<SyncCollection>()
  changes.forEach((change) => affectedCollections.add(change.collection))

  if (changes.length === 0) {
    return affectedCollections
  }

  await withSyncHooksSuppressed(async () => {
    await db.transaction(
      "rw",
      SYNC_COLLECTION_TABLES_WITH_VERSIONS,
      async (transaction) => {
        await runSequentially(changes, async (change) => {
          const localId = resolveCollectionLocalId(change.collection, change.id)

          try {
            if (change.deleted) {
              await deleteLocalRecord(change.collection, localId)
              await transaction
                .table("syncRecordVersions")
                .put({ collection: change.collection, id: localId, version: change.version })
              return
            }

            if (!change.data) {
              // This shouldn't happen - non-deleted changes should always have data
              console.warn(`[Sync] Skipping non-deleted change with null data: ${change.collection}/${change.id}`)
              return
            }
            const local = fromCloudRecord(change.collection, change.data)
            const applied = await upsertLocalRecord(change.collection, localId, local)
            if (!applied) {
              // Warn and skip invalid records instead of throwing — throwing would abort
              // the entire transaction, rolling back the cursor, and causing an infinite
              // retry loop since the same invalid record would be pulled again.
              console.warn(`[Sync] Skipping pulled record for ${change.collection}:${change.id}`)
            }

            await transaction
              .table("syncRecordVersions")
              .put({ collection: change.collection, id: localId, version: change.version })
          } catch (error) {
            console.error(`[Sync] Failed applying change ${change.collection}/${change.id}`, error)
            throw error
          }
        })
      }
    )
  })

  return affectedCollections
}

export async function finalizeAppliedPullChanges(affectedCollections: Set<SyncCollection>): Promise<void> {
  if (affectedCollections.size === 0) {
    return
  }

  await rebuildLocalOnlyFields(affectedCollections)
  await recalculateDerivedData(affectedCollections)
  invalidateQueriesForCollections(affectedCollections)
}

export async function clearLocalSyncData(): Promise<void> {
  await withSyncHooksSuppressed(async () => {
    await db.transaction(
      "rw",
      CLEAR_LOCAL_SYNC_TABLES,
      async () => {
        await db.workoutSessions.clear()
        await db.activeSession.clear()
        await db.workoutTemplates.clear()
        await db.personalRecords.clear()
        await db.foods.clear()
        await db.nutritionLogs.clear()
        await db.mealTemplates.clear()
        await db.bodyWeight.clear()
        await db.customExercises.clear()
        await db.settings.delete("settings")
        await db.achievements.clear()
        await db.userStats.clear()
        await db.syncRecordVersions.clear()
      }
    )
  })
  await clearLocalDataOwnerUserId()
}

async function upsertLocalRecord<TCollection extends SyncCollection>(
  collection: TCollection,
  id: string,
  record: unknown
): Promise<boolean> {
  const registryEntry = COLLECTION_REGISTRY[collection]
  const parsed = registryEntry.parse(record)
  if (!parsed) return false

  try {
    await registryEntry.put(id, parsed)
    return true
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw error
    }
    console.error(`[Sync] Failed writing pulled record ${collection}:${id}`, error)
    return false
  }
}

async function deleteLocalRecord(collection: SyncCollection, id: string): Promise<void> {
  await COLLECTION_REGISTRY[collection].del(id)
}

function isQuotaExceededError(error: unknown): boolean {
  if (error instanceof DOMException) {
    return error.name === "QuotaExceededError"
  }

  if (!(error instanceof Error)) {
    return false
  }

  return error.name === "QuotaExceededError" || /quota/i.test(error.message)
}
