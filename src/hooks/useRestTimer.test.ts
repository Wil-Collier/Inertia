import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useRestTimer } from "@/hooks/useRestTimer"
import { useRestTimerStore } from "@/features/workout/restTimerStore"

const showRestTimerNotificationMock = vi.fn()
const canShowNotificationsMock = vi.fn(() => true)
let notificationsEnabled = false

vi.mock("@/services/notifications", () => ({
  showRestTimerNotification: () => showRestTimerNotificationMock(),
  canShowNotifications: () => canShowNotificationsMock(),
}))

vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({
    data: {
      areNotificationsEnabled: notificationsEnabled,
    },
  }),
}))

describe("useRestTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    notificationsEnabled = false
    useRestTimerStore.getState().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useRestTimerStore.getState().reset()
  })

  it("shows completion notification when notifications are enabled and permitted", () => {
    notificationsEnabled = true
    canShowNotificationsMock.mockReturnValue(true)

    const onComplete = vi.fn()
    const { result } = renderHook(() => useRestTimer({ defaultDuration: 1, onComplete }))

    act(() => {
      result.current.start()
    })

    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(onComplete.mock.calls.length).toBeGreaterThan(0)
    expect(showRestTimerNotificationMock.mock.calls.length).toBeGreaterThan(0)
    expect(result.current.isRunning).toBe(false)
    expect(result.current.timeRemaining).toBe(0)
  })

  it("does not show completion notification when disabled or not permitted", () => {
    notificationsEnabled = false
    canShowNotificationsMock.mockReturnValue(false)

    const onComplete = vi.fn()
    const { result } = renderHook(() => useRestTimer({ defaultDuration: 1, onComplete }))

    act(() => {
      result.current.start()
    })

    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(onComplete.mock.calls.length).toBeGreaterThan(0)
    expect(showRestTimerNotificationMock).not.toHaveBeenCalled()
  })
})
