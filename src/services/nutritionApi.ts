/**
 * Nutrition API client for calling same-origin backend endpoints.
 * These endpoints route to the configured provider (OpenFoodFacts or FatSecret).
 */

import type { FoodItem } from "@/lib/types"
import { refreshAccessToken } from "@/features/sync/client/api"
import { useAuthStore } from "@/features/sync/runtime/store"
import { shouldAttemptSessionRestore } from "@/features/sync/client/sessionRestoreHint"

export type NutritionProviderName = "openfoodfacts" | "fatsecret"

export interface NutritionSearchResponse {
  items: FoodItem[]
  provider: NutritionProviderName
  page: number
  hasMore: boolean
}

export interface NutritionBarcodeResponse {
  item: FoodItem
  provider: NutritionProviderName
}

export interface NutritionProviderResponse {
  provider: NutritionProviderName
}

export type NutritionApiErrorKind =
  | "timeout"
  | "network"
  | "http"
  | "not_found"
  | "unknown"

export class NutritionApiError extends Error {
  kind: NutritionApiErrorKind
  status?: number

  constructor(
    kind: NutritionApiErrorKind,
    message: string,
    options?: { status?: number; cause?: unknown }
  ) {
    super(message)
    this.name = "NutritionApiError"
    this.kind = kind
    this.status = options?.status
    if (options?.cause !== undefined) {
      ;(this as { cause?: unknown }).cause = options.cause
    }
  }
}

const REQUEST_TIMEOUT_MS = 15000

async function fetchWithTimeout(
  url: string,
  init?: RequestInit,
  timeoutMs: number = REQUEST_TIMEOUT_MS
): Promise<Response> {
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    clearTimeout(timeoutId)
    return response
  } catch (error) {
    clearTimeout(timeoutId)
    if (error instanceof Error && error.name === "AbortError") {
      throw new NutritionApiError("timeout", "Request timed out")
    }
    throw new NutritionApiError(
      "network",
      error instanceof Error ? error.message : "Network error",
      { cause: error }
    )
  }
}

function getErrorMessage(data: unknown, fallback: string): string {
  if (
    data !== null &&
    typeof data === "object" &&
    "error" in data
  ) {
    const errorValue = (data as Record<string, unknown>).error
    if (typeof errorValue === "string") {
      return errorValue
    }
  }
  return fallback
}

async function resolveAccessToken(): Promise<string | null> {
  const token = useAuthStore.getState().accessToken
  if (token) {
    return token
  }

  if (!shouldAttemptSessionRestore()) {
    return null
  }

  try {
    const refreshed = await refreshAccessToken()
    return refreshed.accessToken
  } catch {
    useAuthStore.getState().clearAuth()
    return null
  }
}

function buildRequestInit(accessToken?: string | null): RequestInit {
  const headers: Record<string, string> = {}
  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`
  }

  return {
    credentials: "include",
    headers,
  }
}

async function fetchAuthorized(url: string): Promise<Response> {
  const accessToken = await resolveAccessToken()
  const response = await fetchWithTimeout(url, buildRequestInit(accessToken))
  if (response.status !== 401) {
    return response
  }

  if (!accessToken && !shouldAttemptSessionRestore()) {
    return response
  }

  try {
    const refreshed = await refreshAccessToken()
    const retryResponse = await fetchWithTimeout(url, buildRequestInit(refreshed.accessToken))
    if (retryResponse.status === 401) {
      useAuthStore.getState().clearAuth()
    }
    return retryResponse
  } catch {
    useAuthStore.getState().clearAuth()
    return response
  }
}

/**
 * Search for foods using the backend API.
 * The backend routes to the configured provider.
 */
export async function searchFoods(
  query: string,
  page: number = 0,
  limit: number = 20
): Promise<{ foods: FoodItem[]; hasMore: boolean; provider: NutritionProviderName }> {
  if (!query.trim()) {
    return { foods: [], hasMore: false, provider: "openfoodfacts" }
  }

  const params = new URLSearchParams({
    q: query,
    page: page.toString(),
    limit: limit.toString(),
  })

  const response = await fetchAuthorized(`/api/nutrition/search?${params.toString()}`)

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}))
    throw new NutritionApiError(
      "http",
      getErrorMessage(data, `Search failed: ${response.status}`),
      { status: response.status }
    )
  }

  const data: NutritionSearchResponse = await response.json()

  return {
    foods: data.items,
    hasMore: data.hasMore,
    provider: data.provider,
  }
}

export async function getNutritionProvider(): Promise<NutritionProviderName> {
  const response = await fetchAuthorized("/api/nutrition/provider")

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}))
    throw new NutritionApiError(
      "http",
      getErrorMessage(data, `Provider lookup failed: ${response.status}`),
      { status: response.status }
    )
  }

  const data: NutritionProviderResponse = await response.json()
  return data.provider
}

/**
 * Look up a product by barcode using the backend API.
 */
export async function getProductByBarcode(
  barcode: string
): Promise<FoodItem | null> {
  if (!barcode.trim()) {
    return null
  }

  const params = new URLSearchParams({ code: barcode })

  const response = await fetchAuthorized(`/api/nutrition/barcode?${params.toString()}`)

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    const data: unknown = await response.json().catch(() => ({}))
    throw new NutritionApiError(
      "http",
      getErrorMessage(data, `Barcode lookup failed: ${response.status}`),
      { status: response.status }
    )
  }

  const data: NutritionBarcodeResponse = await response.json()

  return data.item
}
