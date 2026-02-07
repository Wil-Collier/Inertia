import { beforeEach, describe, expect, it, vi } from "vitest"
import { NutritionApiError, getProductByBarcode, searchFoods } from "@/services/nutritionApi"

describe("nutritionApi service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("returns empty result for blank queries without calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await searchFoods("   ")

    expect(result).toEqual({ foods: [], hasMore: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps HTTP failures to NutritionApiError with server message", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ error: "backend-failed" }), { status: 500 }))
    )

    await expect(searchFoods("rice")).rejects.toMatchObject({
      name: "NutritionApiError",
      kind: "http",
      message: "backend-failed",
      status: 500,
    })
  })

  it("maps aborted requests to timeout errors", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        const error = new Error("aborted")
        Object.defineProperty(error, "name", { value: "AbortError" })
        throw error
      })
    )

    await expect(searchFoods("rice")).rejects.toMatchObject({
      name: "NutritionApiError",
      kind: "timeout",
      message: "Request timed out",
    })
  })

  it("returns null for missing barcode products", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 })))

    await expect(getProductByBarcode("12345")).resolves.toBeNull()
  })

  it("throws typed network errors on transport failures", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down")
    }))

    await expect(getProductByBarcode("12345")).rejects.toBeInstanceOf(NutritionApiError)
    await expect(getProductByBarcode("12345")).rejects.toMatchObject({ kind: "network" })
  })
})
