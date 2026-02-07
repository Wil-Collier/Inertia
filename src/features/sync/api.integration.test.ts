import { beforeEach, describe, expect, it, vi } from "vitest"
import { loginWithGoogle, pullChanges, pushChanges } from "@/features/sync/api"
import { useAuthStore } from "@/features/sync/store"
import type { PullRequest, PushRequest } from "@/features/sync/schemas"

function setAuthState() {
  useAuthStore.setState({
    accessToken: "old-token",
    userId: "u1",
    email: "u1@example.com",
    expiresAtMs: Date.now() + 60_000,
    isAuthenticated: true,
  })
}

describe("sync API integration", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    localStorage.clear()
    useAuthStore.getState().clearAuth()
  })

  it("parses successful login response", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => {
      return new Response(
        JSON.stringify({
          accessToken: "token-1",
          userId: "u1",
          email: "u1@example.com",
          expiresAtMs: Date.now() + 60_000,
        }),
        { status: 200 }
      )
    })

    vi.stubGlobal("fetch", fetchMock)

    const response = await loginWithGoogle("google-id-token")
    expect(response.userId).toBe("u1")

    const firstCall = fetchMock.mock.calls[0]
    const maybeInit = firstCall && firstCall.length > 1 ? firstCall[1] : undefined
    const credentials =
      maybeInit && typeof maybeInit === "object" && "credentials" in maybeInit
        ? maybeInit.credentials
        : undefined
    expect(credentials).toBe("include")
  })

  it("refreshes on 401 and retries push once", async () => {
    setAuthState()

    const payload: PushRequest = {
      changes: [
        {
          collection: "workouts",
          id: "w1",
          data: { id: "w1", name: "Workout" },
          baseVersion: 0,
          mutationId: "m1",
          deviceId: "d1",
        },
      ],
    }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      const auth = init?.headers ? new Headers(init.headers).get("Authorization") : null

      if (url === "/api/sync/push" && auth === "Bearer old-token") {
        return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "expired" }), { status: 401 })
      }

      if (url === "/api/auth/refresh") {
        return new Response(JSON.stringify({ accessToken: "new-token", expiresAtMs: Date.now() + 120_000 }), {
          status: 200,
        })
      }

      if (url === "/api/sync/push" && auth === "Bearer new-token") {
        return new Response(
          JSON.stringify({
            accepted: 1,
            acceptedChanges: [{ collection: "workouts", id: "w1", version: 1, mutationId: "m1" }],
            conflicts: [],
          }),
          { status: 200 }
        )
      }

      return new Response(JSON.stringify({ error: "NOT_FOUND", message: "unknown" }), { status: 404 })
    })

    vi.stubGlobal("fetch", fetchMock)

    const response = await pushChanges("old-token", payload)
    expect(response.accepted).toBe(1)
    expect(useAuthStore.getState().accessToken).toBe("new-token")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("clears auth state when retry also returns 401", async () => {
    setAuthState()

    const payload: PullRequest = { cursor: { version: 0 }, limit: 10 }

    const fetchMock = vi.fn(async (input: RequestInfo | URL, _init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url

      if (url === "/api/sync/pull") {
        return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "expired" }), { status: 401 })
      }

      if (url === "/api/auth/refresh") {
        return new Response(JSON.stringify({ accessToken: "new-token", expiresAtMs: Date.now() + 60_000 }), {
          status: 200,
        })
      }

      return new Response(JSON.stringify({ error: "NOT_FOUND", message: "unknown" }), { status: 404 })
    })

    vi.stubGlobal("fetch", fetchMock)

    await expect(pullChanges("old-token", payload)).rejects.toThrow("expired")
    expect(useAuthStore.getState().isAuthenticated).toBe(false)
  })
})
