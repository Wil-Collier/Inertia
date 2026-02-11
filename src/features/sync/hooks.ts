import { useEffect } from "react"
import { toast } from "sonner"
import { loginWithGoogle, logoutSession, resetCloudData as apiResetCloudData } from "@/features/sync/api"
import { clearSyncMetadata, setLocalDataOwnerUserId } from "@/features/sync/changeTracker"
import { resolveInitialSync as resolveInitialSyncEngine, syncNow, SYNC_ENABLED } from "@/features/sync/syncEngine"
import { useAuthStore, useSyncStore, clearAuthStorage } from "@/features/sync/store"
import type { InitialSyncStrategy } from "@/features/sync/types"

export function useAuth() {
  return useAuthStore()
}

export function useSync() {
  const auth = useAuthStore()
  const sync = useSyncStore()

  useTokenExpiryPrompt(auth.expiresAtMs)

  const signInWithGoogle = async (idToken: string) => {
    const response = await loginWithGoogle(idToken)

    if (auth.userId && auth.userId !== response.userId) {
      await setLocalDataOwnerUserId(auth.userId)
      await clearSyncMetadata()
    }

    auth.setAuth(response)
    await syncNow()
  }

  const signOut = async () => {
    try {
      await logoutSession()
    } catch {
      // Best effort logout; continue with local state reset.
    }

    auth.clearAuth()
    clearAuthStorage()
    await clearSyncMetadata()
    sync.setInitialSyncState(null)
    sync.setStatus("idle")
    sync.setLastError(null)
  }

  const resetCloudData = async () => {
    if (!auth.accessToken) {
      throw new Error("Not authenticated")
    }

    await apiResetCloudData(auth.accessToken)

    // After cloud data is reset, the session is invalidated on server.
    // We should clear local auth state.
    auth.clearAuth()
    clearAuthStorage()
    await clearSyncMetadata()
    sync.setInitialSyncState(null)
    sync.setStatus("idle")
    sync.setLastError(null)
  }

  const resolveInitialSync = async (strategy: InitialSyncStrategy) => {
    await resolveInitialSyncEngine(strategy)
  }

  return {
    auth,
    sync,
    signInWithGoogle,
    signOut,
    resetCloudData,
    resolveInitialSync,
    syncNow,
    syncEnabled: SYNC_ENABLED,
  }
}

function useTokenExpiryPrompt(expiresAtMs: number | null) {
  useEffect(() => {
    if (!expiresAtMs) return

    const normalizedExpiresAtMs = expiresAtMs < 1_000_000_000_000 ? expiresAtMs * 1000 : expiresAtMs
    const MAX_TIMEOUT_DELAY = 2147483647
    const timeoutIds: number[] = []

    const scheduleTimers = () => {
      const msUntilExpiry = normalizedExpiresAtMs - Date.now()
      if (msUntilExpiry <= 0) return

      if (msUntilExpiry > MAX_TIMEOUT_DELAY) {
        const checkAgainId = window.setTimeout(scheduleTimers, MAX_TIMEOUT_DELAY)
        timeoutIds.push(checkAgainId)
        return
      }

      const expiryTimeoutId = window.setTimeout(() => {
        toast.info("Session expired. Sync will refresh on next request.")
      }, msUntilExpiry)

      timeoutIds.push(expiryTimeoutId)
    }

    scheduleTimers()

    return () => {
      timeoutIds.forEach((timeoutId) => window.clearTimeout(timeoutId))
    }
  }, [expiresAtMs])
}
