import { describe, expect, it } from "vitest"
import { isRecord } from "./typeGuards"

describe("isRecord", () => {
  it("returns false for arrays", () => {
    expect(isRecord([])).toBe(false)
  })

  it("returns true for plain objects", () => {
    expect(isRecord({ key: "value" })).toBe(true)
  })
})
