import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import { searchFoods } from "@/services/openFoodFacts"
import type { FoodItem, MealEntry } from "@/lib/types"
import { calculateNutritionTotals, calculateNutritionAverages, INITIAL_TOTALS } from "@/lib/nutritionUtils"

export interface MealEntryWithFood extends MealEntry {
  food: FoodItem | undefined
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
        .limit(50)
        .toArray()
    },
    enabled: query.length >= 2,
  })
}

export function useNutritionDates() {
  return useQuery({
    queryKey: [...queryKeys.nutrition.all, "dates"],
    queryFn: async () => {
      // Use uniqueKeys() for efficient date retrieval without loading full objects
      const dates = await db.nutritionLogs.orderBy("date").uniqueKeys()
      return dates as string[]
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
 * Combined food search hook that queries both local database and OpenFoodFacts API.
 * This should be used instead of directly accessing db.foods for consistency.
 */
export function useCombinedFoodSearch(query: string) {
  return useQuery({
    queryKey: queryKeys.foods.combinedSearch(query),
    queryFn: async () => {
      if (query.length < 2) return []

      const lowerQuery = query.toLowerCase()

      // Search local database first
      const local = await db.foods
        .filter(
          (food) =>
            food.name.toLowerCase().includes(lowerQuery) ||
            (food.brand?.toLowerCase().includes(lowerQuery) ?? false)
        )
        .limit(50)
        .toArray()

      // Then search OpenFoodFacts API
      const { foods: remote } = await searchFoods(query, 1, 20)

      // Combine and dedupe (local foods take precedence)
      const localBarcodes = new Set(local.filter(f => f.barcode).map(f => f.barcode))
      const uniqueRemote = remote.filter(r => !localBarcodes.has(r.barcode))

      return [...local, ...uniqueRemote]
    },
    enabled: query.length >= 2,
    staleTime: 30_000, // Cache results for 30 seconds
  })
}

