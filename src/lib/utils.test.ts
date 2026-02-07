import { describe, expect, it } from "vitest"
import { formatDuration } from "@/lib/utils"

describe("utils", () => {
  it("formats durations as MM:SS", () => {
    expect(formatDuration(0)).toBe("0:00")
    expect(formatDuration(65)).toBe("1:05")
    expect(formatDuration(599)).toBe("9:59")
  })

  it("clamps negative and non-integer durations", () => {
    expect(formatDuration(-10)).toBe("0:00")
    expect(formatDuration(90.9)).toBe("1:30")
  })
})
