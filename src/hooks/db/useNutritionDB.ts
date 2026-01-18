import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/services/db"
import type { FoodItem, MealEntry } from "@/lib/types"
import { calculateNutritionTotals, calculateNutritionAverages } from "@/lib/nutritionUtils"

export interface MealEntryWithFood extends MealEntry {
  food: FoodItem | undefined
}

const EMPTY_TOTALS = { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }

/**
 * Hook for fetching a single day's nutrition data and totals.
 */
export function useDailyNutrition(date: string) {
  return useLiveQuery(async () => {
    const log = await db.nutritionLogs.get(date)
    if (!log) return { log: null, totals: EMPTY_TOTALS, entriesWithFood: [], isLoading: false }

    // Fetch foods for all entries to calculate totals
    const foodIds = [...new Set(log.entries.map((e) => e.foodId))]
    const foods = await db.foods.where("id").anyOf(foodIds).toArray()
    const foodsById = new Map(foods.map((f) => [f.id, f]))

    const entriesWithFood: MealEntryWithFood[] = log.entries.map(entry => ({
      ...entry,
      food: foodsById.get(entry.foodId)
    }))

    const totals = calculateNutritionTotals(log.entries, foodsById)

    return { log, totals, entriesWithFood, isLoading: false }
  }, [date]) ?? { log: null, totals: EMPTY_TOTALS, entriesWithFood: [], isLoading: true }
}

/**
 * Hook for nutrition history and trends.
 */
export function useNutritionHistory(startDate: string, endDate: string) {
  return useLiveQuery(async () => {
    const logs = await db.nutritionLogs
      .where("date")
      .between(startDate, endDate, true, true)
      .toArray()
    
    // Fetch all unique food IDs needed for these logs
    const foodIds = [...new Set(logs.flatMap((l) => l.entries.map((e) => e.foodId)))]
    const foods = await db.foods.where("id").anyOf(foodIds).toArray()
    const foodsById = new Map(foods.map((f) => [f.id, f]))

    const dailyTotals = logs.map((log) => {
      const totals = calculateNutritionTotals(log.entries, foodsById)
      return { date: log.date, ...totals }
    })

    const averages = calculateNutritionAverages(dailyTotals)

    return { 
      dailyTotals, 
      averages,
      isLoading: false 
    }
  }, [startDate, endDate]) ?? { dailyTotals: [], averages: EMPTY_TOTALS, isLoading: true }
}


/**
 * Hook for searching and listing foods.
 */
export function useFoodsDB(query: string = "", filter: "all" | "favorites" | "custom" = "all") {
  return useLiveQuery(async () => {
    let collection = db.foods.toCollection()

    if (filter === "favorites") {
      collection = db.foods.where("isFavorite").equals(1)
    } else if (filter === "custom") {
      collection = db.foods.where("isCustom").equals(1)
    }

    let results = await collection.toArray()

    if (query) {
      const q = query.toLowerCase()
      results = results.filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          f.brand?.toLowerCase().includes(q)
      )
    }

    return results
  }, [query, filter]) ?? []
}

/**
 * Hook for meal templates.
 */
export function useMealTemplatesDB() {
  return useLiveQuery(() => db.mealTemplates.toArray()) ?? []
}

/**
 * Hook for unique nutrition log dates.
 */
export function useNutritionDatesDB() {
  return useLiveQuery(async () => {
    try {
      const logs = await db.nutritionLogs.toArray()
      return logs.map((l) => l.date).sort()
    } catch (error) {
      console.error("Failed to fetch nutrition dates:", error)
      return []
    }
  }) ?? []
}

/**
 * Hook to get specific food items by ID.
 */
export function useFoodItems(ids: string[]) {
  return useLiveQuery(() => db.foods.where("id").anyOf(ids).toArray(), [ids]) ?? []
}
