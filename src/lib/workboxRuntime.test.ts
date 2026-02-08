import { describe, expect, it } from "vitest"
import { matchNutritionApi } from "@/lib/workboxRuntime"

describe("matchNutritionApi", () => {
  it("matches same-origin nutrition endpoints by pathname", () => {
    expect(matchNutritionApi(new URL("https://app.example.com/api/nutrition/search?q=rice"))).toBe(true)
    expect(matchNutritionApi(new URL("http://localhost:5173/api/nutrition/barcode?code=12345678"))).toBe(true)
  })

  it("does not match non-nutrition endpoints", () => {
    expect(matchNutritionApi(new URL("https://app.example.com/api/sync/pull"))).toBe(false)
    expect(matchNutritionApi(new URL("https://app.example.com/assets/index.js"))).toBe(false)
  })
})
