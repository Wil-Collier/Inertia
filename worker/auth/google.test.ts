import { afterEach, describe, expect, it, vi } from "vitest"
import { verifyGoogleIdToken } from "./google"

function mockFetchOnce(response: { ok: boolean; body: unknown }) {
  vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
    new Response(JSON.stringify(response.body), {
      status: response.ok ? 200 : 401,
      headers: {
        "Content-Type": "application/json",
      },
    })
  )
}

describe("verifyGoogleIdToken", () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it("returns verified payload when token is valid for expected client", async () => {
    mockFetchOnce({
      ok: true,
      body: {
        sub: "google-sub-1",
        email: "user@example.com",
        aud: "client-123",
        email_verified: true,
      },
    })

    await expect(verifyGoogleIdToken("id-token", "client-123")).resolves.toEqual({
      sub: "google-sub-1",
      email: "user@example.com",
    })
  })

  it("rejects invalid token responses and malformed payloads", async () => {
    mockFetchOnce({ ok: false, body: {} })
    await expect(verifyGoogleIdToken("id-token", "client-123")).rejects.toThrow("INVALID_TOKEN")

    mockFetchOnce({ ok: true, body: { aud: "client-123", email_verified: true } })
    await expect(verifyGoogleIdToken("id-token", "client-123")).rejects.toThrow("INVALID_TOKEN")
  })

  it("rejects mismatched audience or unverified email", async () => {
    mockFetchOnce({
      ok: true,
      body: {
        sub: "google-sub-1",
        email: "user@example.com",
        aud: "different-client",
        email_verified: true,
      },
    })
    await expect(verifyGoogleIdToken("id-token", "client-123")).rejects.toThrow("FORBIDDEN")

    mockFetchOnce({
      ok: true,
      body: {
        sub: "google-sub-1",
        email: "user@example.com",
        aud: "client-123",
        email_verified: false,
      },
    })
    await expect(verifyGoogleIdToken("id-token", "client-123")).rejects.toThrow("FORBIDDEN")
  })

  it("accepts string email_verified value from Google tokeninfo response", async () => {
    mockFetchOnce({
      ok: true,
      body: {
        sub: "google-sub-2",
        email: "verified@example.com",
        aud: "client-123",
        email_verified: "true",
      },
    })

    await expect(verifyGoogleIdToken("id-token", "client-123")).resolves.toEqual({
      sub: "google-sub-2",
      email: "verified@example.com",
    })
  })
})
