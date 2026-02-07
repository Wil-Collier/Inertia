import {
  ErrorResponseSchema,
  LoginResponseSchema,
  LogoutResponseSchema,
  PullResponseSchema,
  PushResponseSchema,
  RefreshResponseSchema,
} from "@/features/sync/schemas"
import type {
  LoginResponse,
  LogoutResponse,
  PullRequest,
  PullResponse,
  PushRequest,
  PushResponse,
  RefreshResponse,
} from "@/features/sync/schemas"
import { useAuthStore } from "@/features/sync/store"

class SyncApiError extends Error {
  readonly code?: string
  readonly status?: number

  constructor(message: string, code?: string, status?: number) {
    super(message)
    this.code = code
    this.status = status
  }
}

async function requestJson<T>(
  path: string,
  options: RequestInit,
  parser: (data: unknown) => T
): Promise<T> {
  const response = await fetch(path, options)
  const text = await response.text()
  let data: unknown = null
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = null
    }
  }

  if (!response.ok) {
    const parsedError = ErrorResponseSchema.safeParse(data)
    if (parsedError.success) {
      throw new SyncApiError(parsedError.data.message, parsedError.data.error, response.status)
    }
    throw new SyncApiError("Unexpected server error", "SERVER_ERROR", response.status)
  }

  return parser(data)
}

export async function loginWithGoogle(idToken: string): Promise<LoginResponse> {
  return await requestJson(
    "/api/auth/login",
    {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    },
    (data) => LoginResponseSchema.parse(data)
  )
}

export async function refreshAccessToken(): Promise<RefreshResponse> {
  const refreshed = await requestJson(
    "/api/auth/refresh",
    {
      method: "POST",
      credentials: "include",
    },
    (data) => RefreshResponseSchema.parse(data)
  )

  useAuthStore.getState().setAccessToken({
    accessToken: refreshed.accessToken,
    expiresAtMs: refreshed.expiresAtMs,
  })

  return refreshed
}

export async function logoutSession(): Promise<LogoutResponse> {
  return await requestJson(
    "/api/auth/logout",
    {
      method: "POST",
      credentials: "include",
    },
    (data) => LogoutResponseSchema.parse(data)
  )
}

export async function pushChanges(accessToken: string, payload: PushRequest): Promise<PushResponse> {
  return await authorizedRequest(
    accessToken,
    "/api/sync/push",
    payload,
    (data) => PushResponseSchema.parse(data)
  )
}

export async function pullChanges(accessToken: string, payload: PullRequest): Promise<PullResponse> {
  return await authorizedRequest(
    accessToken,
    "/api/sync/pull",
    payload,
    (data) => PullResponseSchema.parse(data)
  )
}

async function authorizedRequest<T>(
  accessToken: string,
  path: string,
  payload: unknown,
  parser: (data: unknown) => T
): Promise<T> {
  try {
    return await requestJson(
      path,
      {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify(payload),
      },
      parser
    )
  } catch (error) {
    if (!(error instanceof SyncApiError) || error.status !== 401) {
      throw error
    }

    try {
      const refreshed = await refreshAccessToken()
      return await requestJson(
        path,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${refreshed.accessToken}`,
          },
          body: JSON.stringify(payload),
        },
        parser
      )
    } catch {
      useAuthStore.getState().clearAuth()
      throw error
    }
  }
}

export { SyncApiError }
