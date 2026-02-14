/**
 * FatSecret provider implementation with OAuth 2.0 Client Credentials flow.
 * Uses foods.search.v4 for text search and food.find_id_for_barcode + food.get.v4 for barcode lookup.
 */

import type { Env } from "../env"
import type { FoodItem, NutritionProvider } from "./types"
import { z } from "zod"

const TOKEN_URL = "https://oauth.fatsecret.com/connect/token"
const API_BASE = "https://platform.fatsecret.com/rest"
const REQUEST_TIMEOUT_MS = 10000

// In-memory token cache (module scope)
let tokenCache: {
    accessToken: string
    expiresAt: number
} | null = null

// Single-flight guard for token refresh
let tokenPromise: Promise<string> | null = null

/**
 * FatSecret API response types
 */
interface FatSecretServing {
    serving_id?: string | number
    serving_description?: string
    metric_serving_amount?: string | number
    metric_serving_unit?: string
    calories?: string | number
    protein?: string | number
    carbohydrate?: string | number
    fat?: string | number
    fiber?: string | number
    sugar?: string | number
}

interface FatSecretFood {
    food_id: string
    food_name: string
    brand_name?: string
    food_type?: string
    servings?: {
        serving: FatSecretServing | FatSecretServing[]
    }
}

async function fetchWithTimeout(
    url: string,
    options?: RequestInit,
    timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(url, {
            ...options,
            signal: controller.signal,
        })
        clearTimeout(timeoutId)
        return response
    } catch (error) {
        clearTimeout(timeoutId)
        if (error instanceof Error && error.name === "AbortError") {
            throw new Error("Request timed out", { cause: error })
        }
        throw error
    }
}

interface TokenResponse {
    access_token: string
    expires_in: number
    token_type: string
}

// Zod schemas for runtime validation of external API responses
const TokenResponseSchema = z.object({
    access_token: z.string(),
    expires_in: z.number(),
    token_type: z.string(),
})

const FatSecretServingSchema = z.object({
    serving_id: z.union([z.string(), z.number()]).optional(),
    serving_description: z.string().optional(),
    metric_serving_amount: z.union([z.string(), z.number()]).optional(),
    metric_serving_unit: z.string().optional(),
    calories: z.union([z.string(), z.number()]).optional(),
    protein: z.union([z.string(), z.number()]).optional(),
    carbohydrate: z.union([z.string(), z.number()]).optional(),
    fat: z.union([z.string(), z.number()]).optional(),
    fiber: z.union([z.string(), z.number()]).optional(),
    sugar: z.union([z.string(), z.number()]).optional(),
})

const FatSecretFoodSchema = z.object({
    food_id: z.string(),
    food_name: z.string(),
    brand_name: z.string().optional(),
    food_type: z.string().optional(),
    servings: z.object({
        serving: z.union([FatSecretServingSchema, z.array(FatSecretServingSchema)]),
    }).optional(),
})

const FatSecretSearchResponseSchema = z.object({
    foods_search: z.object({
        max_results: z.union([z.string(), z.number()]).optional(),
        total_results: z.union([z.string(), z.number()]).optional(),
        page_number: z.union([z.string(), z.number()]).optional(),
        results: z.object({
            food: z.union([FatSecretFoodSchema, z.array(FatSecretFoodSchema)]).optional(),
        }).optional(),
    }).optional(),
})

const FatSecretBarcodeResponseSchema = z.object({
    food_id: z.object({
        value: z.string().optional(),
    }).optional(),
})

const FatSecretFoodGetResponseSchema = z.object({
    food: FatSecretFoodSchema.optional(),
})

