import { applyPulledChanges } from "@/features/sync/engine/applyPipeline"
import { handleSyncError } from "@/features/sync/engine/errors"
import { ensureInitialSync, resolveInitialSyncStrategy } from "@/features/sync/engine/initialSyncCoordinator"
import { pullAllChanges } from "@/features/sync/engine/pullPipeline"
import { pushPendingChangesInternal } from "@/features/sync/engine/pushPipeline"
import { setLastSyncedAtMs, setLocalDataOwnerUserId, setPullCursor } from "@/features/sync/changeTracker"
import { lastPullTimestamp } from "@/features/sync/lastPullTracker"
import type { InitialSyncStrategy } from "@/features/sync/types"
import { useAuthStore, useSyncStore } from "@/features/sync/store"

const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [1000, 5000, 15000]

let syncInFlight = false

export const SYNC_ENABLED = import.meta.env.VITE_ENABLE_SYNC !== "false"

export async function syncNow(): Promise<void> {
  if (!SYNC_ENABLED) return
  const auth = useAuthStore.getState()
  if (!auth.isAuthenticated || !auth.accessToken || !auth.userId) return
  const accessToken = auth.accessToken
  const userId = auth.userId
  if (!navigator.onLine) {
    useSyncStore.getState().setStatus("offline")
    return
  }

  if (syncInFlight) return
  syncInFlight = true

  const syncStore = useSyncStore.getState()
  syncStore.setStatus("syncing")
  syncStore.setLastError(null)
  syncStore.setConflicts([])

  try {
    await syncWithRetry(async () => {
      const canProceed = await ensureInitialSync(accessToken, userId)
      if (!canProceed) {
        syncStore.setStatus("idle")
        return
      }

      await pushPendingChangesInternal(accessToken, true)
      const pullResult = await pullAllChanges(accessToken)
      await applyPulledChanges(pullResult.changes)

      if (pullResult.cursor) {
        await setPullCursor(pullResult.cursor)
      }

      lastPullTimestamp.value = Date.now()
      syncStore.setLastSyncedAtMs(pullResult.serverTimestampMs)
      await setLastSyncedAtMs(pullResult.serverTimestampMs)
      await setLocalDataOwnerUserId(userId)
      syncStore.setStatus("success")
    })
  } catch (error) {
    handleSyncError(error)
  } finally {
    syncInFlight = false
  }
}

export async function pushPendingChanges(): Promise<void> {
  if (!SYNC_ENABLED) return
  const auth = useAuthStore.getState()
  if (!auth.isAuthenticated || !auth.accessToken || !auth.userId) return
  const accessToken = auth.accessToken
  const userId = auth.userId
  if (!navigator.onLine) return

  if (syncInFlight) return
  syncInFlight = true

  const syncStore = useSyncStore.getState()
  syncStore.setStatus("syncing")
  syncStore.setLastError(null)
  syncStore.setConflicts([])

  try {
    await syncWithRetry(async () => {
      const canProceed = await ensureInitialSync(accessToken, userId)
      if (!canProceed) {
        syncStore.setStatus("idle")
        return
      }

      await pushPendingChangesInternal(accessToken, true)
      const pullResult = await pullAllChanges(accessToken)
      await applyPulledChanges(pullResult.changes)

      if (pullResult.cursor) {
        await setPullCursor(pullResult.cursor)
      }

      lastPullTimestamp.value = Date.now()
      syncStore.setLastSyncedAtMs(pullResult.serverTimestampMs)
      await setLastSyncedAtMs(pullResult.serverTimestampMs)
      await setLocalDataOwnerUserId(userId)
      syncStore.setStatus("success")
    })
  } catch (error) {
    handleSyncError(error)
  } finally {
    syncInFlight = false
  }
}

export async function resolveInitialSync(strategy: InitialSyncStrategy): Promise<void> {
  const auth = useAuthStore.getState()
  if (!auth.isAuthenticated || !auth.accessToken || !auth.userId) return
  const accessToken = auth.accessToken
  const userId = auth.userId

  const syncStore = useSyncStore.getState()
  syncStore.setStatus("syncing")
  syncStore.setLastError(null)
  syncStore.setConflicts([])

  try {
    await resolveInitialSyncStrategy(accessToken, userId, strategy)
    syncStore.setStatus("success")
  } catch (error) {
    handleSyncError(error)
  }
}

async function syncWithRetry(fn: () => Promise<void>, attempt = 0): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
      await syncWithRetry(fn, attempt + 1)
      return
    }
    throw error
  }
}
