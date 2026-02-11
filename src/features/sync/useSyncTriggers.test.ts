import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
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

  it("triggers sync on mount, online events, visible events and interval", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    renderHook(() => useSyncTriggers())

    expect(syncNowMock).toHaveBeenCalledTimes(1)

    act(() => {
      window.dispatchEvent(new Event("online"))
    })

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    })

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"))
    })

    act(() => {
      vi.advanceTimersByTime(30 * 1000)
    })

    expect(syncNowMock).toHaveBeenCalledTimes(4)
  })

  it("skips interval poll if a pull happened recently", () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

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
    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

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

    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    renderHook(() => useSyncTriggers())

    expect(syncNowMock).not.toHaveBeenCalled()
  })

  it("skips interval sync while offline", () => {
    useAuthStore.getState().setAuth({
      accessToken: "token",
      userId: "user-1",
      email: "user@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

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
