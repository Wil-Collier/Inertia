/**
 * Nutrition API routes using Hono
 */

import { z } from "zod"
import { Hono } from "hono"
import type { Env } from "../env"
import type { SearchResponse, BarcodeResponse } from "./types"
import { getProvider } from "./providerFactory"

const nutrition = new Hono<{ Bindings: Env }>()

const SEARCH_QUERY_MAX_LENGTH = 100
const BARCODE_PATTERN = /^[0-9]{8,14}$/

const OptionalLocaleParamSchema = z.preprocess(
  (value) => {
    if (typeof value !== "string") return value
    const trimmed = value.trim()
    return trimmed.length === 0 ? undefined : trimmed
  },
  z
    .string()
    .regex(/^[a-z]{2}$/i, "Must be a 2-letter code")
    .transform((value) => value.toLowerCase())
    .optional()
)

const SearchQuerySchema = z.object({
  q: z.string().trim().min(1).max(SEARCH_QUERY_MAX_LENGTH),
  page: z.coerce.number().int().min(0).max(200).default(0),
  limit: z.coerce.number().int().min(1).max(50).default(20),
  region: OptionalLocaleParamSchema,
  language: OptionalLocaleParamSchema,
})

const BarcodeQuerySchema = z.object({
  code: z.string().trim().regex(BARCODE_PATTERN, "Barcode must be 8-14 digits"),
})

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
  const parsed = SearchQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: "INVALID_REQUEST", message: "Invalid search parameters" }, 400)
  }

  const { q, page, limit, region, language } = parsed.data

  try {
    const { provider, name } = getProvider(c.env)
    const result = await provider.search(q, page, limit, { region, language })

    const response: SearchResponse = {
      items: result.items,
      provider: name,
      page,
      hasMore: result.hasMore,
    }

    return c.json(response)
  } catch (error) {
    console.error("Nutrition search error:", error)

    return c.json({ error: "SERVER_ERROR", message: "Nutrition search failed" }, 500)
  }
})

/**
 * GET /api/nutrition/barcode
 *
 * Query params:
 * - code (required): Barcode string
 */
nutrition.get("/barcode", async (c) => {
  const parsed = BarcodeQuerySchema.safeParse(c.req.query())
  if (!parsed.success) {
    return c.json({ error: "INVALID_REQUEST", message: "Invalid barcode format" }, 400)
  }

  const code = parsed.data.code

  try {
    const { provider, name } = getProvider(c.env)
    const item = await provider.lookupBarcode(code)

    if (!item) {
      return c.json({ error: "NOT_FOUND", message: "Product not found" }, 404)
    }

    const response: BarcodeResponse = {
      item,
      provider: name,
    }

    return c.json(response)
  } catch (error) {
    console.error("Barcode lookup error:", error)

    return c.json({ error: "SERVER_ERROR", message: "Barcode lookup failed" }, 500)
  }
})

export { nutrition }
