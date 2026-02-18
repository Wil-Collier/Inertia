import { describe, expect, it } from "vitest"
import { isRecord } from "./typeGuards"

describe("isRecord", () => {
  it("accepts plain objects", () => {
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

  it("returns false for arrays", () => {
    expect(isRecord([])).toBe(false)
  })

  it("returns false for null", () => {
    expect(isRecord(null)).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isRecord(undefined)).toBe(false)
  })

  it("returns false for primitive strings", () => {
    expect(isRecord("string")).toBe(false)
  })

  it("returns false for primitive numbers", () => {
    expect(isRecord(42)).toBe(false)
  })

  it("returns false for booleans", () => {
    expect(isRecord(true)).toBe(false)
  })
})
