import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/services/db"
import type { FoodItem, MealEntry } from "@/lib/types"

export interface MealEntryWithFood extends MealEntry {
  food: FoodItem | undefined
}

/**
 * Hook for fetching a single day's nutrition data and totals.
 */
export function useDailyNutrition(date: string) {
  return useLiveQuery(async () => {
    const log = await db.nutritionLogs.get(date)
    if (!log) return { log: null, totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }, entriesWithFood: [], isLoading: false }

    // Fetch foods for all entries to calculate totals
    const foodIds = [...new Set(log.entries.map((e) => e.foodId))]
    const foods = await db.foods.where("id").anyOf(foodIds).toArray()
    const foodsById = new Map(foods.map((f) => [f.id, f]))

    const entriesWithFood: MealEntryWithFood[] = log.entries.map(entry => ({
      ...entry,
      food: foodsById.get(entry.foodId)
    }))

    const totals = log.entries.reduce(
      (acc, entry) => {
        const food = foodsById.get(entry.foodId)
        if (!food) return acc
        return {
          calories: acc.calories + food.calories * entry.quantity,
          protein: acc.protein + food.protein * entry.quantity,
          carbs: acc.carbs + food.carbs * entry.quantity,
          fat: acc.fat + food.fat * entry.quantity,
          fiber: acc.fiber + (food.fiber ?? 0) * entry.quantity,
          sugar: acc.sugar + (food.sugar ?? 0) * entry.quantity,
        }
      },
      { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
    )

    return { log, totals, entriesWithFood, isLoading: false }
  }, [date]) ?? { log: null, totals: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }, entriesWithFood: [], isLoading: true }
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
      const totals = log.entries.reduce(
        (acc, entry) => {
          const food = foodsById.get(entry.foodId)
          if (!food) return acc
          return {
            calories: acc.calories + food.calories * entry.quantity,
            protein: acc.protein + food.protein * entry.quantity,
            carbs: acc.carbs + food.carbs * entry.quantity,
            fat: acc.fat + food.fat * entry.quantity,
            fiber: acc.fiber + (food.fiber ?? 0) * entry.quantity,
            sugar: acc.sugar + (food.sugar ?? 0) * entry.quantity,
          }
        },
        { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
      )
      return { date: log.date, ...totals }
    })

    const daysWithData = dailyTotals.filter((d) => d.calories > 0)
    const averages = daysWithData.length > 0 
      ? daysWithData.reduce(
          (acc, day) => ({
            calories: acc.calories + day.calories / daysWithData.length,
            protein: acc.protein + day.protein / daysWithData.length,
            carbs: acc.carbs + day.carbs / daysWithData.length,
            fat: acc.fat + day.fat / daysWithData.length,
            fiber: acc.fiber + day.fiber / daysWithData.length,
            sugar: acc.sugar + day.sugar / daysWithData.length,
          }),
          { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }
        )
      : { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }

    return { 
      dailyTotals, 
      averages: {
        calories: Math.round(averages.calories),
        protein: Math.round(averages.protein),
        carbs: Math.round(averages.carbs),
        fat: Math.round(averages.fat),
        fiber: Math.round(averages.fiber),
        sugar: Math.round(averages.sugar),
      },
      isLoading: false 
    }
  }, [startDate, endDate]) ?? { dailyTotals: [], averages: { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0 }, isLoading: true }
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
    const logs = await db.nutritionLogs.toArray()
    return logs.map((l) => l.date).sort()
  }) ?? []
}

/**
 * Hook to get specific food items by ID.
 */
export function useFoodItems(ids: string[]) {
  return useLiveQuery(() => db.foods.where("id").anyOf(ids).toArray(), [ids]) ?? []
}
