/**
 * GET /api/nutrition/barcode
 *
 * Query params:
 * - code (required): Barcode string
 */

import type { Env, BarcodeResponse } from "./_shared/types"
import { getProvider } from "./_shared/providerFactory"

export const onRequestGet: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url)
  const code = url.searchParams.get("code")

  if (!code) {
    return new Response(
      JSON.stringify({ error: "Missing required parameter: code" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    )
  }

  try {
    const { provider, name } = getProvider(context.env)
    const item = await provider.lookupBarcode(code)

    if (!item) {
      return new Response(
        JSON.stringify({ error: "Product not found" }),
        {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }
      )
    }

    const response: BarcodeResponse = {
      item,
      provider: name,
    }

    return new Response(JSON.stringify(response), {
      headers: { "Content-Type": "application/json" },
    })
  } catch (error) {
    console.error("Barcode lookup error:", error)

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
