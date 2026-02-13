import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { SyncStatus, InitialSyncState } from "@/features/sync/types"
import type { PushConflict } from "@/features/sync/schemas"

const SYNC_AUTH_STORAGE_KEY = "inertia-sync-auth"

interface AuthState {
  accessToken: string | null
  userId: string | null
  email: string | null
  expiresAtMs: number | null
  isAuthenticated: boolean
  setAuth: (payload: { accessToken: string; userId: string; email: string; expiresAtMs: number }) => void
  setAccessToken: (payload: { accessToken: string; userId: string; email: string; expiresAtMs: number }) => void
  clearAuth: () => void
}

export const useAuthStore = create<AuthState>()((set) => ({
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
      expiresAtMs,
      isAuthenticated: true,
    }),
  setAccessToken: ({ accessToken, userId, email, expiresAtMs }) =>
    set({
      accessToken,
      userId,
      email,
      expiresAtMs,
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
}))

purgeLegacyAuthStorage()

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
  purgeLegacyAuthStorage()
}

function purgeLegacyAuthStorage(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(SYNC_AUTH_STORAGE_KEY)
}
