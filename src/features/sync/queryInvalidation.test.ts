import { beforeEach, describe, expect, it, vi } from "vitest"
import { invalidateQueriesForCollections } from "@/features/sync/queryInvalidation"
import { queryClient } from "@/lib/queryClient"

describe("queryInvalidation", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("invalidates collection queries and achievements for derived domains", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()

    invalidateQueriesForCollections(new Set(["foods", "workouts"]))

    const calls = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)

    expect(calls).toContainEqual(["foods"])
    expect(calls).toContainEqual(["workouts"])
    expect(calls).toContainEqual(["achievements"])
  })

  it("does not invalidate achievements when only non-derived collections change", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()

    invalidateQueriesForCollections(new Set(["settings"]))

    const calls = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(calls).toContainEqual(["settings"])
    expect(calls).not.toContainEqual(["achievements"])
  })

  it("invalidates meal template queries with the dedicated key", () => {
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()

    invalidateQueriesForCollections(new Set(["mealTemplates"]))

    const calls = invalidateSpy.mock.calls.map((call) => call[0]?.queryKey)
    expect(calls).toContainEqual(["foods", "meal-templates"])
    expect(calls).not.toContainEqual(["foods"])
  })
})
