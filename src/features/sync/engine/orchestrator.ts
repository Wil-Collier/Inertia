import {
  applyPulledChangesChunk,
  finalizeAppliedPullChanges,
} from "@/features/sync/engine/applyPipeline"
import { handleSyncError } from "@/features/sync/engine/errors"
import { ensureInitialSync, resolveInitialSyncStrategy } from "@/features/sync/engine/initialSyncCoordinator"
import { pullAndProcessChanges } from "@/features/sync/engine/pullPipeline"
import { pushPendingChangesInternal } from "@/features/sync/engine/pushPipeline"
import { runWithSyncSession } from "@/features/sync/engine/syncSession"
import { SyncSessionInactiveError, type AccessTokenSource } from "@/features/sync/engine/accessTokenSource"
import { SyncApiError } from "@/features/sync/client/api"
import { setLastSyncedAtMs, setLocalDataOwnerUserId, setPullCursor } from "@/features/sync/tracking/changeTracker"
import { lastPullTimestamp } from "@/features/sync/client/lastPullTracker"
import type { SyncCollection } from "@/features/sync/model/schemas"
import type { InitialSyncStrategy } from "@/features/sync/model/types"
import { useSyncStore } from "@/features/sync/runtime/store"

const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [1000, 5000, 15000]

export const SYNC_ENABLED = import.meta.env.VITE_ENABLE_SYNC !== "false"

export async function syncNow(options: { source?: "manual" | "background" } = {}): Promise<void> {
  await runAuthenticatedSyncCycle(options.source ?? "background")
}

// Legacy alias: this still runs a full sync cycle (push + pull + apply).
export const pushPendingChanges = syncNow

async function runAuthenticatedSyncCycle(source: "manual" | "background"): Promise<void> {
  if (!SYNC_ENABLED) return
  if (!navigator.onLine) {
    useSyncStore.getState().setStatus("offline")
    return
  }

  const syncStore = useSyncStore.getState()

  try {
    await runWithSyncSession("drop-if-busy", async (session) => {
      const accessTokenSource: AccessTokenSource = session.getAccessToken

      syncStore.setStatus("syncing")
      syncStore.setLastError(null)
      syncStore.setConflicts([])
      syncStore.setLastAutoMergeSummary(null)

      await syncWithRetry(async () => {
        const canProceed = await ensureInitialSync(accessTokenSource, session.userId)
        if (!canProceed) {
          syncStore.setStatus("idle")
          return
        }

        await pushPendingChangesInternal(accessTokenSource, true, source === "manual")

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

        lastPullTimestamp.value = Date.now()
        syncStore.setLastSyncedAtMs(pullResult.serverTimestampMs)
        await setLastSyncedAtMs(pullResult.serverTimestampMs)
        await setLocalDataOwnerUserId(session.userId)
        syncStore.setStatus("success")
      }, () => session.isActive())
    })
  } catch (error) {
    if (error instanceof SyncSessionInactiveError) {
      syncStore.setStatus("idle")
      return
    }
    handleSyncError(error)
  }
}

export async function resolveInitialSync(strategy: InitialSyncStrategy): Promise<void> {
  const syncStore = useSyncStore.getState()

  try {
    await runWithSyncSession("wait-for-turn", async (session) => {
      syncStore.setStatus("syncing")
      syncStore.setLastError(null)
      syncStore.setConflicts([])

      await resolveInitialSyncStrategy(session.getAccessToken, session.userId, strategy)
      syncStore.setStatus("success")
    })
  } catch (error) {
    if (error instanceof SyncSessionInactiveError) {
      syncStore.setStatus("idle")
      return
    }
    handleSyncError(error)
  }
}

async function syncWithRetry(fn: () => Promise<void>, shouldContinue: () => boolean, attempt = 0): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (attempt < MAX_RETRIES - 1 && isRetryableSyncError(error) && shouldContinue()) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
      await syncWithRetry(fn, shouldContinue, attempt + 1)
      return
    }
    throw error
  }
}

function isRetryableSyncError(error: unknown): boolean {
  if (error instanceof SyncApiError) {
    const status = error.status
    if (typeof status !== "number") return false
    return status === 429 || (status >= 500 && status <= 599)
  }
  if (error instanceof SyncSessionInactiveError) {
    return false
  }
  return error instanceof Error
}
