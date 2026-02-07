import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { db } from "@/services/db"
import {
  useAddFood,
  useAddMealEntry,
  useApplyMealTemplate,
  useDeleteMealTemplate,
  useDeleteFood,
  useRemoveMealEntry,
  useRemoveMealEntryGroup,
  useSaveMealTemplate,
  useToggleFavoriteFood,
  useUpdateMealTemplate,
  useUpdateMealEntry,
} from "@/features/nutrition/mutations"
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

  it("updates meal entry food and keeps usage counts consistent", async () => {
    await db.foods.bulkPut([
      {
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
      },
      {
        id: "food-2",
        name: "Chicken",
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        fiber: 0,
        sugar: 0,
        servingSize: "100g",
        isCustom: true,
        usageCount: 0,
      },
    ])

    await db.nutritionLogs.put({
      date: "2026-02-08",
      entries: [{ id: "entry-1", foodId: "food-1", quantity: 1, mealType: "dinner" }],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useUpdateMealEntry(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        date: "2026-02-08",
        entryId: "entry-1",
        updates: { foodId: "food-2" },
      })
    })

    const log = await db.nutritionLogs.get("2026-02-08")
    expect(log?.entries[0]?.foodId).toBe("food-2")
    expect((await db.foods.get("food-1"))?.usageCount).toBe(0)
    expect((await db.foods.get("food-2"))?.usageCount).toBe(1)
  })

  it("toggles favorite for existing local foods", async () => {
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
      isFavorite: false,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useToggleFavoriteFood(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ id: "food-1", isFavorite: true })
    })

    expect((await db.foods.get("food-1"))?.isFavorite).toBe(true)
  })

  it("upserts missing food when toggling favorite from search result", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useToggleFavoriteFood(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        id: "remote-1",
        isFavorite: true,
        food: {
          id: "remote-1",
          name: "Remote Oats",
          calories: 389,
          protein: 16.9,
          carbs: 66.3,
          fat: 6.9,
          fiber: 10.6,
          sugar: 0.9,
          servingSize: "100g",
          isCustom: false,
        },
      })
    })

    expect(await db.foods.get("remote-1")).toMatchObject({
      isFavorite: true,
      isCustom: false,
      name: "Remote Oats",
    })
  })

  it("applies a meal template with grouping metadata and increments usage counts", async () => {
    await db.foods.bulkPut([
      {
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
      },
      {
        id: "food-2",
        name: "Chicken",
        calories: 165,
        protein: 31,
        carbs: 0,
        fat: 3.6,
        fiber: 0,
        sugar: 0,
        servingSize: "100g",
        isCustom: true,
        usageCount: 2,
      },
    ])

    await db.mealTemplates.put({
      id: "template-1",
      name: "Lunch Stack",
      entries: [
        { foodId: "food-1", quantity: 1, mealType: "breakfast" },
        { foodId: "food-2", quantity: 2, mealType: "breakfast" },
      ],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useApplyMealTemplate(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({
        templateId: "template-1",
        date: "2026-02-09",
        mealType: "lunch",
      })
    })

    const log = await db.nutritionLogs.get("2026-02-09")
    expect(log?.entries).toHaveLength(2)
    expect(log?.entries.every((entry) => entry.templateId === "template-1")).toBe(true)
    expect(log?.entries.every((entry) => entry.templateName === "Lunch Stack")).toBe(true)
    expect(log?.entries.every((entry) => entry.mealType === "lunch")).toBe(true)
    expect(log?.entries[0]?.templateInstanceId).toBeTruthy()
    expect(log?.entries[0]?.templateInstanceId).toBe(log?.entries[1]?.templateInstanceId)

    expect((await db.foods.get("food-1"))?.usageCount).toBe(1)
    expect((await db.foods.get("food-2"))?.usageCount).toBe(3)
  })

  it("removes all entries in a template group", async () => {
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
      usageCount: 3,
    })

    await db.nutritionLogs.put({
      date: "2026-02-09",
      entries: [
        { id: "a", foodId: "food-1", quantity: 1, mealType: "lunch", templateInstanceId: "group-1" },
        { id: "b", foodId: "food-1", quantity: 1, mealType: "lunch", templateInstanceId: "group-1" },
        { id: "c", foodId: "food-1", quantity: 1, mealType: "dinner", templateInstanceId: "group-2" },
      ],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useRemoveMealEntryGroup(), { wrapper })

    await act(async () => {
      await result.current.mutateAsync({ date: "2026-02-09", templateInstanceId: "group-1" })
    })

    const log = await db.nutritionLogs.get("2026-02-09")
    expect(log?.entries.map((entry) => entry.id)).toEqual(["c"])
    expect((await db.foods.get("food-1"))?.usageCount).toBe(1)
  })

  it("falls back to full log scan for delete checks when usageCount is missing", async () => {
    await db.foods.put({
      id: "food-legacy",
      name: "Legacy Food",
      calories: 100,
      protein: 10,
      carbs: 10,
      fat: 2,
      fiber: 1,
      sugar: 1,
      servingSize: "100g",
      isCustom: true,
    })
    await db.nutritionLogs.put({
      date: "2026-02-10",
      entries: [{ id: "legacy-entry", foodId: "food-legacy", quantity: 1, mealType: "dinner" }],
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useDeleteFood(), { wrapper })

    await act(async () => {
      await expect(result.current.mutateAsync("food-legacy")).rejects.toThrow(
        "Cannot delete food that is used in meal entries. Remove the entries first."
      )
    })
  })

  it("adds foods with generated or caller-provided ids", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useAddFood(), { wrapper })

    let generatedId = ""
    await act(async () => {
      const generated = await result.current.mutateAsync({
        name: "Generated",
        calories: 50,
        protein: 1,
        carbs: 10,
        fat: 0,
        fiber: 1,
        sugar: 5,
        servingSize: "100g",
        isCustom: true,
      })
      generatedId = generated.id
    })
    expect(generatedId).toBeTruthy()
    expect(await db.foods.get(generatedId)).toBeTruthy()

    await act(async () => {
      await result.current.mutateAsync({
        id: "canonical-food",
        name: "Canonical",
        calories: 120,
        protein: 6,
        carbs: 18,
        fat: 2,
        fiber: 3,
        sugar: 2,
        servingSize: "100g",
        isCustom: false,
      })
    })
    expect((await db.foods.get("canonical-food"))?.name).toBe("Canonical")
  })

  it("supports meal template save, update, and delete lifecycle", async () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    const saveHook = renderHook(() => useSaveMealTemplate(), { wrapper })
    const updateHook = renderHook(() => useUpdateMealTemplate(), { wrapper })
    const deleteHook = renderHook(() => useDeleteMealTemplate(), { wrapper })

    let templateId = ""
    await act(async () => {
      templateId = await saveHook.result.current.mutateAsync({
        name: "Work Lunch",
        entries: [{ foodId: "food-1", quantity: 1, mealType: "lunch" }],
      })
    })

    expect((await db.mealTemplates.get(templateId))?.name).toBe("Work Lunch")

    await act(async () => {
      await updateHook.result.current.mutateAsync({
        id: templateId,
        name: "Updated Lunch",
        entries: [{ foodId: "food-2", quantity: 2, mealType: "dinner" }],
      })
    })

    expect((await db.mealTemplates.get(templateId))?.entries[0]?.foodId).toBe("food-2")

    await act(async () => {
      await deleteHook.result.current.mutateAsync(templateId)
    })

    expect(await db.mealTemplates.get(templateId)).toBeUndefined()
  })
})
