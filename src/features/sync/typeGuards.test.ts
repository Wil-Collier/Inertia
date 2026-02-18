import { describe, expect, it } from "vitest"
import { isRecord } from "@/features/sync/typeGuards"

describe("sync type guards", () => {
  describe("isRecord", () => {
    it("accepts plain objects as records", () => {
      expect(isRecord({ key: "value" })).toBe(true)
    })

    it("accepts empty plain objects", () => {
      expect(isRecord({})).toBe(true)
    })

    it("accepts Date instances (object, non-null, non-array)", () => {
      expect(isRecord(new Date())).toBe(true)
    })

    it("accepts Map instances (object, non-null, non-array)", () => {
      expect(isRecord(new Map())).toBe(true)
    })

    it("accepts class instances (object, non-null, non-array)", () => {
      // Use a built-in class instance to avoid the no-extraneous-class lint rule
      expect(isRecord(new Date())).toBe(true)
    })

    it("rejects arrays", () => {
      expect(isRecord([])).toBe(false)
    })

    it("rejects null", () => {
      expect(isRecord(null)).toBe(false)
    })

    it("rejects undefined", () => {
      expect(isRecord(undefined)).toBe(false)
    })

    it("rejects primitive strings", () => {
      expect(isRecord("string")).toBe(false)
    })

    it("rejects primitive numbers", () => {
      expect(isRecord(42)).toBe(false)
    })

    it("rejects booleans", () => {
      expect(isRecord(true)).toBe(false)
    })
  })
})
