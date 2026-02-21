import { clearSyncMetadata } from "@/features/sync/tracking/changeTracker"
import { clearDeviceId } from "@/features/sync/client/deviceId"
import { useAuthStore, useSyncStore, clearAuthStorage } from "@/features/sync/runtime/store"

type ClearSyncAndAuthStateOptions = {
  clearDevice?: boolean
  clearConflicts?: boolean
  clearSyncMetadata?: boolean
}

export async function clearSyncAndAuthState(options: ClearSyncAndAuthStateOptions = {}): Promise<void> {
  const {
    clearDevice = false,
    clearConflicts = false,
    clearSyncMetadata: shouldClearSyncMetadata = false,
  } = options

  useAuthStore.getState().clearAuth()
  clearAuthStorage()

  if (clearDevice) {
    clearDeviceId()
  }

  const syncStore = useSyncStore.getState()
  syncStore.setInitialSyncState(null)
  syncStore.setStatus("idle")
  syncStore.setLastSyncedAtMs(null)
  syncStore.setLastError(null)
  syncStore.setLastAutoMergeSummary(null)

  if (clearConflicts) {
    syncStore.setConflicts([])
  }

  if (shouldClearSyncMetadata) {
    await clearSyncMetadata()
  }
}
