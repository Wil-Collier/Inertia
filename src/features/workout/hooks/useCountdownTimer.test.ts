import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCountdownTimer } from "@/features/workout/hooks/useCountdownTimer"

describe("useCountdownTimer", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  it("pauses and resumes countdown, calling completion once", () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useCountdownTimer({ onComplete }))

    act(() => {
      result.current.start("set-1", "exercise-1", 3)
    })

    expect(result.current.activeSetId).toBe("set-1")
    expect(result.current.timeRemaining).toBe(3)
    expect(result.current.isRunning).toBe(true)

    act(() => {
      vi.advanceTimersByTime(1000)
    })

    expect(result.current.timeRemaining).toBe(2)

    act(() => {
      result.current.pause()
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.timeRemaining).toBe(2)
    expect(result.current.isRunning).toBe(false)

    act(() => {
      result.current.resume()
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.timeRemaining).toBe(0)
    expect(result.current.activeSetId).toBeNull()
    expect(result.current.isRunning).toBe(false)
    expect(onComplete).toHaveBeenCalledTimes(1)
    expect(onComplete).toHaveBeenCalledWith("set-1", "exercise-1")
  })

  it("stops countdown and prevents completion callback", () => {
    const onComplete = vi.fn()
    const { result } = renderHook(() => useCountdownTimer({ onComplete }))

    act(() => {
      result.current.start("set-2", "exercise-2", 2)
      result.current.stop()
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.activeSetId).toBeNull()
    expect(result.current.duration).toBe(0)
    expect(result.current.timeRemaining).toBe(0)
    expect(result.current.isRunning).toBe(false)
    expect(onComplete).not.toHaveBeenCalled()
  })
})
