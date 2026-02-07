import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useSyncTriggers } from "@/features/sync/useSyncTriggers"
import { useAuthStore } from "@/features/sync/store"

const syncNowMock = vi.fn(async () => undefined)
let syncEnabled = true

vi.mock("@/features/sync/syncEngine", () => ({
  syncNow: () => syncNowMock(),
  get SYNC_ENABLED() {
    return syncEnabled
  },
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
      vi.advanceTimersByTime(5 * 60 * 1000)
    })

    expect(syncNowMock).toHaveBeenCalledTimes(4)
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
      vi.advanceTimersByTime(5 * 60 * 1000)
    })

    expect(syncNowMock).toHaveBeenCalledTimes(callsAfterMount)
  })
})
