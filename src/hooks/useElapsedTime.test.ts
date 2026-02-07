import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useElapsedTime } from "@/hooks/useElapsedTime"

describe("useElapsedTime", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-07T12:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("computes elapsed seconds and updates every second", () => {
    const { result } = renderHook(() =>
      useElapsedTime({ startedAt: "2026-02-07T11:58:30.000Z" })
    )

    expect(result.current.elapsedSeconds).toBe(90)
    expect(result.current.formattedTime).toBe("1:30")

    act(() => {
      vi.advanceTimersByTime(2000)
    })

    expect(result.current.elapsedSeconds).toBe(92)
    expect(result.current.formattedTime).toBe("1:32")
  })

  it("returns zero time when startedAt is invalid", () => {
    const { result } = renderHook(() =>
      useElapsedTime({ startedAt: "not-a-date" })
    )

    expect(result.current.elapsedSeconds).toBe(0)
    expect(result.current.formattedTime).toBe("0:00")
  })

  it("formats values with hours when elapsed time exceeds one hour", () => {
    const { result } = renderHook(() =>
      useElapsedTime({ startedAt: "2026-02-07T10:59:01.000Z" })
    )

    expect(result.current.formattedTime).toBe("1:00:59")
  })
})
