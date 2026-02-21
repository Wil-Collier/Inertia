import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDebouncedPush } from "@/features/sync/runtime/useDebouncedPush"
import { useAuthStore, useSyncStore } from "@/features/sync/runtime/store"

const syncNowMock = vi.fn(async () => undefined)
const refreshPendingCountMock = vi.fn(async () => undefined)
let syncEnabled = true

vi.mock("@/features/sync/syncEngine", () => ({
  syncNow: () => syncNowMock(),
  get SYNC_ENABLED() {
    return syncEnabled
  },
}))

vi.mock("@/features/sync/tracking/changeTracker", async () => {
  const actual = await vi.importActual("@/features/sync/tracking/changeTracker")
  return {
    ...actual,
    refreshPendingCount: () => refreshPendingCountMock(),
  }
})

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  })
}

describe("useDebouncedPush", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    syncEnabled = true
    setOnline(true)
    useAuthStore.getState().clearAuth()
    useSyncStore.setState({ pendingCount: 0 })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("refreshes pending count on mount", () => {
    renderHook(() => useDebouncedPush())
    expect(refreshPendingCountMock).toHaveBeenCalledTimes(1)
  })

  it("debounces pushes and fires once after pending changes settle", () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    useSyncStore.setState({ pendingCount: 0 })
    renderHook(() => useDebouncedPush())

    act(() => {
      useSyncStore.setState({ pendingCount: 1 })
      vi.advanceTimersByTime(3000)
    })
    expect(syncNowMock).not.toHaveBeenCalled()

    act(() => {
      useSyncStore.setState({ pendingCount: 2 })
      vi.advanceTimersByTime(5000)
    })

    expect(syncNowMock).toHaveBeenCalledTimes(1)
  })

  it("does not push when unauthenticated", () => {
    useSyncStore.setState({ pendingCount: 2 })
    renderHook(() => useDebouncedPush())

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(syncNowMock).not.toHaveBeenCalled()
  })

  it("does not push when offline", () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    setOnline(false)
    useSyncStore.setState({ pendingCount: 2 })
    renderHook(() => useDebouncedPush())

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(syncNowMock).not.toHaveBeenCalled()
  })

  it("does not push when sync is disabled", () => {
    syncEnabled = false

    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    useSyncStore.setState({ pendingCount: 2 })
    renderHook(() => useDebouncedPush())

    act(() => {
      vi.advanceTimersByTime(5000)
    })

    expect(syncNowMock).not.toHaveBeenCalled()
  })
})
