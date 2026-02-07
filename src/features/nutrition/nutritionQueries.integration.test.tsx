import { renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"
import { db } from "@/services/db"
import { NutritionApiError } from "@/services/nutritionApi"
import { useCombinedFoodSearch } from "@/features/nutrition/queries"

const searchFoodsMock = vi.fn()

vi.mock("@/services/nutritionApi", async () => {
  const actual = await vi.importActual("@/services/nutritionApi")
  return {
    ...actual,
    searchFoods: (...args: unknown[]) => searchFoodsMock(...args),
  }
})

describe("nutrition query hooks integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.clearAllMocks()
    searchFoodsMock.mockResolvedValue({ foods: [], hasMore: false })
  })

  it("returns local + remote combined results, preserving local data for matching IDs", async () => {
    await db.foods.bulkPut([
      {
        id: "local-only",
        name: "Local Oats",
        calories: 389,
        protein: 16.9,
        carbs: 66.3,
        fat: 6.9,
        fiber: 10.6,
        sugar: 0.9,
        servingSize: "100g",
        isCustom: true,
      },
      {
        id: "shared-id",
        name: "Shared Local",
        calories: 250,
        protein: 12,
        carbs: 30,
        fat: 8,
        fiber: 3,
        sugar: 4,
        servingSize: "100g",
        isCustom: true,
        isFavorite: true,
      },
    ])

    searchFoodsMock.mockResolvedValueOnce({
      foods: [
        {
          id: "shared-id",
          name: "Shared Remote",
          calories: 1,
          protein: 1,
          carbs: 1,
          fat: 1,
          fiber: 1,
          sugar: 1,
          servingSize: "100g",
          isCustom: false,
        },
        {
          id: "remote-only",
          name: "Remote Banana",
          calories: 89,
          protein: 1.1,
          carbs: 22.8,
          fat: 0.3,
          fiber: 2.6,
          sugar: 12.2,
          servingSize: "100g",
          isCustom: false,
        },
      ],
      hasMore: false,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useCombinedFoodSearch("lo"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(searchFoodsMock).toHaveBeenCalledWith("lo", 0, 20)
    expect(result.current.data).toMatchObject({
      remoteStatus: "ok",
    })

    expect(result.current.data?.items.map((item) => item.id)).toEqual([
      "local-only",
      "shared-id",
      "remote-only",
    ])

    const shared = result.current.data?.items.find((item) => item.id === "shared-id")
    expect(shared).toMatchObject({ name: "Shared Local", isFavorite: true })
  })

  it("keeps local results and reports remote errors when API fails", async () => {
    await db.foods.put({
      id: "local-1",
      name: "Local Rice",
      calories: 130,
      protein: 2.4,
      carbs: 28,
      fat: 0.3,
      fiber: 0.4,
      sugar: 0.1,
      servingSize: "100g",
      isCustom: true,
    })

    searchFoodsMock.mockRejectedValueOnce(new NutritionApiError("http", "Provider unavailable", { status: 503 }))

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useCombinedFoodSearch("lo"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data).toMatchObject({
      remoteStatus: "error",
      remoteError: "Provider unavailable",
    })
    expect(result.current.data?.items.map((item) => item.id)).toEqual(["local-1"])
  })

  it("returns idle behavior for short queries without calling remote API", async () => {
    await db.foods.put({
      id: "local-1",
      name: "Local Rice",
      calories: 130,
      protein: 2.4,
      carbs: 28,
      fat: 0.3,
      fiber: 0.4,
      sugar: 0.1,
      servingSize: "100g",
      isCustom: true,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useCombinedFoodSearch("l"), { wrapper })

    expect(result.current.fetchStatus).toBe("idle")
    expect(result.current.data).toBeUndefined()
    expect(searchFoodsMock).not.toHaveBeenCalled()
  })

  it("returns remote results when no local entries match", async () => {
    searchFoodsMock.mockResolvedValueOnce({
      foods: [
        {
          id: "remote-apple",
          name: "Remote Apple",
          calories: 52,
          protein: 0.3,
          carbs: 13.8,
          fat: 0.2,
          fiber: 2.4,
          sugar: 10.4,
          servingSize: "100g",
          isCustom: false,
        },
      ],
      hasMore: false,
    })

    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)
    const { result } = renderHook(() => useCombinedFoodSearch("apple"), { wrapper })

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true)
    })

    expect(result.current.data?.items.map((item) => item.id)).toEqual(["remote-apple"])
    expect(result.current.data?.remoteStatus).toBe("ok")
  })
})
