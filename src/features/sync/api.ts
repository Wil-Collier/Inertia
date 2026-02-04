import { ErrorResponseSchema, LoginResponseSchema, PullResponseSchema, PushResponseSchema } from "@/features/sync/schemas"
import type { LoginResponse, PullRequest, PullResponse, PushRequest, PushResponse } from "@/features/sync/schemas"

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
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ idToken }),
    },
    (data) => {
      const parsed = LoginResponseSchema.parse(data)
      return parsed
    }
  )
}

export async function pushChanges(accessToken: string, payload: PushRequest): Promise<PushResponse> {
  return await requestJson(
    "/api/sync/push",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    (data) => PushResponseSchema.parse(data)
  )
}

export async function pullChanges(accessToken: string, payload: PullRequest): Promise<PullResponse> {
  return await requestJson(
    "/api/sync/pull",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify(payload),
    },
    (data) => PullResponseSchema.parse(data)
  )
}

export { SyncApiError }
