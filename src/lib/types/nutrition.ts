export interface FoodItem {
  id: string
  name: string
  brand?: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
  servingSize: string
  servingGrams?: number
  barcode?: string
  isCustom: boolean
  isFavorite?: boolean
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack"

export interface MealEntry {
  id: string
  foodId: string
  quantity: number
  mealType: MealType
}

export interface DailyNutrition {
  date: string
  entries: MealEntry[]
}

export interface NutritionGoals {
  calories: number
  protein: number
  carbs: number
  fat: number
  fiber: number
  sugar: number
}
