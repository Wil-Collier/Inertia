export interface OpenFoodFactsProductLike {
  code?: string
  product_name?: string
  brands?: string
  nutriments?: {
    "energy-kcal_100g"?: number
    "energy-kcal_serving"?: number
    proteins_100g?: number
    proteins_serving?: number
    carbohydrates_100g?: number
    carbohydrates_serving?: number
    fat_100g?: number
    fat_serving?: number
    fiber_100g?: number
    fiber_serving?: number
    sugars_100g?: number
    sugars_serving?: number
  }
  serving_size?: string
  serving_quantity?: number | string
}

export interface NormalizedOpenFoodFactsFood {
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
  isCustom: false
}

function parseServingQuantity(value: unknown): number | undefined {
  if (typeof value === "number") return value
  if (typeof value === "string") {
    const parsed = Number.parseFloat(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

export function normalizeOpenFoodFactsProduct(
  product: OpenFoodFactsProductLike
): NormalizedOpenFoodFactsFood | null {
  if (!product.product_name) return null

  const nutriments = product.nutriments ?? {}
  const hasServing = nutriments["energy-kcal_serving"] !== undefined
  const servingSize = product.serving_size || "100g"

  const calories = hasServing
    ? nutriments["energy-kcal_serving"] ?? 0
    : nutriments["energy-kcal_100g"] ?? 0

  const protein = hasServing
    ? nutriments.proteins_serving ?? 0
    : nutriments.proteins_100g ?? 0

  const carbs = hasServing
    ? nutriments.carbohydrates_serving ?? 0
    : nutriments.carbohydrates_100g ?? 0

  const fat = hasServing
    ? nutriments.fat_serving ?? 0
    : nutriments.fat_100g ?? 0

  const fiber = hasServing
    ? nutriments.fiber_serving ?? 0
    : nutriments.fiber_100g ?? 0

  const sugar = hasServing
    ? nutriments.sugars_serving ?? 0
    : nutriments.sugars_100g ?? 0

  const servingQuantity = parseServingQuantity(product.serving_quantity)

  return {
    id: product.code || crypto.randomUUID(),
    name: product.product_name,
    brand: product.brands,
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    servingSize: hasServing ? servingSize : "100g",
    servingGrams: servingQuantity ?? 100,
    barcode: product.code,
    isCustom: false,
  }
}

