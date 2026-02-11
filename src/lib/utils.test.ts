import { describe, expect, it } from "vitest"
import { deepEqual, formatDuration } from "@/lib/utils"

describe("utils", () => {
  describe("deepEqual", () => {
    it("compares primitives", () => {
      expect(deepEqual(1, 1)).toBe(true)
      expect(deepEqual(1, 2)).toBe(false)
      expect(deepEqual("a", "a")).toBe(true)
      expect(deepEqual("a", "b")).toBe(false)
      expect(deepEqual(true, true)).toBe(true)
      expect(deepEqual(true, false)).toBe(false)
      expect(deepEqual(null, null)).toBe(true)
      expect(deepEqual(undefined, undefined)).toBe(true)
      expect(deepEqual(null, undefined)).toBe(false)
    })

    it("compares arrays", () => {
      expect(deepEqual([], [])).toBe(true)
      expect(deepEqual([1, 2], [1, 2])).toBe(true)
      expect(deepEqual([1, 2], [1, 3])).toBe(false)
      expect(deepEqual([1, 2], [1, 2, 3])).toBe(false)
    })

    it("compares objects", () => {
      expect(deepEqual({}, {})).toBe(true)
      expect(deepEqual({ a: 1 }, { a: 1 })).toBe(true)
      expect(deepEqual({ a: 1 }, { a: 2 })).toBe(false)
      expect(deepEqual({ a: 1 }, { b: 1 })).toBe(false)
      expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true)
    })

    it("compares nested structures", () => {
      const obj1 = { a: [1, { b: 2 }] }
      const obj2 = { a: [1, { b: 2 }] }
      const obj3 = { a: [1, { b: 3 }] }
      expect(deepEqual(obj1, obj2)).toBe(true)
      expect(deepEqual(obj1, obj3)).toBe(false)
    })

    it("compares dates", () => {
      const d1 = new Date("2023-01-01")
      const d2 = new Date("2023-01-01")
      const d3 = new Date("2023-01-02")
      expect(deepEqual(d1, d2)).toBe(true)
      expect(deepEqual(d1, d3)).toBe(false)
    })
  })

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
