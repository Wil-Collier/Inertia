import { useEffect } from "react"
import { toast } from "sonner"
import { loginWithGoogle } from "@/features/sync/api"
import { clearSyncMetadata } from "@/features/sync/changeTracker"
import { resolveInitialSync as resolveInitialSyncEngine, syncNow, SYNC_ENABLED } from "@/features/sync/syncEngine"
import { useAuthStore, useSyncStore, clearAuthStorage } from "@/features/sync/store"
import type { InitialSyncStrategy } from "@/features/sync/types"

const REAUTH_BUFFER_MS = 7 * 24 * 60 * 60 * 1000

export function useAuth() {
  return useAuthStore()
}

export function useSync() {
  const auth = useAuthStore()
  const sync = useSyncStore()

  useTokenExpiryPrompt(auth.expiresAtMs, auth.clearAuth)

  const signInWithGoogle = async (idToken: string) => {
    const response = await loginWithGoogle(idToken)

    if (auth.userId && auth.userId !== response.userId) {
      await clearSyncMetadata()
    }

    auth.setAuth(response)
    await syncNow()
  }

  const signOut = async () => {
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
    resolveInitialSync,
    syncNow,
    syncEnabled: SYNC_ENABLED,
  }
}

function useTokenExpiryPrompt(expiresAtMs: number | null, clearAuth: () => void) {
  useEffect(() => {
    if (!expiresAtMs) return

    const normalizedExpiresAtMs = expiresAtMs < 1_000_000_000_000 ? expiresAtMs * 1000 : expiresAtMs
    const msUntilExpiry = normalizedExpiresAtMs - Date.now()

    if (msUntilExpiry <= 0) {
      clearAuth()
      return
    }

    const promptDelay = Math.max(msUntilExpiry - REAUTH_BUFFER_MS, 0)
    const promptTimeoutId = window.setTimeout(() => {
      toast.info("Please sign in again to continue syncing")
    }, promptDelay)

    const expiryTimeoutId = window.setTimeout(() => {
      clearAuth()
    }, msUntilExpiry)

    return () => {
      window.clearTimeout(promptTimeoutId)
      window.clearTimeout(expiryTimeoutId)
    }
  }, [expiresAtMs, clearAuth])
}
