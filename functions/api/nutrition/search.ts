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

import type { Env, SearchResponse } from "./_shared/types"
import { getProvider } from "./_shared/providerFactory"

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const query = url.searchParams.get("q")
  const pageParam = parseInt(url.searchParams.get("page") || "0", 10)
  const page = isNaN(pageParam) ? 0 : pageParam

  const limitParam = parseInt(url.searchParams.get("limit") || "20", 10)
  const limit = Math.min(
    isNaN(limitParam) ? 20 : limitParam,
    50 // Cap at 50
  )
  const region = url.searchParams.get("region") || undefined
  const language = url.searchParams.get("language") || undefined

  if (!query) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: q" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  try {
    const { provider, name } = getProvider(context.env)
    const result = await provider.search(query, page, limit, { region, language })

    const response: SearchResponse = {
      items: result.items,
      provider: name,
      page,
      hasMore: result.hasMore,
    }

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Nutrition search error:", error)

    const message = error instanceof Error ? error.message : String(error)

    return new Response(
      JSON.stringify({ error: message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}
