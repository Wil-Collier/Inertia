import { beforeEach, describe, expect, it, vi } from "vitest"
import { NutritionApiError, getProductByBarcode, searchFoods } from "@/services/nutritionApi"
import { useAuthStore } from "@/features/sync/store"

const refreshAccessTokenMock = vi.fn()

vi.mock("@/features/sync/api", () => ({
  refreshAccessToken: (...args: unknown[]) => refreshAccessTokenMock(...args),
  SyncApiError: class SyncApiError extends Error {
    readonly status?: number

    constructor(message: string, _code?: string, status?: number) {
      super(message)
      this.status = status
    }
  },
}))

describe("nutritionApi service", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    refreshAccessTokenMock.mockReset()
    localStorage.clear()
    useAuthStore.getState().clearAuth()
  })

  it("returns empty result for blank queries without calling fetch", async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal("fetch", fetchMock)

    const result = await searchFoods("   ")

    expect(result).toEqual({ foods: [], hasMore: false })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("maps HTTP failures to NutritionApiError with server message", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token-1",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

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

    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ error: "not found" }), { status: 404 })))

    await expect(getProductByBarcode("12345")).resolves.toBeNull()
  })

  it("throws typed network errors on transport failures", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "token-1",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    vi.stubGlobal("fetch", vi.fn(async () => {
      throw new Error("network down")
    }))

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

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          items: [],
          provider: "openfoodfacts",
          page: 0,
          hasMore: false,
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    await searchFoods("rice")

    const init = fetchMock.mock.calls[0]?.[1]
    const authHeader = init?.headers ? new Headers(init.headers).get("Authorization") : null
    expect(authHeader).toBe("Bearer token-1")
  })

  it("refreshes and retries once when nutrition search returns 401", async () => {
    useAuthStore.getState().setAuth({
      accessToken: "old-token",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 60_000,
    })

    refreshAccessTokenMock.mockResolvedValue({
      accessToken: "new-token",
      userId: "u1",
      email: "u1@example.com",
      expiresAtMs: Date.now() + 120_000,
    })

    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const auth = init?.headers ? new Headers(init.headers).get("Authorization") : null
      if (auth === "Bearer old-token") {
        return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "expired" }), { status: 401 })
      }
      return new Response(
        JSON.stringify({
          items: [],
          provider: "openfoodfacts",
          page: 0,
          hasMore: false,
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await searchFoods("rice")
    expect(result).toEqual({ foods: [], hasMore: false })
    expect(refreshAccessTokenMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it("searches without sign-in when no auth session exists", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          items: [],
          provider: "openfoodfacts",
          page: 0,
          hasMore: false,
        }),
        { status: 200 }
      )
    })
    vi.stubGlobal("fetch", fetchMock)

    const result = await searchFoods("rice")
    expect(result).toEqual({ foods: [], hasMore: false })

    expect(refreshAccessTokenMock).not.toHaveBeenCalled()
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const init = fetchMock.mock.calls[0]?.[1]
    const authHeader = init?.headers ? new Headers(init.headers).get("Authorization") : null
    expect(authHeader).toBeNull()
  })
})
