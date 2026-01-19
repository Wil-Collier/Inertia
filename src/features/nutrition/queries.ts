import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { FoodItem, MealEntry } from "@/lib/types"
import { calculateNutritionTotals, INITIAL_TOTALS } from "@/lib/nutritionUtils"

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
      const logs = await db.nutritionLogs.toArray()
      return logs.map((l) => l.date).sort()
    },
  })
}

