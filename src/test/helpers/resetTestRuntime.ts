import type { QueryClient } from "@tanstack/react-query"
import { useAuthStore, useSyncStore } from "@/features/sync/store"
import { clearDatabase } from "@/test/helpers/dbTestUtils"

const DEFAULT_AUTH_STATE = {
  accessToken: null,
  userId: null,
  email: null,
  expiresAtMs: null,
  isAuthenticated: false,
}

const DEFAULT_SYNC_STATE = {
  status: "idle" as const,
  lastSyncedAtMs: null,
  lastError: null,
  pendingCount: 0,
  conflicts: [],
  initialSyncState: null,
}

export async function resetTestRuntime(queryClient?: QueryClient): Promise<void> {
  await clearDatabase()

  sessionStorage.clear()

  useAuthStore.setState(DEFAULT_AUTH_STATE)
  useSyncStore.setState(DEFAULT_SYNC_STATE)

  queryClient?.clear()
}
