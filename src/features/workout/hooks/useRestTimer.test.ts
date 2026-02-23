import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useRestTimer } from "@/features/workout/hooks/useRestTimer"
import { useRestTimerStore } from "@/features/workout/restTimerStore"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"

const showRestTimerNotificationMock = vi.fn()
const canShowNotificationsMock = vi.fn(() => true)

// notifications is a true browser-API boundary (Notification permission, ServiceWorker) — mock required.
vi.mock("@/services/notifications", () => ({
  showRestTimerNotification: () => showRestTimerNotificationMock(),
  canShowNotifications: () => canShowNotificationsMock(),
}))

describe("useRestTimer", () => {
  beforeEach(async () => {
    // Clear DB with real timers so IndexedDB promises resolve normally.
    await clearDatabase()
    vi.clearAllMocks()
    useRestTimerStore.getState().reset()
  })

  afterEach(() => {
    vi.useRealTimers()
    useRestTimerStore.getState().reset()
  })

  it("shows completion notification when notifications are enabled and permitted", async () => {
    await db.settings.put({
      id: "settings",
      theme: "system",
      restTimerDuration: 90,
      progressiveOverloadEnabled: true,
      areNotificationsEnabled: true,
      unitPreferences: { weight: "kg", distance: "km" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    })
    canShowNotificationsMock.mockReturnValue(true)

    vi.useFakeTimers()

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const onComplete = vi.fn()
    const { result } = renderHook(() => useRestTimer({ defaultDuration: 1, onComplete }), { wrapper })

    // Advance timers enough for React Query to complete the initial fetch,
    // ensuring areNotificationsEnabled ref is populated before the timer starts.
    await act(async () => {
      await vi.runAllTimersAsync()
    })

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

  it("does not show completion notification when disabled or not permitted", async () => {
    await db.settings.put({
      id: "settings",
      theme: "system",
      restTimerDuration: 90,
      progressiveOverloadEnabled: true,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "kg", distance: "km" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    })
    canShowNotificationsMock.mockReturnValue(false)

    vi.useFakeTimers()

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const onComplete = vi.fn()
    const { result } = renderHook(() => useRestTimer({ defaultDuration: 1, onComplete }), { wrapper })

    act(() => {
      result.current.start()
    })

    act(() => {
      vi.advanceTimersByTime(1100)
    })

    expect(onComplete.mock.calls.length).toBeGreaterThan(0)
    expect(showRestTimerNotificationMock).not.toHaveBeenCalled()
  })

  it("updates default duration when idle and uses the latest value on start", () => {
    vi.useFakeTimers()

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result, rerender } = renderHook(
      ({ defaultDuration }) => useRestTimer({ defaultDuration }),
      { initialProps: { defaultDuration: 90 }, wrapper }
    )

    act(() => {
      result.current.start()
    })
    expect(useRestTimerStore.getState().timer.duration).toBe(90)

    act(() => {
      result.current.reset()
    })

    rerender({ defaultDuration: 120 })

    act(() => {
      result.current.start()
    })
    expect(useRestTimerStore.getState().timer.duration).toBe(120)
  })
})
