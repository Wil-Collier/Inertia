import { describe, expect, it } from "vitest"
import { isRecord } from "@/features/sync/typeGuards"

describe("sync type guards", () => {
  it("rejects arrays as records", () => {
    expect(isRecord([])).toBe(false)
  })

  it("accepts plain objects as records", () => {
    expect(isRecord({ key: "value" })).toBe(true)
  })
})
