/**
 * OpenFoodFacts provider implementation.
 * Calls OpenFoodFacts API endpoints and normalizes responses to FoodItem.
 */

import type { FoodItem, NutritionProvider } from "./types"
import { normalizeOpenFoodFactsProduct } from "../../shared/openFoodFactsNormalizer"

const API_BASE = "https://world.openfoodfacts.org"
const REQUEST_TIMEOUT_MS = 15000

interface OpenFoodFactsProduct {
    code: string
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

interface OpenFoodFactsSearchResponse {
    count: number
    page: number
    page_size: number
    products: OpenFoodFactsProduct[]
}

interface OpenFoodFactsProductResponse {
    status: number
    product?: OpenFoodFactsProduct
}

async function fetchWithTimeout(
    url: string,
    timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

    try {
        const response = await fetch(url, { signal: controller.signal })
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

export function createOpenFoodFactsProvider(): NutritionProvider {
    return {
        async search(query, page, limit, options) {
            if (!query.trim()) {
                return { items: [], hasMore: false }
            }

            const params = new URLSearchParams({
                search_terms: query,
                search_simple: "1",
                action: "process",
                json: "1",
                page: (page + 1).toString(), // OpenFoodFacts uses 1-based pages
                page_size: limit.toString(),
                fields:
                    "code,product_name,brands,nutriments,serving_size,serving_quantity",
            })

            // Add region/language if provided
            if (options?.region) {
                params.set("cc", options.region)
            } else {
                params.set("cc", "us")
            }
            if (options?.language) {
                params.set("lc", options.language)
            } else {
                params.set("lc", "en")
            }

            const response = await fetchWithTimeout(
                `${API_BASE}/cgi/search.pl?${params.toString()}`
            )

            if (!response.ok) {
                throw new Error(`OpenFoodFacts search failed: ${response.status}`)
            }

            const data: OpenFoodFactsSearchResponse = await response.json()

            const items = data.products
                .map((product) => normalizeOpenFoodFactsProduct(product) as FoodItem | null)
                .filter((f): f is FoodItem => f !== null)

            const hasMore = data.count > (page + 1) * limit

            return { items, hasMore }
        },

        async lookupBarcode(code) {
            if (!code.trim()) return null

            const response = await fetchWithTimeout(
                `${API_BASE}/api/v2/product/${code}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity&lc=en&cc=us`
            )

            if (!response.ok) {
                throw new Error(`OpenFoodFacts product lookup failed: ${response.status}`)
            }

            const data: OpenFoodFactsProductResponse = await response.json()

            if (data.status !== 1 || !data.product) {
                return null
            }

            return normalizeOpenFoodFactsProduct(data.product) as FoodItem | null
        },
    }
}
