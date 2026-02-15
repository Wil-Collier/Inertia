import { useAuthStore } from "@/features/sync/store"
import { SyncSessionInactiveError } from "@/features/sync/engine/accessTokenSource"

type SyncExecutionMode = "drop-if-busy" | "wait-for-turn"

export interface SyncSession {
  userId: string
  getAccessToken: () => string
  isActive: () => boolean
}

let syncLock: Promise<void> | null = null

export async function runWithSyncSession(
  mode: SyncExecutionMode,
  run: (session: SyncSession) => Promise<void>
): Promise<boolean> {
  const release = await acquireSyncLock(mode)
  if (!release) return false

  try {
    const auth = useAuthStore.getState()
    if (!auth.isAuthenticated || !auth.userId || !auth.accessToken) return false
    const sessionUserId = auth.userId

    await run({
      userId: sessionUserId,
      getAccessToken: () => {
        const current = useAuthStore.getState()
        if (!current.isAuthenticated || current.userId !== sessionUserId || !current.accessToken) {
          throw new SyncSessionInactiveError()
        }
        return current.accessToken
      },
      isActive: () => {
        const current = useAuthStore.getState()
        return current.isAuthenticated && current.userId === sessionUserId
      },
    })

    return true
  } finally {
    release()
  }
}

async function acquireSyncLock(mode: SyncExecutionMode): Promise<(() => void) | null> {
  if (syncLock) {
    if (mode === "drop-if-busy") {
      return null
    }
    await syncLock
    return await acquireSyncLock(mode)
  }

  let releaseLock: (() => void) | null = null
  const lock = new Promise<void>((resolve) => {
    releaseLock = () => resolve()
  })
  syncLock = lock

  return () => {
    if (syncLock === lock) {
      syncLock = null
    }
    releaseLock?.()
    releaseLock = null
  }
}
