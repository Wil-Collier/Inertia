import { http, HttpResponse } from "msw"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { NutritionApiError, getProductByBarcode, getNutritionProvider, searchFoods } from "@/services/nutritionApi"
import { useAuthStore } from "@/features/sync/runtime/store"
import { server } from "@/test/msw/server"

describe("nutritionApi service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    useAuthStore.getState().clearAuth()
  })

  it("returns empty result for blank queries without calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await searchFoods("   ")

    expect(result).toEqual({ foods: [], hasMore: false, provider: "openfoodfacts" })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps HTTP failures to NutritionApiError with server message", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token-1",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    server.use(
      http.get("/api/nutrition/search", () =>
        HttpResponse.json({ error: "backend-failed" }, { status: 500 })
      )
    )

    await expect(searchFoods("rice")).rejects.toMatchObject({
      name: "NutritionApiError",
      kind: "http",
      message: "backend-failed",
      status: 500,
    })
  })

  it("maps aborted requests to timeout errors", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token-1",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

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
    useAuthStore.getState().setAuth({
      accessToken: "token-1",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    server.use(
      http.get("/api/nutrition/barcode", () =>
        HttpResponse.json({ error: "not found" }, { status: 404 })
      )
    )

    await expect(getProductByBarcode("12345")).resolves.toBeNull()
  })

  it("throws typed network errors on transport failures", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token-1",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    server.use(
      http.get("/api/nutrition/barcode", () => HttpResponse.error())
    )

    await expect(getProductByBarcode("12345")).rejects.toBeInstanceOf(NutritionApiError)
    await expect(getProductByBarcode("12345")).rejects.toMatchObject({ kind: "network" })
  })

  it("sends bearer token on nutrition search requests", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token-1",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    let authorizationHeader: string | null = null
    server.use(
      http.get("/api/nutrition/search", ({ request }) => {
        authorizationHeader = request.headers.get("Authorization")
        return HttpResponse.json({
          items: [],
          provider: "openfoodfacts",
          page: 0,
          hasMore: false,
        })
      })
    )

    await searchFoods("rice")

    expect(authorizationHeader).toBe("Bearer token-1")
  })

  it("refreshes and retries once when nutrition search returns 401", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "old-token",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    let searchCalls = 0
    server.use(
      http.get("/api/nutrition/search", ({ request }) => {
        searchCalls += 1
        const auth = request.headers.get("Authorization")
        if (auth === "Bearer old-token") {
          return HttpResponse.json({ error: "expired" }, { status: 401 })
        }
        if (auth === "Bearer new-token") {
          return HttpResponse.json({
            items: [],
            provider: "openfoodfacts",
            page: 0,
            hasMore: false,
          })
        }
        return HttpResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
      }),
      http.post("/api/auth/refresh", () =>
        HttpResponse.json({
          accessToken: "new-token",
          userId: "u1",
          email: "u1@example.com",
          expiresAtMs: Date.now() + 120_000,
        })
      )
    )

    const result = await searchFoods("rice")
    expect(result).toEqual({ foods: [], hasMore: false, provider: "openfoodfacts" })
    expect(searchCalls).toBe(2)
    expect(useAuthStore.getState().accessToken).toBe("new-token")
  })

  it("searches without sign-in when no auth session exists", async () => {
    let authorizationHeader: string | null = null
    let refreshCalls = 0
    server.use(
      http.get("/api/nutrition/search", ({ request }) => {
        authorizationHeader = request.headers.get("Authorization")
        return HttpResponse.json({
          items: [],
          provider: "openfoodfacts",
          page: 0,
          hasMore: false,
        })
      }),
      http.post("/api/auth/refresh", () => {
        refreshCalls += 1
        return HttpResponse.json({ error: "UNAUTHORIZED" }, { status: 401 })
      })
    )

    const result = await searchFoods("rice")
    expect(result).toEqual({ foods: [], hasMore: false, provider: "openfoodfacts" })

    expect(refreshCalls).toBe(0)
    expect(authorizationHeader).toBeNull()
  })

  it("returns active nutrition provider", async () => {
    server.use(
      http.get("/api/nutrition/provider", () =>
        HttpResponse.json({ provider: "fatsecret" })
      )
    )

    await expect(getNutritionProvider()).resolves.toBe("fatsecret")
  })
})
