import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useDebouncedValue } from "@/hooks/useDebouncedValue"

describe("useDebouncedValue", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps previous value until debounce delay elapses", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 300), {
      initialProps: { value: "bench" },
    })

    expect(result.current).toBe("bench")

    rerender({ value: "squat" })
    expect(result.current).toBe("bench")

    act(() => {
      vi.advanceTimersByTime(299)
    })
    expect(result.current).toBe("bench")

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(result.current).toBe("squat")
  })

  it("uses latest value when updates happen faster than the debounce window", () => {
    const { result, rerender } = renderHook(({ value }) => useDebouncedValue(value, 200), {
      initialProps: { value: 1 },
    })

    rerender({ value: 2 })
    act(() => {
      vi.advanceTimersByTime(100)
    })
    rerender({ value: 3 })

    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(result.current).toBe(3)
  })
})
