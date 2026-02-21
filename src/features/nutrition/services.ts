import { db } from "@/services/db"
import {
  getProductByBarcode,
  type NutritionProviderName,
} from "@/services/nutritionApi"
import type { FoodItem } from "@/lib/types"

export type { NutritionProviderName }

/**
 * Resolve food records in one query and return a map by ID for fast lookups.
 */
export async function getFoodsByIds(foodIds: string[]): Promise<Map<string, FoodItem>> {
  if (foodIds.length === 0) {
    return new Map()
  }

  const foods = await db.foods.where("id").anyOf(foodIds).toArray()
  return new Map(foods.map((food) => [food.id, food]))
}

/**
 * Keep remote search results durable locally before adding meal/template entries.
 */
export async function ensureFoodExistsInLocalDb(
  food: FoodItem,
  addFood: (food: Omit<FoodItem, "id"> & { id?: string }) => Promise<FoodItem>
): Promise<void> {
  if (food.isCustom) {
    return
  }

  const existing = await db.foods.get(food.id)
  if (!existing) {
    await addFood({ ...food, isCustom: false })
  }
}

export async function lookupFoodByBarcode(barcode: string): Promise<FoodItem | null> {
  return await getProductByBarcode(barcode)
}