async function getAccessToken(env: Env): Promise<string> {
    const now = Date.now()

    // Check cache with 5-minute buffer before expiry
    if (tokenCache && tokenCache.expiresAt > now + 5 * 60 * 1000) {
        return tokenCache.accessToken
    }

    // Single-flight: reuse existing promise if one is in flight
    if (tokenPromise) {
        return tokenPromise
    }

    tokenPromise = (async () => {
        try {
            const clientId = env.FAT_SECRET_CLIENT_ID
            const clientSecret = env.FAT_SECRET_CLIENT_SECRET

            if (!clientId || !clientSecret) {
                throw new Error("FatSecret credentials not configured")
            }

            const response = await fetchWithTimeout(TOKEN_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`,
                },
                body: "grant_type=client_credentials",
            })

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`Token request failed: ${response.status} - ${text}`)
            }

            const data: TokenResponse = TokenResponseSchema.parse(await response.json())

            const expiresAt = now + data.expires_in * 1000

            tokenCache = {
                accessToken: data.access_token,
                expiresAt,
            }

            return data.access_token
        } finally {
            tokenPromise = null
        }
    })()

    return tokenPromise
}

function toNumber(val: string | number | undefined): number {
    if (val === undefined) return 0
    if (typeof val === "number") return val
    const parsed = parseFloat(val)
    return isNaN(parsed) ? 0 : parsed
}

/**
 * Select the best serving from a FatSecret food item.
 * Prefers serving_id === "0" when present, otherwise uses first serving.
 */
function selectServing(
    servings: FatSecretServing | FatSecretServing[] | undefined
): FatSecretServing | null {
    if (!servings) return null

    const servingArray = Array.isArray(servings) ? servings : [servings]
    if (servingArray.length === 0) return null

    // Prefer serving_id === "0" or 0
    const preferredServing = servingArray.find((s) => {
        const id = s.serving_id
        return id === "0" || id === 0
    })

    return preferredServing || servingArray[0]
}

function parseFatSecretFood(food: FatSecretFood): FoodItem | null {
    const serving = selectServing(food.servings?.serving)
    if (!serving) return null

    const metricAmount = toNumber(serving.metric_serving_amount)
    const metricUnit = serving.metric_serving_unit || "g"

    return {
        id: `fatsecret:${food.food_id}`,
        name: food.food_name,
        brand: food.brand_name,
        calories: Math.round(toNumber(serving.calories)),
        protein: Math.round(toNumber(serving.protein) * 10) / 10,
        carbs: Math.round(toNumber(serving.carbohydrate) * 10) / 10,
        fat: Math.round(toNumber(serving.fat) * 10) / 10,
        fiber: Math.round(toNumber(serving.fiber) * 10) / 10,
        sugar: Math.round(toNumber(serving.sugar) * 10) / 10,
        servingSize: serving.serving_description || `${metricAmount}${metricUnit}`,
        servingGrams: metricAmount || undefined,
        isCustom: false,
    }
}

export function createFatSecretProvider(env: Env): NutritionProvider {
    return {
        async search(query, page, limit, options) {
            if (!query.trim()) {
                return { items: [], hasMore: false }
            }

            const token = await getAccessToken(env)

            const params = new URLSearchParams({
                method: "foods.search.v4",
                search_expression: query,
                format: "json",
                page_number: page.toString(),
                max_results: limit.toString(),
                include_food_images: "false",
                include_food_attributes: "false",
            })

            // Add region/language if provided
            if (options?.region) {
                params.set("region", options.region)
            }
            if (options?.language) {
                params.set("language", options.language)
            }

            const response = await fetchWithTimeout(
                `${API_BASE}/foods/search/v4?${params.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )

            if (!response.ok) {
                const text = await response.text()
                throw new Error(`FatSecret search failed: ${response.status} - ${text}`)
            }

            const data = FatSecretSearchResponseSchema.parse(await response.json())

            const foods = data.foods_search?.results?.food
            if (!foods) {
                return { items: [], hasMore: false }
            }

            const foodArray = Array.isArray(foods) ? foods : [foods]
            const items = foodArray
                .map(parseFatSecretFood)
                .filter((f): f is FoodItem => f !== null)

            const totalResults = toNumber(data.foods_search?.total_results)
            const currentPage = toNumber(data.foods_search?.page_number)
            const hasMore = totalResults > (currentPage + 1) * limit

            return { items, hasMore }
        },

        async lookupBarcode(code) {
            if (!code.trim()) return null

            const token = await getAccessToken(env)

            // Step 1: Find food_id by barcode
            const barcodeParams = new URLSearchParams({
                method: "food.find_id_for_barcode",
                barcode: code,
                format: "json",
            })

            const barcodeResponse = await fetchWithTimeout(
                `${API_BASE}/food/barcode/find-by-id/v1?${barcodeParams.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )

            if (!barcodeResponse.ok) {
                if (barcodeResponse.status === 404) {
                    return null
                }
                throw new Error(
                    `FatSecret barcode lookup failed: ${barcodeResponse.status}`
                )
            }

            const barcodeData = FatSecretBarcodeResponseSchema.parse(await barcodeResponse.json())

            const foodId = barcodeData.food_id?.value
            if (!foodId) {
                return null
            }

            // Step 2: Get food details
            const foodParams = new URLSearchParams({
                method: "food.get.v4",
                food_id: foodId,
                format: "json",
                include_food_images: "false",
                include_food_attributes: "false",
            })

            const foodResponse = await fetchWithTimeout(
                `${API_BASE}/food/v4?${foodParams.toString()}`,
                {
                    headers: {
                        Authorization: `Bearer ${token}`,
                    },
                }
            )

            if (!foodResponse.ok) {
                throw new Error(
                    `FatSecret food get failed: ${foodResponse.status}`
                )
            }

            const foodData = FatSecretFoodGetResponseSchema.parse(await foodResponse.json())

            if (!foodData.food) {
                return null
            }

            const item = parseFatSecretFood(foodData.food)
            if (item) {
                // Add barcode to the item
                item.barcode = code
            }
            return item
        },
    }
}
