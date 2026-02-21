import { act, renderHook } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest"
import { useSync } from "@/features/sync/runtime/hooks"
import { useAuthStore, useSyncStore } from "@/features/sync/runtime/store"
import { server } from "@/test/msw/server"

const clearSyncMetadataMock = vi.fn()
const resolveInitialSyncMock = vi.fn()
const syncNowMock = vi.fn()
const toastInfoMock = vi.fn()

vi.mock("sonner", () => ({
  toast: {
    info: (...args: unknown[]) => toastInfoMock(...args),
  },
}))

vi.mock("@/features/sync/tracking/changeTracker", () => ({
  clearSyncMetadata: (...args: unknown[]) => clearSyncMetadataMock(...args),
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

    server.use(
      http.post("/api/auth/login", () =>
        HttpResponse.json({
          accessToken: "token-1",
          userId: "user-1",
          email: "user-1@example.com",
          expiresAtMs: Date.now() + 60_000,
        })
      ),
      http.post("/api/auth/logout", () =>
        HttpResponse.json({ success: true })
      )
    )

    clearSyncMetadataMock.mockResolvedValue(undefined)
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

    expect(clearSyncMetadataMock).toHaveBeenCalledTimes(1)
  })

  it("clears metadata before starting sync when switching users", async () => {
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

    const clearCallOrder = clearSyncMetadataMock.mock.invocationCallOrder[0] ?? Number.NEGATIVE_INFINITY
    const syncCallOrder = syncNowMock.mock.invocationCallOrder[0] ?? Number.POSITIVE_INFINITY
    expect(clearSyncMetadataMock).toHaveBeenCalledTimes(1)
    expect(clearCallOrder).toBeLessThan(syncCallOrder)
  })

  it("signs out safely even if remote logout fails and resets local sync state", async () => {
    server.use(
      http.post("/api/auth/logout", () =>
        HttpResponse.json({ error: "network", message: "network" }, { status: 500 })
      )
    )
    useAuthStore.getState().setAuth({
      accessToken: "token-old",
      userId: "old-user",
      email: "old@example.com",
      expiresAtMs: Date.now() + 60_000,
    })
    useSyncStore.setState({
      conflicts: [{ collection: "foods", id: "f1", serverVersion: 2, clientBaseVersion: 1, reason: "VERSION_MISMATCH" }],
    })

    const { result } = renderHook(() => useSync())

    await act(async () => {
      await result.current.signOut()
    })

    expect(useAuthStore.getState().isAuthenticated).toBe(false)
    expect(useSyncStore.getState().status).toBe("idle")
    expect(useSyncStore.getState().lastError).toBeNull()
    expect(useSyncStore.getState().initialSyncState).toBeNull()
    expect(useSyncStore.getState().conflicts).toEqual([])
    expect(clearSyncMetadataMock).toHaveBeenCalledTimes(1)
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
