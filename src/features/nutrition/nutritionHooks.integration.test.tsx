import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { db } from "@/services/db"
import { useAddMealEntry, useDeleteFood, useRemoveMealEntry } from "@/features/nutrition/mutations"
import { achievementService } from "@/services/achievementService"

let updateStreaksSpy: MockInstance<() => Promise<void>>
let checkNutritionAchievementsSpy: MockInstance<() => Promise<void>>

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

describe("nutrition hooks integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.restoreAllMocks()
    updateStreaksSpy = vi.spyOn(achievementService, "updateStreaks").mockResolvedValue()
    checkNutritionAchievementsSpy = vi.spyOn(achievementService, "checkNutritionAchievements").mockResolvedValue()
  })

  it("adds meal entry, creates daily log, and increments usage count", async () => {
    await db.foods.put({
      id: "food-1",
      name: "Rice",
      calories: 130,
      protein: 2.4,
      carbs: 28,
      fat: 0.3,
      fiber: 0.4,
      sugar: 0.1,
      servingSize: "100g",
      isCustom: true,
      usageCount: 0,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useAddMealEntry(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        date: "2026-02-08",
        foodId: "food-1",
        quantity: 2,
        mealType: "lunch",
      })
    })

    const log = await db.nutritionLogs.get("2026-02-08")
    const food = await db.foods.get("food-1")

    expect(log?.entries).toHaveLength(1)
    expect(food?.usageCount).toBe(1)
    expect(updateStreaksSpy).toHaveBeenCalled()
    expect(checkNutritionAchievementsSpy).toHaveBeenCalled()
  })

  it("removes meal entry and decrements usage count", async () => {
    await db.foods.put({
      id: "food-1",
      name: "Rice",
      calories: 130,
      protein: 2.4,
      carbs: 28,
      fat: 0.3,
      fiber: 0.4,
      sugar: 0.1,
      servingSize: "100g",
      isCustom: true,
      usageCount: 1,
    })
    await db.nutritionLogs.put({
      date: "2026-02-08",
      entries: [{ id: "entry-1", foodId: "food-1", quantity: 1, mealType: "dinner" }],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useRemoveMealEntry(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ date: "2026-02-08", entryId: "entry-1" })
    })

    expect(await db.nutritionLogs.get("2026-02-08")).toBeUndefined()
    expect((await db.foods.get("food-1"))?.usageCount).toBe(0)
  })

  it("blocks deleting food that is still referenced by meal entries", async () => {
    await db.foods.put({
      id: "food-1",
      name: "Rice",
      calories: 130,
      protein: 2.4,
      carbs: 28,
      fat: 0.3,
      fiber: 0.4,
      sugar: 0.1,
      servingSize: "100g",
      isCustom: true,
      usageCount: 1,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useDeleteFood(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync("food-1")).rejects.toThrow(
        "Cannot delete food that is used in meal entries. Remove the entries first."
      )
    })

    expect(await db.foods.get("food-1")).toBeTruthy()
  })
})
