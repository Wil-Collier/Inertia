import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Env } from "../env"

const fetchMock = vi.fn()

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal("fetch", fetchMock)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

async function loadProvider() {
  vi.resetModules()
  const mod = await import("./fatSecret")
  return mod.createFatSecretProvider({
    DB: createUnusedDb(),
    JWT_SECRET: "secret",
    GOOGLE_CLIENT_ID: "google-id",
    FAT_SECRET_CLIENT_ID: "client",
    FAT_SECRET_CLIENT_SECRET: "secret-value",
  })
}

function createUnusedDb(): Env["DB"] {
  return {
    prepare: () => {
      throw new Error("DB is not used in this test")
    },
    batch: async () => {
      throw new Error("DB is not used in this test")
    },
    exec: async () => {
      throw new Error("DB is not used in this test")
    },
    withSession: () => {
      throw new Error("DB is not used in this test")
    },
    dump: async () => {
      throw new Error("DB is not used in this test")
    },
  }
}

function readCallUrl(call: unknown[] | undefined): string {
  const url = call?.[0]
  if (typeof url !== "string") {
    throw new TypeError("Expected request URL string")
  }
  return url
}

describe("FatSecret provider", () => {
  it("returns empty results for blank search", async () => {
    const provider = await loadProvider()
    const result = await provider.search("   ", 0, 20)

    expect(result).toEqual({ items: [], hasMore: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("searches foods and normalizes the selected serving", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token-1",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            foods_search: {
              total_results: "41",
              page_number: "0",
              results: {
                food: [
                  {
                    food_id: "111",
                    food_name: "Chicken Breast",
                    brand_name: "Acme",
                    servings: {
                      serving: [
                        {
                          serving_id: "1",
                          serving_description: "50 g",
                          metric_serving_amount: "50",
                          metric_serving_unit: "g",
                          calories: "82",
                          protein: "15.5",
                          carbohydrate: "0",
                          fat: "1.8",
                          fiber: "0",
                          sugar: "0",
                        },
                        {
                          serving_id: "0",
                          serving_description: "100 g",
                          metric_serving_amount: "100",
                          metric_serving_unit: "g",
                          calories: "165",
                          protein: "31",
                          carbohydrate: "0",
                          fat: "3.6",
                          fiber: "0",
                          sugar: "0",
                        },
                      ],
                    },
                  },
                ],
              },
            },
          }),
          { status: 200 }
        )
      )

    const provider = await loadProvider()
    const result = await provider.search("chicken", 0, 20, { region: "us", language: "en" })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(readCallUrl(fetchMock.mock.calls[1])).toContain("foods/search/v4")

    expect(result.hasMore).toBe(true)
    expect(result.items).toEqual([
      {
        id: "fatsecret:111",
        name: "Chicken Breast",
        brand: "Acme",
        calories: 82,
        protein: 15.5,
        carbs: 0,
        fat: 1.8,
        fiber: 0,
        sugar: 0,
        servingSize: "50 g",
        servingGrams: 50,
        isCustom: false,
      },
    ])
  })

  it("prefers explicit portions like slices over generic 100 g servings", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            access_token: "token-1",
            expires_in: 3600,
            token_type: "Bearer",
          }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            foods_search: {
              total_results: "1",
              page_number: "0",
              results: {
                food: [
                  {
                    food_id: "222",
                    food_name: "Whole Wheat Bread",
                    servings: {
                      serving: [
                        {
                          serving_id: "0",
                          serving_description: "100 g",
                          metric_serving_amount: "100",
                          metric_serving_unit: "g",
                          calories: "260",
                          protein: "12",
                          carbohydrate: "49",
                          fat: "3",
                          fiber: "7",
                          sugar: "6",
                        },
                        {
                          serving_id: "2",
                          serving_description: "1 slice",
                          metric_serving_amount: "32",
                          metric_serving_unit: "g",
                          calories: "83",
                          protein: "3.8",
                          carbohydrate: "15.7",
                          fat: "1",
                          fiber: "2.2",
                          sugar: "1.9",
                        },
                      ],
                    },
                  },
                ],
              },
            },
          }),
          { status: 200 }
        )
      )

    const provider = await loadProvider()
    const result = await provider.search("bread", 0, 20)

    expect(result.items[0]).toMatchObject({
      name: "Whole Wheat Bread",
      servingSize: "1 slice",
      servingGrams: 32,
      calories: 83,
    })
  })

  it("uses token single-flight for concurrent requests", async () => {
    let resolveToken!: (value: Response) => void
    const tokenPromise = new Promise<Response>((resolve) => {
      resolveToken = resolve
    })

    fetchMock
      .mockImplementationOnce(() => tokenPromise)
      .mockImplementation(() =>
        Promise.resolve(
          new Response(
            JSON.stringify({
              foods_search: {
                total_results: "0",
                page_number: "0",
              },
            }),
            { status: 200 }
          )
        )
      )

    const provider = await loadProvider()

    const first = provider.search("rice", 0, 20)
    const second = provider.search("rice", 0, 20)

    resolveToken(
      new Response(
        JSON.stringify({
          access_token: "token-concurrent",
          expires_in: 3600,
          token_type: "Bearer",
        }),
        { status: 200 }
      )
    )

    await Promise.all([first, second])

    const tokenCalls = fetchMock.mock.calls.filter((call) =>
      readCallUrl(call).includes("oauth.fatsecret.com/connect/token")
    )
    expect(tokenCalls).toHaveLength(1)
  })

  it("returns null for barcode 404 and resolves item via two-step barcode flow", async () => {
    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "token-1", expires_in: 3600, token_type: "Bearer" }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(new Response("", { status: 404 }))

    let provider = await loadProvider()
    await expect(provider.lookupBarcode("000")).resolves.toBeNull()

    vi.resetModules()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)

    fetchMock
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ access_token: "token-2", expires_in: 3600, token_type: "Bearer" }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ food_id: { value: "123" } }),
          { status: 200 }
        )
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            food: {
              food_id: "123",
              food_name: "Protein Bar",
              brand_name: "Bar Co",
              servings: {
                serving: {
                  serving_description: "1 bar",
                  metric_serving_amount: "60",
                  metric_serving_unit: "g",
                  calories: "220",
                  protein: "20",
                  carbohydrate: "23",
                  fat: "7",
                  fiber: "3",
                  sugar: "2",
                },
              },
            },
          }),
          { status: 200 }
        )
      )

    provider = await loadProvider()
    const item = await provider.lookupBarcode("999")

    expect(item).toEqual({
      id: "fatsecret:123",
      name: "Protein Bar",
      brand: "Bar Co",
      calories: 220,
      protein: 20,
      carbs: 23,
      fat: 7,
      fiber: 3,
      sugar: 2,
      servingSize: "1 bar",
      servingGrams: 60,
      barcode: "999",
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
