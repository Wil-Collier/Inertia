import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SyncStatus, InitialSyncState } from "@/features/sync/types"
import type { PushConflict } from "@/features/sync/schemas"

const SYNC_AUTH_STORAGE_KEY = "inertia-sync-auth"
const EXPIRY_MS_THRESHOLD = 1_000_000_000_000

function normalizeExpiresAtMs(expiresAtMs: number): number {
  return expiresAtMs < EXPIRY_MS_THRESHOLD ? expiresAtMs * 1000 : expiresAtMs
}

interface AuthState {
  accessToken: string | null
  userId: string | null
  email: string | null
  expiresAtMs: number | null
  isAuthenticated: boolean
  setAuth: (payload: { accessToken: string; userId: string; email: string; expiresAtMs: number }) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      userId: null,
      email: null,
      expiresAtMs: null,
      isAuthenticated: false,
      setAuth: ({ accessToken, userId, email, expiresAtMs }) =>
        set({
          accessToken,
          userId,
          email,
          expiresAtMs: normalizeExpiresAtMs(expiresAtMs),
          isAuthenticated: true,
        }),
      clearAuth: () =>
        set({
          accessToken: null,
          userId: null,
          email: null,
          expiresAtMs: null,
          isAuthenticated: false,
        }),
    }),
    {
      name: SYNC_AUTH_STORAGE_KEY,
    }
  )
)

interface SyncState {
  status: SyncStatus
  lastSyncedAtMs: number | null
  lastError: string | null
  pendingCount: number
  conflicts: PushConflict[]
  initialSyncState: InitialSyncState | null
  setStatus: (status: SyncStatus) => void
  setLastSyncedAtMs: (timestamp: number | null) => void
  setLastError: (error: string | null) => void
  setPendingCount: (count: number) => void
  setConflicts: (conflicts: PushConflict[]) => void
  setInitialSyncState: (state: InitialSyncState | null) => void
}

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      status: "idle",
      lastSyncedAtMs: null,
      lastError: null,
      pendingCount: 0,
      conflicts: [],
      initialSyncState: null,
      setStatus: (status) => set({ status }),
      setLastSyncedAtMs: (timestamp) => set({ lastSyncedAtMs: timestamp }),
      setLastError: (error) => set({ lastError: error }),
      setPendingCount: (count) => set({ pendingCount: count }),
      setConflicts: (conflicts) => set({ conflicts }),
      setInitialSyncState: (state) => set({ initialSyncState: state }),
    }),
    {
      name: "inertia-sync-store",
      partialize: (state) => ({
        lastSyncedAtMs: state.lastSyncedAtMs,
      }),
    }
  )
)

export function clearAuthStorage(): void {
  localStorage.removeItem(SYNC_AUTH_STORAGE_KEY)
}
