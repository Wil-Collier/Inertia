import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { db } from "@/services/db"
import { useExercises } from "@/features/exercises/queries"
import { useNutritionHistory } from "@/features/nutrition/queries"
import { useWorkouts } from "@/features/workout/queries"

describe("feature query integration", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("returns workouts sorted newest-first", async () => {
    await db.workoutSessions.bulkPut([
      { id: "w1", name: "Old", date: "2026-02-01", weightUnit: "kg", exercises: [] },
      { id: "w2", name: "New", date: "2026-02-08", weightUnit: "kg", exercises: [] },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useWorkouts(20), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.map((w) => w.id)).toEqual(["w2", "w1"])
  })

  it("merges default and custom exercises", async () => {
    await db.customExercises.put({
      id: "custom-1",
      name: "My Pushup",
      muscleGroup: "chest",
      isCustom: true,
      isWeighted: false,
      isTimeBased: false,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useExercises(), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.some((exercise) => exercise.id === "custom-1")).toBe(true)
    expect((result.current.data?.length ?? 0) > 1).toBe(true)
  })

  it("computes nutrition history daily totals and averages", async () => {
    await db.foods.put({
      id: "food-1",
      name: "Rice",
      calories: 100,
      protein: 5,
      carbs: 20,
      fat: 1,
      fiber: 2,
      sugar: 0,
      servingSize: "100g",
      isCustom: true,
    })

    await db.nutritionLogs.bulkPut([
      { date: "2026-02-01", entries: [{ id: "e1", foodId: "food-1", quantity: 1, mealType: "lunch", updatedAt: 1 }] },
      { date: "2026-02-02", entries: [{ id: "e2", foodId: "food-1", quantity: 2, mealType: "dinner", updatedAt: 1 }] },
    ])

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useNutritionHistory("2026-02-01", "2026-02-03"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.dailyTotals).toHaveLength(2)
    expect(result.current.data?.averages.calories).toBe(150)
  })
})
