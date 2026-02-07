/**
 * Nutrition API routes using Hono
 */

import { Hono } from "hono"
import type { Env } from "../env"
import type { SearchResponse, BarcodeResponse } from "./types"
import { getProvider } from "./providerFactory"

const nutrition = new Hono<{ Bindings: Env }>()

/**
 * GET /api/nutrition/search
 *
 * Query params:
 * - q (required): Search query
 * - page (optional, default 0): Page number (0-indexed)
 * - limit (optional, default 20): Items per page
 * - region (optional): Region code (e.g., "us")
 * - language (optional): Language code (e.g., "en")
 */
nutrition.get("/search", async (c) => {
    const query = c.req.query("q")
    const pageParam = parseInt(c.req.query("page") || "0", 10)
    const page = Math.max(0, isNaN(pageParam) ? 0 : pageParam)

    const limitParam = parseInt(c.req.query("limit") || "20", 10)
    const limit = Math.max(
        1,
        Math.min(isNaN(limitParam) ? 20 : limitParam, 50)
    )
    const region = c.req.query("region") || undefined
    const language = c.req.query("language") || undefined

    if (!query) {
        return c.json({ error: "Missing required parameter: q" }, 400)
    }

    try {
        const { provider, name } = getProvider(c.env)
        const result = await provider.search(query, page, limit, { region, language })

        const response: SearchResponse = {
            items: result.items,
            provider: name,
            page,
            hasMore: result.hasMore,
        }

        return c.json(response)
    } catch (error) {
        console.error("Nutrition search error:", error)

        return c.json({ error: "Nutrition search failed" }, 500)
    }
})

/**
 * GET /api/nutrition/barcode
 *
 * Query params:
 * - code (required): Barcode string
 */
nutrition.get("/barcode", async (c) => {
    const code = c.req.query("code")

    if (!code) {
        return c.json({ error: "Missing required parameter: code" }, 400)
    }

    try {
        const { provider, name } = getProvider(c.env)
        const item = await provider.lookupBarcode(code)

        if (!item) {
            return c.json({ error: "Product not found" }, 404)
        }

        const response: BarcodeResponse = {
            item,
            provider: name,
        }

        return c.json(response)
    } catch (error) {
        console.error("Barcode lookup error:", error)

        return c.json({ error: "Barcode lookup failed" }, 500)
    }
})

export { nutrition }
