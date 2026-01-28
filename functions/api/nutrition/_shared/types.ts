/**
 * Normalized food item shape returned by all nutrition providers.
 * Matches the FoodItem interface in the frontend.
 */
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
}

export interface SearchResponse {
  items: FoodItem[]
  provider: "openfoodfacts" | "fatsecret"
  page: number
  hasMore: boolean
}

export interface BarcodeResponse {
  item: FoodItem
  provider: "openfoodfacts" | "fatsecret"
}

export interface Env {
  NUTRITION_PROVIDER?: "openfoodfacts" | "fatsecret"
  FAT_SECRET_CLIENT_ID?: string
  FAT_SECRET_CLIENT_SECRET?: string
}

export interface NutritionProvider {
  search(
    query: string,
    page: number,
    limit: number,
    options?: { region?: string; language?: string }
  ): Promise<{ items: FoodItem[]; hasMore: boolean }>
  lookupBarcode(code: string): Promise<FoodItem | null>
}
