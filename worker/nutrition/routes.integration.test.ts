import { beforeEach, describe, expect, it, vi } from "vitest"
import { nutrition } from "./routes"

const searchMock = vi.fn()
const lookupBarcodeMock = vi.fn()
const getProviderMock = vi.fn()

vi.mock("./providerFactory", () => ({
  getProvider: (...args: unknown[]) => getProviderMock(...args),
}))

function createEnv() {
  return {
    DB: {
      prepare: () => {
        throw new Error("DB not expected")
      },
    },
    JWT_SECRET: "secret",
    GOOGLE_CLIENT_ID: "google-id",
  }
}

describe("nutrition routes integration", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    searchMock.mockResolvedValue({ items: [], hasMore: false })
    lookupBarcodeMock.mockResolvedValue(null)
    getProviderMock.mockReturnValue({
      provider: {
        search: (...args: unknown[]) => searchMock(...args),
        lookupBarcode: (...args: unknown[]) => lookupBarcodeMock(...args),
      },
      name: "openfoodfacts",
    })
  })

  it("returns 400 when search query is missing", async () => {
    const response = await nutrition.request("/search", {}, createEnv())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "INVALID_REQUEST", message: "Invalid search parameters" })
    expect(searchMock).not.toHaveBeenCalled()
  })

  it("forwards search params and returns provider response metadata", async () => {
    searchMock.mockResolvedValueOnce({
      items: [{ id: "f1", name: "Rice", calories: 130, protein: 2.4, carbs: 28, fat: 0.3, fiber: 0.4, sugar: 0.1, servingSize: "100g", isCustom: false }],
      hasMore: true,
    })

    const response = await nutrition.request(
      "/search?q=rice&page=1&limit=30&region=us&language=en",
      {},
      createEnv()
    )

    const body = await response.json()

    expect(response.status).toBe(200)
    expect(searchMock).toHaveBeenCalledWith("rice", 1, 30, { region: "us", language: "en" })
    expect(body).toEqual({
      items: [
        {
          id: "f1",
          name: "Rice",
          calories: 130,
          protein: 2.4,
          carbs: 28,
          fat: 0.3,
          fiber: 0.4,
          sugar: 0.1,
          servingSize: "100g",
          isCustom: false,
        },
      ],
      provider: "openfoodfacts",
      page: 1,
      hasMore: true,
    })
  })

  it("returns 500 when provider search throws", async () => {
    searchMock.mockRejectedValueOnce(new Error("provider down"))

    const response = await nutrition.request("/search?q=rice", {}, createEnv())
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body).toEqual({ error: "SERVER_ERROR", message: "Nutrition search failed" })
  })

  it("returns currently configured nutrition provider", async () => {
    const response = await nutrition.request("/provider", {}, createEnv())
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body).toEqual({ provider: "openfoodfacts" })
  })

  it("returns 400 when barcode code is missing", async () => {
    const response = await nutrition.request("/barcode", {}, createEnv())
    expect(response.status).toBe(400)
    expect(await response.json()).toEqual({ error: "INVALID_REQUEST", message: "Invalid barcode format" })
    expect(lookupBarcodeMock).not.toHaveBeenCalled()
  })

  it("returns 404 when provider does not find barcode", async () => {
    lookupBarcodeMock.mockResolvedValueOnce(null)

    const response = await nutrition.request("/barcode?code=12345678", {}, createEnv())
    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ error: "NOT_FOUND", message: "Product not found" })
  })

  it("returns 500 when barcode lookup throws", async () => {
    lookupBarcodeMock.mockRejectedValueOnce(new Error("lookup failed"))

    const response = await nutrition.request("/barcode?code=12345678", {}, createEnv())
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: "SERVER_ERROR", message: "Barcode lookup failed" })
  })
})
