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

function resolveNutrientValue(
  servingValue: number | undefined,
  valuePer100g: number | undefined,
  servingScale: number
): number {
  if (servingValue !== undefined) return servingValue
  if (valuePer100g !== undefined) return valuePer100g * servingScale
  return 0
}

export function normalizeOpenFoodFactsProduct(
  product: OpenFoodFactsProductLike
): NormalizedOpenFoodFactsFood | null {
  if (!product.product_name) return null

  const nutriments = product.nutriments ?? {}
  const servingQuantity = parseServingQuantity(product.serving_quantity)
  const servingScale =
    servingQuantity !== undefined && servingQuantity > 0
      ? servingQuantity / 100
      : 1

  // Per-field serving detection: use the _serving variant if it exists for that field,
  // otherwise fall back to the _100g variant.
  const calories = resolveNutrientValue(
    nutriments["energy-kcal_serving"],
    nutriments["energy-kcal_100g"],
    servingScale
  )
  const protein = resolveNutrientValue(
    nutriments.proteins_serving,
    nutriments.proteins_100g,
    servingScale
  )
  const carbs = resolveNutrientValue(
    nutriments.carbohydrates_serving,
    nutriments.carbohydrates_100g,
    servingScale
  )
  const fat = resolveNutrientValue(
    nutriments.fat_serving,
    nutriments.fat_100g,
    servingScale
  )
  const fiber = resolveNutrientValue(
    nutriments.fiber_serving,
    nutriments.fiber_100g,
    servingScale
  )
  const sugar = resolveNutrientValue(
    nutriments.sugars_serving,
    nutriments.sugars_100g,
    servingScale
  )

  // Determine if any per-serving data was available (for servingSize label)
  const hasAnyServing =
    nutriments["energy-kcal_serving"] !== undefined ||
    nutriments.proteins_serving !== undefined ||
    nutriments.carbohydrates_serving !== undefined ||
    nutriments.fat_serving !== undefined ||
    nutriments.fiber_serving !== undefined ||
    nutriments.sugars_serving !== undefined

  const explicitServingSize = product.serving_size?.trim()
  const servingSize = explicitServingSize || (hasAnyServing ? "1 serving" : "100g")
  const servingGrams = servingQuantity ?? (servingSize === "100g" ? 100 : undefined)

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
    servingSize,
    servingGrams,
    barcode: product.code,
    isCustom: false,
  }
}
