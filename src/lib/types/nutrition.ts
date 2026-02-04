import type { Syncable, SyncableWithId } from "./syncable"

export interface FoodItem extends SyncableWithId {
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
  /**
   * Number of times this food has been logged (meal entries).
   * Used to optimize deletion checks.
   * If undefined, requires a full table scan to verify usage.
   */
  usageCount?: number
}

export type MealType = "breakfast" | "lunch" | "dinner" | "snack"

export interface MealEntry {
  id: string
  foodId: string
  quantity: number
  mealType: MealType
  templateId?: string
  templateInstanceId?: string
  templateName?: string
}

export interface DailyNutrition extends Syncable {
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

export interface MealTemplate extends SyncableWithId {
  name: string
  entries: Omit<MealEntry, "id">[]
}

/**
 * Represents actual nutrition values consumed.
 * Intentionally aliased to NutritionGoals since both share the same shape,
 * but kept separate for semantic clarity (goals vs. actuals).
 */
export type NutritionTotals = NutritionGoals
