import { beforeEach, describe, expect, it, vi } from "vitest"
import { getProductByBarcode, searchFoods } from "@/services/openFoodFacts"

describe("openFoodFacts service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("retries rate-limited responses and eventually succeeds", async () => {
    vi.useFakeTimers()

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response("{}", { status: 429 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            count: 1,
            page: 1,
            page_size: 20,
            products: [
              {
                code: "123",
                product_name: "Rice",
                brands: "Brand",
                nutriments: {
                  "energy-kcal_100g": 100,
                  proteins_100g: 2,
                  carbohydrates_100g: 20,
                  fat_100g: 1,
                },
              },
            ],
          }),
          { status: 200 }
        )
      )

    vi.stubGlobal("fetch", fetchMock)

    const promise = searchFoods("rice", 1, 20)
    await vi.runAllTimersAsync()
    const result = await promise

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(result.foods).toHaveLength(1)
    expect(result.foods[0]).toMatchObject({ id: "123", name: "Rice", isCustom: false })

    vi.useRealTimers()
  })

  it("throws validation errors for malformed API payloads", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ invalid: true }), { status: 200 })))

    await expect(searchFoods("rice")).rejects.toMatchObject({
      name: "OpenFoodFactsError",
      kind: "validation",
    })
  })

  it("returns null when product status is not found", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify({ status: 0 }), { status: 200 }))
    )

    await expect(getProductByBarcode("123")).resolves.toBeNull()
  })

  it("maps transport failures to typed OpenFoodFactsError", async () => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("socket reset")
    }))

    const promise = getProductByBarcode("123").then(
      () => ({ ok: true as const }),
      (error: unknown) => ({ ok: false as const, error })
    )
    await vi.runAllTimersAsync()
    const result = await promise
    expect(result.ok).toBe(false)
    if (result.ok) {
      throw new Error("Expected network failure")
    }
    expect(result.error).toMatchObject({ name: "OpenFoodFactsError", kind: "network" })
    vi.useRealTimers()
  })
})
