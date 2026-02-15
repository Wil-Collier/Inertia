import { describe, expect, it } from "vitest"
import { jsonDeepEqual } from "@/features/sync/jsonUtils"

describe("jsonDeepEqual", () => {
  it("treats objects with different key ordering as equal when sortKeys is enabled", () => {
    const left = { b: 2, a: 1, nested: { y: 2, x: 1 } }
    const right = { a: 1, b: 2, nested: { x: 1, y: 2 } }

    expect(jsonDeepEqual(left, right, { sortKeys: true })).toBe(true)
  })

  it("ignores top-level updatedAt when requested", () => {
    const left = { id: "food-1", updatedAt: 1000, calories: 200 }
    const right = { id: "food-1", updatedAt: 2000, calories: 200 }

    expect(jsonDeepEqual(left, right, { sortKeys: true, stripTopLevelUpdatedAt: true })).toBe(true)
    expect(jsonDeepEqual(left, right, { sortKeys: true, stripTopLevelUpdatedAt: false })).toBe(false)
  })

  it("treats undefined object properties consistently", () => {
    const left = { id: "entry-1", note: undefined }
    const right = { id: "entry-1" }

    expect(jsonDeepEqual(left, right, { sortKeys: true })).toBe(true)
  })
})
