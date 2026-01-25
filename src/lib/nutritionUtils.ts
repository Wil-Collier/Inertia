import type { MealEntry, FoodItem, NutritionTotals } from "@/lib/types"

export const INITIAL_TOTALS: NutritionTotals = {
  calories: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  sugar: 0
}

/**
 * Calculates total nutrition for a list of meal entries.
 */
export function calculateNutritionTotals(
  entries: { foodId: string; quantity: number }[],
  foodsById: Map<string, FoodItem>
): NutritionTotals {
  const raw = entries.reduce((acc, entry) => {
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
  }, { ...INITIAL_TOTALS })

  // Round results to avoid floating-point precision errors
  return {
    calories: Math.round(raw.calories),
    protein: Math.round(raw.protein * 10) / 10,
    carbs: Math.round(raw.carbs * 10) / 10,
    fat: Math.round(raw.fat * 10) / 10,
    fiber: Math.round(raw.fiber * 10) / 10,
    sugar: Math.round(raw.sugar * 10) / 10,
  }
}

/**
 * Calculates average nutrition from a list of daily totals.
 */
export function calculateNutritionAverages(
  dailyTotals: (NutritionTotals & { date: string })[]
): NutritionTotals {
  const daysWithData = dailyTotals.filter((d) => d.calories > 0)

  if (daysWithData.length === 0) {
    return { ...INITIAL_TOTALS }
  }

  const rawAverages = daysWithData.reduce(
    (acc, day) => ({
      calories: acc.calories + day.calories / daysWithData.length,
      protein: acc.protein + day.protein / daysWithData.length,
      carbs: acc.carbs + day.carbs / daysWithData.length,
      fat: acc.fat + day.fat / daysWithData.length,
      fiber: acc.fiber + day.fiber / daysWithData.length,
      sugar: acc.sugar + day.sugar / daysWithData.length,
    }),
    { ...INITIAL_TOTALS }
  )

  // Round results
  return {
    calories: Math.round(rawAverages.calories),
    protein: Math.round(rawAverages.protein),
    carbs: Math.round(rawAverages.carbs),
    fat: Math.round(rawAverages.fat),
    fiber: Math.round(rawAverages.fiber),
    sugar: Math.round(rawAverages.sugar),
  }
}
