import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RestTimerBanner } from "@/components/workout/RestTimerBanner"
import { useRestTimerStore } from "@/features/workout/restTimerStore"

vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({
    data: {
      areNotificationsEnabled: false,
    },
  }),
}))

vi.mock("@/services/notifications", () => ({
  showRestTimerNotification: vi.fn(),
  canShowNotifications: () => false,
}))

vi.mock("@/lib/audio", () => ({
  playDingSound: vi.fn(),
}))

describe("RestTimerBanner", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useRestTimerStore.getState().reset()
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    useRestTimerStore.getState().reset()
  })

  it("adds 30 seconds to remaining time instead of the original duration", () => {
    render(<RestTimerBanner defaultDuration={60} />)

    act(() => {
      useRestTimerStore.getState().start(60)
    })

    act(() => {
      vi.advanceTimersByTime(20_000)
    })

    const remainingBefore = useRestTimerStore.getState().getTimeRemaining()

    fireEvent.click(screen.getByRole("button", { name: "+30s" }))

    expect(useRestTimerStore.getState().timer.duration).toBe(remainingBefore + 30)
  })

  it("toggles pause and resume while keeping paused time stable", () => {
    render(<RestTimerBanner defaultDuration={60} />)

    act(() => {
      useRestTimerStore.getState().start(60)
    })

    fireEvent.click(screen.getByRole("button", { name: "Pause" }))
    expect(screen.getByRole("button", { name: "Resume" })).toBeTruthy()

    const pausedRemaining = useRestTimerStore.getState().getTimeRemaining()
    act(() => {
      vi.advanceTimersByTime(5_000)
    })
    expect(useRestTimerStore.getState().getTimeRemaining()).toBe(pausedRemaining)

    fireEvent.click(screen.getByRole("button", { name: "Resume" }))
    expect(screen.getByRole("button", { name: "Pause" })).toBeTruthy()

    act(() => {
      vi.advanceTimersByTime(1_200)
    })
    expect(useRestTimerStore.getState().getTimeRemaining()).toBeLessThan(pausedRemaining)
  })
})
