import { clearSyncMetadata } from "@/features/sync/changeTracker"
import { clearDeviceId } from "@/features/sync/deviceId"
import { useAuthStore, useSyncStore, clearAuthStorage } from "@/features/sync/store"

export async function resetSyncState(): Promise<void> {
  useAuthStore.getState().clearAuth()
  clearAuthStorage()
  clearDeviceId()

  const syncStore = useSyncStore.getState()
  syncStore.setInitialSyncState(null)
  syncStore.setStatus("idle")
  syncStore.setLastSyncedAtMs(null)
  syncStore.setLastError(null)
  syncStore.setConflicts([])

  await clearSyncMetadata()
}
