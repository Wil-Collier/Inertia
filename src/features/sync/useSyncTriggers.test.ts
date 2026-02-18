import { act, cleanup, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useSyncTriggers } from "@/features/sync/useSyncTriggers"
import { useAuthStore } from "@/features/sync/store"
import { lastPullTimestamp } from "@/features/sync/lastPullTracker"

const syncNowMock = vi.fn(async () => undefined)
let syncEnabled = true

vi.mock("@/features/sync/syncEngine", () => ({
  syncNow: () => syncNowMock(),
  get SYNC_ENABLED() {
    return syncEnabled
  },
}))

let mockPathname = "/"

vi.mock("@tanstack/react-router", () => ({
  useRouterState: ({ select }: { select: (s: { location: { pathname: string } }) => string }) =>
    select({ location: { pathname: mockPathname } }),
}))

function setOnline(value: boolean) {
  Object.defineProperty(navigator, "onLine", {
    configurable: true,
    value,
  })
}

function setAuthenticatedUser() {
  useAuthStore.getState().setAuth({
    accessToken: "token",
    userId: "user-1",
    email: "user@example.com",
    expiresAtMs: Date.now() + 60_000,
  })
}

describe("useSyncTriggers", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    syncEnabled = true
    mockPathname = "/"
    lastPullTimestamp.value = 0
    setOnline(true)
    useAuthStore.getState().clearAuth()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    // Reset visibilityState to default to avoid leaking between tests
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
  })

  it("triggers sync on mount when authenticated", () => {
    setAuthenticatedUser()
    renderHook(() => useSyncTriggers())
    expect(syncNowMock).toHaveBeenCalledTimes(1)
  })

  it("triggers sync when the browser comes back online", () => {
    setAuthenticatedUser()
    renderHook(() => useSyncTriggers())
    const callsAfterMount = syncNowMock.mock.calls.length

    act(() => {
      window.dispatchEvent(new Event("online"))
    })

    expect(syncNowMock).toHaveBeenCalledTimes(callsAfterMount + 1)
  })

  it("triggers sync when the page becomes visible", () => {
    setAuthenticatedUser()
    renderHook(() => useSyncTriggers())
    const callsAfterMount = syncNowMock.mock.calls.length

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    expect(syncNowMock).toHaveBeenCalledTimes(callsAfterMount + 1)
  })

  it("triggers sync on the 30-second interval", () => {
    setAuthenticatedUser()
    renderHook(() => useSyncTriggers())
    const callsAfterMount = syncNowMock.mock.calls.length

    act(() => {
      vi.advanceTimersByTime(30 * 1000)
    })

    expect(syncNowMock).toHaveBeenCalledTimes(callsAfterMount + 1)
  })

  it("skips interval poll if a pull happened recently", () => {
    setAuthenticatedUser()

    renderHook(() => useSyncTriggers())

    const callsAfterMount = syncNowMock.mock.calls.length
    expect(callsAfterMount).toBeGreaterThan(0)

    // Advance to 20s, then simulate a pull, then advance the remaining 10s.
    // When the 30s interval fires, the pull is only 10s old → should be skipped.
    act(() => {
      vi.advanceTimersByTime(20 * 1000)
    })

    lastPullTimestamp.value = Date.now()

    act(() => {
      vi.advanceTimersByTime(10 * 1000)
    })

    // Should NOT have triggered another sync because pull was recent
    expect(syncNowMock).toHaveBeenCalledTimes(callsAfterMount)
  })

  it("triggers sync on route change", () => {
    setAuthenticatedUser()

    const { rerender } = renderHook(() => useSyncTriggers())
    const callsAfterMount = syncNowMock.mock.calls.length

    // Simulate route change
    mockPathname = "/workout"
    rerender()

    expect(syncNowMock).toHaveBeenCalledTimes(callsAfterMount + 1)
  })

  it("does not trigger sync when user is unauthenticated", () => {
    renderHook(() => useSyncTriggers())
    expect(syncNowMock).not.toHaveBeenCalled()
  })

  it("does not trigger sync when sync is disabled", () => {
    syncEnabled = false
    setAuthenticatedUser()

    renderHook(() => useSyncTriggers())

    expect(syncNowMock).not.toHaveBeenCalled()
  })

  it("skips interval sync while offline", () => {
    setAuthenticatedUser()

    setOnline(false)
    renderHook(() => useSyncTriggers())

    const callsAfterMount = syncNowMock.mock.calls.length
    expect(callsAfterMount).toBeGreaterThan(0)

    act(() => {
      vi.advanceTimersByTime(30 * 1000)
    })

    expect(syncNowMock).toHaveBeenCalledTimes(callsAfterMount)
  })
})
