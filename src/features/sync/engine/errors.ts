import { SyncApiError } from "@/features/sync/client/api"
import { useAuthStore, useSyncStore } from "@/features/sync/runtime/store"

export function handleSyncError(error: unknown): void {
  const syncStore = useSyncStore.getState()

  if (error instanceof SyncApiError && error.status === 401) {
    useAuthStore.getState().clearAuth()
    syncStore.setLastError("Session expired. Please sign in again.")
    syncStore.setStatus("error")
    return
  }

  if (error instanceof SyncApiError) {
    syncStore.setLastError(error.message)
  } else if (error instanceof Error) {
    syncStore.setLastError(error.message)
  } else {
    syncStore.setLastError("Sync failed")
  }
  syncStore.setStatus("error")
}
