import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { useAddWeightEntry, useDeleteWeightEntry } from "@/features/bodyweight/mutations"
import { queryKeys } from "@/lib/queryKeys"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe("bodyweight hooks integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.restoreAllMocks()
  })

  it("adds a weight entry and invalidates bodyweight queries", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()

    const { result } = renderHook(() => useAddWeightEntry(), { wrapper })

    let createdId = ""
    await act(async () => {
      const created = await result.current.mutateAsync({ date: "2026-02-08", weight: 180.4 })
      createdId = created.id
    })

    const saved = await db.bodyWeight.get(createdId)
    expect(saved).toMatchObject({ date: "2026-02-08", weight: 180.4 })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.bodyWeight.all })
  })

  it("deletes a weight entry and invalidates queries", async () => {
    await db.bodyWeight.put({ id: "w-1", date: "2026-02-08", weight: 180 })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries").mockResolvedValue()

    const { result } = renderHook(() => useDeleteWeightEntry(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync("w-1")
    })

    expect(await db.bodyWeight.get("w-1")).toBeUndefined()
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: queryKeys.bodyWeight.all })
  })
})
