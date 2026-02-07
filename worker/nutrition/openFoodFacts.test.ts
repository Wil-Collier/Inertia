import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function loadProvider() {
  const mod = await import("./openFoodFacts")
  return mod.createOpenFoodFactsProvider()
}

function readCallUrl(call: unknown[] | undefined): string {
  const url = call?.[0]
  if (typeof url !== "string") {
    throw new TypeError("Expected URL string")
  }
  return url
}

describe("OpenFoodFacts provider", () => {
  it("normalizes search results and computes hasMore", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          count: 60,
          page: 2,
          page_size: 20,
          products: [
            {
              code: "123",
              product_name: "Greek Yogurt",
              brands: "Acme",
              nutriments: {
                "energy-kcal_serving": 120,
                proteins_serving: 11.4,
                carbohydrates_serving: 8.2,
                fat_serving: 3.7,
                fiber_serving: 0,
                sugars_serving: 6.1,
              },
              serving_size: "170g",
              serving_quantity: "170",
            },
          ],
        }),
        { status: 200 }
      )
    )

    const provider = await loadProvider()
    const result = await provider.search("yogurt", 1, 20, { region: "us", language: "en" })

    expect(fetchMock).toHaveBeenCalledTimes(1)
    const url = readCallUrl(fetchMock.mock.calls[0])
    expect(url).toContain("search_terms=yogurt")
    expect(url).toContain("page=2")
    expect(url).toContain("cc=us")
    expect(url).toContain("lc=en")

    expect(result.hasMore).toBe(true)
    expect(result.items).toEqual([
      {
        id: "123",
        name: "Greek Yogurt",
        brand: "Acme",
        calories: 120,
        protein: 11.4,
        carbs: 8.2,
        fat: 3.7,
        fiber: 0,
        sugar: 6.1,
        servingSize: "170g",
        servingGrams: 170,
        barcode: "123",
        isCustom: false,
      },
    ])
  })

  it("returns empty search results for blank query", async () => {
    const provider = await loadProvider()
    const result = await provider.search("   ", 0, 20)

    expect(result).toEqual({ items: [], hasMore: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("throws typed error message when search endpoint fails", async () => {
    fetchMock.mockResolvedValueOnce(new Response("", { status: 503 }))

    const provider = await loadProvider()

    await expect(provider.search("rice", 0, 20)).rejects.toThrow("OpenFoodFacts search failed: 503")
  })

  it("returns null when barcode is not found", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 0,
        }),
        { status: 200 }
      )
    )

    const provider = await loadProvider()

    await expect(provider.lookupBarcode("000")).resolves.toBeNull()
  })

  it("normalizes barcode lookup success response", async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          status: 1,
          product: {
            code: "789",
            product_name: "Oats",
            brands: "Farm Co",
            nutriments: {
              "energy-kcal_100g": 389,
              proteins_100g: 16.9,
              carbohydrates_100g: 66.3,
              fat_100g: 6.9,
              fiber_100g: 10.6,
              sugars_100g: 0.9,
            },
            serving_size: "100g",
          },
        }),
        { status: 200 }
      )
    )

    const provider = await loadProvider()
    const item = await provider.lookupBarcode("789")

    expect(item).toEqual({
      id: "789",
      name: "Oats",
      brand: "Farm Co",
      calories: 389,
      protein: 16.9,
      carbs: 66.3,
      fat: 6.9,
      fiber: 10.6,
      sugar: 0.9,
      servingSize: "100g",
      servingGrams: 100,
      barcode: "789",
      isCustom: false,
    })
  })

  it("maps abort errors to timeout message", async () => {
    const abortError = new Error("aborted")
    ;(abortError as { name?: string }).name = "AbortError"
    fetchMock.mockRejectedValueOnce(abortError)

    const provider = await loadProvider()

    await expect(provider.search("rice", 0, 20)).rejects.toThrow("Request timed out")
  })
})
