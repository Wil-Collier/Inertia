import { act, renderHook } from "@testing-library/react"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { useSync } from "@/features/sync/hooks"
import { useAuthStore, useSyncStore } from "@/features/sync/store"

const loginWithGoogleMock = vi.fn()
const logoutSessionMock = vi.fn()
const clearSyncMetadataMock = vi.fn()
const setLocalDataOwnerUserIdMock = vi.fn()
const resolveInitialSyncMock = vi.fn()
const syncNowMock = vi.fn()
const toastInfoMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}))

vi.mock("@/features/sync/api", () => ({
  loginWithGoogle: (...args: unknown[]) => loginWithGoogleMock(...args),
  logoutSession: (...args: unknown[]) => logoutSessionMock(...args),
}))

vi.mock("@/features/sync/changeTracker", () => ({
  clearSyncMetadata: (...args: unknown[]) => clearSyncMetadataMock(...args),
  setLocalDataOwnerUserId: (...args: unknown[]) => setLocalDataOwnerUserIdMock(...args),
}))

vi.mock("@/features/sync/syncEngine", () => ({
  resolveInitialSync: (...args: unknown[]) => resolveInitialSyncMock(...args),
  syncNow: (...args: unknown[]) => syncNowMock(...args),
  SYNC_ENABLED: true,
}))

describe("sync hooks", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    useAuthStore.getState().clearAuth()
    useSyncStore.setState({
      status: "error",
      lastSyncedAtMs: null,
      lastError: "boom",
      pendingCount: 0,
      conflicts: [],
      initialSyncState: { localHasData: true, cloudHasData: true },
    })
    localStorage.clear()

    loginWithGoogleMock.mockResolvedValue({
      accessToken: "token-1",
      userId: "user-1",
      email: "user-1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })
    logoutSessionMock.mockResolvedValue({ ok: true })
    clearSyncMetadataMock.mockResolvedValue(undefined)
    setLocalDataOwnerUserIdMock.mockResolvedValue(undefined)
    resolveInitialSyncMock.mockResolvedValue(undefined)
    syncNowMock.mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("signs in, stores auth, and starts sync", async () => {
    const { result } = renderHook(() => useSync())

    await act(async () => {
      await result.current.signInWithGoogle("id-token")
    })

    const auth = useAuthStore.getState()
    expect(auth.isAuthenticated).toBe(true)
    expect(auth.userId).toBe("user-1")
    expect(syncNowMock).toHaveBeenCalledTimes(1)
  })

  it("clears sync ownership metadata when switching signed-in users", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token-old",
      userId: "old-user",
      email: "old@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    const { result } = renderHook(() => useSync())

    await act(async () => {
      await result.current.signInWithGoogle("id-token")
    })

    expect(setLocalDataOwnerUserIdMock).toHaveBeenCalledWith("old-user")
    expect(clearSyncMetadataMock).toHaveBeenCalledTimes(1)
  })

  it("signs out safely even if remote logout fails and resets local sync state", async () => {
    logoutSessionMock.mockRejectedValue(new Error("network"))
    useAuthStore.getState().setAuth({
      accessToken: "token-old",
      userId: "old-user",
      email: "old@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    const { result } = renderHook(() => useSync())

    await act(async () => {
      await result.current.signOut()
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useSyncStore.getState().status).toBe("idle")
    expect(useSyncStore.getState().lastError).toBeNull()
    expect(useSyncStore.getState().initialSyncState).toBeNull()
    expect(clearSyncMetadataMock).not.toHaveBeenCalled()
  })

  it("delegates initial sync resolution to the sync engine", async () => {
    const { result } = renderHook(() => useSync())

    await act(async () => {
      await result.current.resolveInitialSync("use-local")
    })

    expect(resolveInitialSyncMock).toHaveBeenCalledWith("use-local")
  })

  it("shows one expiry notification when token expiry time is reached", () => {
    const expiresInTwoSeconds = Date.now() + 2000
    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: expiresInTwoSeconds,
    })

    renderHook(() => useSync())

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(toastInfoMock).not.toHaveBeenCalled()

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(toastInfoMock).toHaveBeenCalledWith("Session expired. Sync will refresh on next request.")
  })
})
