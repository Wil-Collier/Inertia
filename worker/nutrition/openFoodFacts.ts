/**
 * OpenFoodFacts provider implementation.
 * Calls OpenFoodFacts API endpoints and normalizes responses to FoodItem.
 */

import type { FoodItem, NutritionProvider } from "./types"
import { normalizeOpenFoodFactsProduct } from "../../shared/openFoodFactsNormalizer"
import { fetchWithTimeout } from "../lib/requestUtils"
import { z } from "zod"

const API_BASE = "https://world.openfoodfacts.org"
const REQUEST_TIMEOUT_MS = 15000

// Zod schemas for runtime validation of external API responses
const NutrimentsSchema = z.object({
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
}).passthrough()

const OpenFoodFactsProductSchema = z.object({
    code: z.string(),
    product_name: z.string().optional(),
    brands: z.string().optional(),
    nutriments: NutrimentsSchema.optional(),
    serving_size: z.string().optional(),
    serving_quantity: z.union([z.number(), z.string()]).optional(),
})

const OpenFoodFactsSearchResponseSchema = z.object({
    count: z.number(),
    page: z.number(),
    page_size: z.number(),
    products: z.array(z.unknown()),
})

const OpenFoodFactsProductResponseSchema = z.object({
    status: z.number(),
    product: OpenFoodFactsProductSchema.optional(),
})

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
                `${API_BASE}/cgi/search.pl?${params.toString()}`,
                undefined,
                REQUEST_TIMEOUT_MS
            )

            if (!response.ok) {
                throw new Error(`OpenFoodFacts search failed: ${response.status}`)
            }

            const data = OpenFoodFactsSearchResponseSchema.parse(await response.json())

            const items = data.products
                .map((rawProduct) => {
                    const parsedProduct = OpenFoodFactsProductSchema.safeParse(rawProduct)
                    if (!parsedProduct.success) return null
                    return normalizeOpenFoodFactsProduct(parsedProduct.data) as FoodItem | null
                })
                .filter((f): f is FoodItem => f !== null)

            const hasMore = data.count > (page + 1) * limit

            return { items, hasMore }
        },

        async lookupBarcode(code) {
            if (!code.trim()) return null

            const response = await fetchWithTimeout(
                `${API_BASE}/api/v2/product/${code}.json?fields=code,product_name,brands,nutriments,serving_size,serving_quantity&lc=en&cc=us`,
                undefined,
                REQUEST_TIMEOUT_MS
            )

            if (!response.ok) {
                throw new Error(`OpenFoodFacts product lookup failed: ${response.status}`)
            }

            const data = OpenFoodFactsProductResponseSchema.parse(await response.json())

            if (data.status !== 1 || !data.product) {
                return null
            }

            return normalizeOpenFoodFactsProduct(data.product) as FoodItem | null
        },
    }
}
