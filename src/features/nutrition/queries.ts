import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import { searchFoods, NutritionApiError } from "@/services/nutritionApi"
import type { FoodItem, MealEntry } from "@/lib/types"
import { calculateNutritionTotals, calculateNutritionAverages, INITIAL_TOTALS } from "@/lib/nutritionUtils"
import { orderedUniqueStringKeys } from "@/lib/indexedDbUtils"

export interface MealEntryWithFood extends MealEntry {
  food: FoodItem | undefined
}

export interface CombinedFoodSearchResult {
  items: FoodItem[]
  remoteStatus: "idle" | "ok" | "error"
  remoteError?: string
}

export function useDailyNutrition(date: string) {
  return useQuery({
    queryKey: queryKeys.nutrition.daily(date),
    queryFn: async () => {
      const log = await db.nutritionLogs.get(date)
      if (!log) return { log: null, totals: INITIAL_TOTALS, entriesWithFood: [] }

      const foodIds = [...new Set(log.entries.map((e) => e.foodId))]
      const foods = await db.foods.where("id").anyOf(foodIds).toArray()
      const foodsById = new Map(foods.map((f) => [f.id, f]))

      const totals = calculateNutritionTotals(log.entries, foodsById)
      const entriesWithFood: MealEntryWithFood[] = log.entries.map(entry => ({
        ...entry,
        food: foodsById.get(entry.foodId)
      }))

      return { log, totals, entriesWithFood }
    },
    enabled: !!date,
  })
}

export function useFoods() {
  return useQuery({
    queryKey: queryKeys.foods.list(),
    queryFn: async () => {
      return db.foods.toArray()
    },
  })
}

export function useFavoriteFoods() {
  return useQuery({
    queryKey: queryKeys.foods.favorites(),
    queryFn: async () => {
      return db.foods
        .filter((food) => !!food.isFavorite)
        .toArray()
    },
  })
}

export function useCustomFoods() {
  return useQuery({
    queryKey: [...queryKeys.foods.all, "custom"],
    queryFn: async () => {
      return db.foods
        .filter((food) => !!food.isCustom)
        .toArray()
    },
  })
}

export function useMealTemplates() {
  return useQuery({
    queryKey: [...queryKeys.foods.all, "meal-templates"],
    queryFn: async () => {
      return db.mealTemplates.toArray()
    },
  })
}

export function useFoodSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.foods.search(query),
    queryFn: async () => {
      if (query.length < 2) return []

      const lowerQuery = query.toLowerCase()
      return db.foods
        .filter(
          (food) =>
            food.name.toLowerCase().includes(lowerQuery) ||
            (food.brand?.toLowerCase().includes(lowerQuery) ?? false)
        )
        .limit(20)
        .toArray()
    },
    enabled: query.length >= 2,
  })
}

export function useNutritionDates() {
  return useQuery({
    queryKey: [...queryKeys.nutrition.all, "dates"],
    queryFn: async () => {
      // Avoid uniqueKeys() on Safari (can throw "Unable to open cursor").
      const keys = await db.nutritionLogs.orderBy("date").keys()
      return orderedUniqueStringKeys(keys)
    },
  })
}

/**
 * Fetch nutrition history for a date range.
 * Returns daily totals and computed averages for the period.
 */
export function useNutritionHistory(startDate: string, endDate: string) {
  return useQuery({
    queryKey: queryKeys.nutrition.range(startDate, endDate),
    queryFn: async () => {
      const logs = await db.nutritionLogs
        .where("date")
        .between(startDate, endDate, true, true)
        .toArray()

      const foodIds = [...new Set(logs.flatMap((l) => l.entries.map((e) => e.foodId)))]
      const foods = await db.foods.where("id").anyOf(foodIds).toArray()
      const foodsById = new Map(foods.map((f) => [f.id, f]))

      const dailyTotals = logs.map((log) => {
        const totals = calculateNutritionTotals(log.entries, foodsById)
        return { date: log.date, ...totals }
      })

      const averages = calculateNutritionAverages(dailyTotals)

      return { dailyTotals, averages }
    },
    enabled: !!startDate && !!endDate,
  })
}

/**
 * Combined food search hook that queries both local database and remote API.
 * This should be used instead of directly accessing db.foods for consistency.
 */
export function useCombinedFoodSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.foods.combinedSearch(query),
    queryFn: async () => {
      if (query.length < 2) {
        const empty: CombinedFoodSearchResult = { items: [], remoteStatus: "idle" }
        return empty
      }

      const lowerQuery = query.toLowerCase()

      // Search local database first
      const local = await db.foods
        .filter(
          (food) =>
            food.name.toLowerCase().includes(lowerQuery) ||
            (food.brand?.toLowerCase().includes(lowerQuery) ?? false)
        )
        .limit(20)
        .toArray()

      // Then search remote API (but keep local results even if remote fails)
      let remote: FoodItem[] = []
      let remoteStatus: CombinedFoodSearchResult["remoteStatus"] = "ok"
      let remoteError: string | undefined

      try {
        // Use page 0 (0-indexed) for the API
        const res = await searchFoods(query, 0, 20)
        remote = res.foods
      } catch (error) {
        remoteStatus = "error"
        if (error instanceof NutritionApiError) {
          remoteError = error.message
        } else {
          remoteError = error instanceof Error ? error.message : String(error)
        }
      }

      // Fetch any local versions of the remote results (by ID)
      const remoteIds = remote.map(f => f.id)
      const existingLocal = await db.foods.where("id").anyOf(remoteIds).toArray()
      const existingLocalMap = new Map(existingLocal.map(f => [f.id, f]))

      // To prevent jumping when favoriting, we want to maintain a stable order.
      // We'll prioritize the order from the remote API for items that exist there,
      // and put local-only items (like custom foods) at the top.

      const remoteIdSet = new Set(remoteIds)
      const localOnly = local.filter(l => !remoteIdSet.has(l.id))

      const mappedRemote = remote.map(remoteFood => {
        // Use the local version if it exists (to get isFavorite, etc.)
        return existingLocalMap.get(remoteFood.id) || remoteFood
      })

      return {
        items: [...localOnly, ...mappedRemote],
        remoteStatus,
        remoteError,
      } satisfies CombinedFoodSearchResult
    },
    enabled: query.length >= 2,
    staleTime: 30_000, // Cache results for 30 seconds
  })
}
