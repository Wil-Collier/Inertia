import {
  applyPulledChangesChunk,
  clearLocalSyncData,
  finalizeAppliedPullChanges,
} from "@/features/sync/engine/applyPipeline"
import { pullAllChanges, pullAndProcessChanges } from "@/features/sync/engine/pullPipeline"
import {
  mergeCloudAndLocal,
  overwriteCloudWithLocal,
  pushFullSnapshot,
  type MergeCloudAndLocalResult,
} from "@/features/sync/engine/pushPipeline"
import {
  clearSyncMetadata,
  getLocalDataOwnerUserId,
  getPullCursor,
  setLastSyncedAtMs,
  setLocalDataOwnerUserId,
  setPullCursor,
} from "@/features/sync/tracking/changeTracker"
import { readAccessToken, type AccessTokenSource } from "@/features/sync/engine/accessTokenSource"
import { hasAnyLocalSyncData } from "@/features/sync/engine/syncTables"
import type { InitialSyncStrategy } from "@/features/sync/model/types"
import type { SyncCollection } from "@/features/sync/model/schemas"
import { useSyncStore } from "@/features/sync/runtime/store"
import { pullChanges } from "@/features/sync/client/api"

export async function ensureInitialSync(accessTokenSource: AccessTokenSource, userId: string): Promise<boolean> {
  const existingCursor = await getPullCursor()
  if (existingCursor) {
    const localDataOwnerUserId = await getLocalDataOwnerUserId()
    if (localDataOwnerUserId === userId) {
      return true
    }

    await clearSyncMetadata()
  }

  const localHasData = await hasAnyLocalSyncData()
  const cloudHasData = await hasCloudData(accessTokenSource)

  if (!localHasData && !cloudHasData) {
    return true
  }

  if (localHasData && !cloudHasData) {
    const localDataOwnerUserId = await getLocalDataOwnerUserId()
    if (localDataOwnerUserId !== userId) {
      useSyncStore.getState().setInitialSyncState({ localHasData, cloudHasData })
      return false
    }

    await pushFullSnapshot(accessTokenSource)
    await pullApplyAndPersist(accessTokenSource, userId)
    return true
  }

  if (!localHasData && cloudHasData) {
    await pullApplyAndPersist(accessTokenSource, userId)
    return true
  }

  const localDataOwnerUserId = await getLocalDataOwnerUserId()
  if (localDataOwnerUserId === userId) {
    const summary = await mergeCloudAndLocal(accessTokenSource)
    persistMergeSummary(summary)
    await pullApplyAndPersist(accessTokenSource, userId)
    return true
  }

  useSyncStore.getState().setInitialSyncState({ localHasData, cloudHasData })
  return false
}

export async function resolveInitialSyncStrategy(
  accessTokenSource: AccessTokenSource,
  userId: string,
  strategy: InitialSyncStrategy
): Promise<void> {
  if (strategy === "use-cloud") {
    await replaceLocalWithCloud(accessTokenSource, userId)
  } else if (strategy === "merge") {
    const summary = await mergeCloudAndLocal(accessTokenSource)
    persistMergeSummary(summary)
    await pullApplyAndPersist(accessTokenSource, userId)
  } else if (strategy === "use-local") {
    await overwriteCloudWithLocal(accessTokenSource)
    await pullApplyAndPersist(accessTokenSource, userId)
  }

  useSyncStore.getState().setInitialSyncState(null)
}

async function replaceLocalWithCloud(accessTokenSource: AccessTokenSource, userId: string): Promise<void> {
  const pullResult = await pullAllChanges(accessTokenSource, { cursor: { version: 0 } })

  await clearLocalSyncData()
  await clearSyncMetadata()

  const affectedCollections = await applyPulledChangesChunk(pullResult.changes)
  await finalizeAppliedPullChanges(affectedCollections)

  if (pullResult.cursor) {
    await setPullCursor(pullResult.cursor)
  }

  await setLastSyncedAtMs(pullResult.serverTimestampMs)
  await setLocalDataOwnerUserId(userId)
  useSyncStore.getState().setLastSyncedAtMs(pullResult.serverTimestampMs)
}

function persistMergeSummary(summary: MergeCloudAndLocalResult | null | undefined): void {
  if (!summary) return
  useSyncStore.getState().setLastAutoMergeSummary({
    resolvedAtMs: Date.now(),
    ...summary,
  })
}

async function pullApplyAndPersist(accessTokenSource: AccessTokenSource, userId: string): Promise<void> {
  const affectedCollections = new Set<SyncCollection>()
  const pullResult = await pullAndProcessChanges(accessTokenSource, {
    onPage: async (page) => {
      const pageAffectedCollections = await applyPulledChangesChunk(page.changes)
      pageAffectedCollections.forEach((collection) => affectedCollections.add(collection))
      if (page.cursor) {
        await setPullCursor(page.cursor)
      }
    },
  })

  await finalizeAppliedPullChanges(affectedCollections)
  await setLastSyncedAtMs(pullResult.serverTimestampMs)
  await setLocalDataOwnerUserId(userId)
  useSyncStore.getState().setLastSyncedAtMs(pullResult.serverTimestampMs)
}

async function hasCloudData(accessTokenSource: AccessTokenSource): Promise<boolean> {
  const response = await pullChanges(readAccessToken(accessTokenSource), { limit: 1, cursor: { version: 0 } })
  return response.changes.length > 0
}
