import { http, HttpResponse } from "msw"
import type { FoodItem } from "@/lib/types"

const REMOTE_OATS: FoodItem = {
  id: "remote-food-1",
  name: "Remote Oats",
  calories: 240,
  protein: 10,
  carbs: 42,
  fat: 4,
  fiber: 6,
  sugar: 1,
  servingSize: "1 bowl",
  isCustom: false,
  isFavorite: false,
}

export const handlers = [
  http.post("/api/auth/refresh", () => {
    return HttpResponse.json({
      accessToken: "test-access-token",
      userId: "user-1",
      email: "tester@example.com",
      expiresAtMs: Date.now() + 60 * 60 * 1000,
    })
  }),

  http.get("/api/nutrition/search", ({ request }) => {
    const url = new URL(request.url)
    const query = url.searchParams.get("q") ?? ""
    const page = Number(url.searchParams.get("page") ?? "0")

    if (!query.trim()) {
      return HttpResponse.json({
        items: [],
        provider: "openfoodfacts",
        page,
        hasMore: false,
      })
    }

    return HttpResponse.json({
      items: [
        {
          ...REMOTE_OATS,
          name: query.trim().toLowerCase() === "oats" ? "Remote Oats" : `${query.trim()} Result`,
        },
      ],
      provider: "openfoodfacts",
      page,
      hasMore: false,
    })
  }),

  http.get("/api/nutrition/barcode", ({ request }) => {
    const url = new URL(request.url)
    const code = url.searchParams.get("code")

    if (code !== "1234567890") {
      return HttpResponse.json({ error: "NOT_FOUND", message: "Product not found" }, { status: 404 })
    }

    return HttpResponse.json({
      item: REMOTE_OATS,
      provider: "openfoodfacts",
    })
  }),
]
