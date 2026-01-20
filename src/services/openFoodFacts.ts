import { z } from "zod"
import type { FoodItem } from "@/lib/types"

const API_BASE = "https://world.openfoodfacts.org"

/**
 * Rate limiting and retry configuration for OpenFoodFacts API.
 * The API may return 429 (Too Many Requests) under heavy load.
 */
const RETRY_CONFIG = {
  /** Maximum number of retry attempts */
  maxRetries: 3,
  /** Base delay in ms for exponential backoff */
  baseDelayMs: 1000,
  /** Maximum delay between retries in ms */
  maxDelayMs: 10000,
} as const

/**
 * Sleep for a given number of milliseconds.
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Calculate delay with exponential backoff and jitter.
 * @param attempt - The current attempt number (0-indexed)
 * @returns Delay in milliseconds
 */
function getBackoffDelay(attempt: number): number {
  const exponentialDelay = RETRY_CONFIG.baseDelayMs * Math.pow(2, attempt)
  const jitter = Math.random() * 0.3 * exponentialDelay // Add up to 30% jitter
  return Math.min(exponentialDelay + jitter, RETRY_CONFIG.maxDelayMs)
}

/**
 * Fetch with retry logic and exponential backoff for rate limiting.
 * Handles 429 responses and network errors with configurable retries.
 * 
 * Note: This function intentionally uses await inside a loop for sequential
 * retry logic. Each attempt must complete before the next can begin.
 */
async function fetchWithRetry(
  url: string,
  options?: RequestInit
): Promise<Response> {
  let lastError: Error | null = null

  for (let attempt = 0; attempt <= RETRY_CONFIG.maxRetries; attempt++) {
    try {
      // oxlint-disable-next-line no-await-in-loop
      const response = await fetch(url, options)

      // Handle rate limiting (429) with retry
      if (response.status === 429) {
        if (attempt < RETRY_CONFIG.maxRetries) {
          const delay = getBackoffDelay(attempt)
          if (import.meta.env.DEV) {
            console.log(`Rate limited (429), retrying in ${Math.round(delay)}ms...`)
          }
          // oxlint-disable-next-line no-await-in-loop
          await sleep(delay)
          continue
        }
        throw new Error("Rate limited: Too many requests to OpenFoodFacts API")
      }

      return response
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry on non-network errors
      if (attempt >= RETRY_CONFIG.maxRetries) {
        throw lastError
      }

      const delay = getBackoffDelay(attempt)
      if (import.meta.env.DEV) {
        console.log(`Request failed, retrying in ${Math.round(delay)}ms...`, error)
      }
      // oxlint-disable-next-line no-await-in-loop
      await sleep(delay)
    }
  }

  throw lastError ?? new Error("Request failed after retries")
}

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
  serving_quantity: z.preprocess((val) => {
    if (typeof val === "string") return parseFloat(val)
    return val
  }, z.number().optional()),
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
    id: crypto.randomUUID(),
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
    const response = await fetchWithRetry(`${API_BASE}/cgi/search.pl?${params}`)

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
    const response = await fetchWithRetry(
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
