import { z } from "zod"
import type { FoodItem } from "@/lib/types"
import { v4 as uuidv4 } from "uuid"

const API_BASE = "https://world.openfoodfacts.org"

const OpenFoodFactsProductSchema = z.object({
  code: z.string(),
  product_name: z.string().optional(),
  brands: z.string().optional(),
  nutriments: z.object({
    "energy-kcal_100g": z.number().optional(),
    "energy-kcal_serving": z.number().optional(),
    proteins_100g: z.number().optional(),
    proteins_serving: z.number().optional(),
    carbohydrates_100g: z.number().optional(),
    carbohydrates_serving: z.number().optional(),
    fat_100g: z.number().optional(),
    fat_serving: z.number().optional(),
    fiber_100g: z.number().optional(),
    fiber_serving: z.number().optional(),
    sugars_100g: z.number().optional(),
    sugars_serving: z.number().optional(),
  }).optional(),
  serving_size: z.string().optional(),
  serving_quantity: z.number().optional(),
})

type OpenFoodFactsProduct = z.infer<typeof OpenFoodFactsProductSchema>

const OpenFoodFactsSearchResponseSchema = z.object({
  count: z.number(),
  page: z.number(),
  page_size: z.number(),
  products: z.array(OpenFoodFactsProductSchema),
})

const OpenFoodFactsProductResponseSchema = z.object({
  status: z.number(),
  product: OpenFoodFactsProductSchema.optional(),
})

function parseProduct(product: OpenFoodFactsProduct): FoodItem | null {
  if (!product.product_name) return null

  const nutriments = product.nutriments || {}

  // Prefer serving values if available, otherwise use 100g values
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

  return {
    id: uuidv4(),
    name: product.product_name,
    brand: product.brands,
    calories: Math.round(calories),
    protein: Math.round(protein * 10) / 10,
    carbs: Math.round(carbs * 10) / 10,
    fat: Math.round(fat * 10) / 10,
    fiber: Math.round(fiber * 10) / 10,
    sugar: Math.round(sugar * 10) / 10,
    servingSize: hasServing ? servingSize : "100g",
    servingGrams: product.serving_quantity || 100,
    barcode: product.code,
    isCustom: false,
  }
}

export async function searchFoods(
  query: string,
  page: number = 1,
  pageSize: number = 20
): Promise<{ foods: FoodItem[]; total: number }> {
  if (!query.trim()) return { foods: [], total: 0 }

  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page: page.toString(),
    page_size: pageSize.toString(),
    fields:
      "code,product_name,brands,nutriments,serving_size,serving_quantity",
    cc: "us",
    lc: "en",
  })

  try {
    const response = await fetch(`${API_BASE}/cgi/search.pl?${params}`)

    if (!response.ok) {
      throw new Error(`Search failed: ${response.status}`)
    }

    const rawData = await response.json()
    const validation = OpenFoodFactsSearchResponseSchema.safeParse(rawData)

    if (!validation.success) {
      console.error("Open Food Facts search validation failed:", validation.error)
      return { foods: [], total: 0 }
    }

    const data = validation.data

    const foods = data.products
      .map(parseProduct)
      .filter((f): f is FoodItem => f !== null)

    return {
      foods,
      total: data.count,
    }
  } catch (error) {
    console.error("Open Food Facts search error:", error)
    return { foods: [], total: 0 }
  }
}

export async function getProductByBarcode(
  barcode: string
): Promise<FoodItem | null> {
  if (!barcode.trim()) return null

  try {
    const response = await fetch(
      `${API_BASE}/api/v2/product/${barcode}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity&lc=en&cc=us`
    )

    if (!response.ok) {
      throw new Error(`Product lookup failed: ${response.status}`)
    }

    const rawData = await response.json()
    const validation = OpenFoodFactsProductResponseSchema.safeParse(rawData)

    if (!validation.success) {
      console.error("Open Food Facts product validation failed:", validation.error)
      return null
    }

    const data = validation.data

    if (data.status !== 1 || !data.product) {
      return null
    }

    return parseProduct(data.product)
  } catch (error) {
    console.error("Open Food Facts product lookup error:", error)
    return null
  }
}
