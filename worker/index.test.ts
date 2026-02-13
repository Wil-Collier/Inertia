import { describe, expect, it } from "vitest"
import { sign } from "hono/jwt"
import app from "./index"

function createEnv() {
  return {
    DB: {
      prepare: () => {
        throw new Error("DB should not be accessed in this test")
      },
    },
    JWT_SECRET: "test-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

async function readJson(response: Response): Promise<Record<string, unknown>> {
  const data: unknown = await response.json()
  if (isRecord(data)) {
    return data
  }
  return {}
}

describe("worker app integration", () => {
  it("serves health endpoint", async () => {
    const response = await app.request("/api/health", {}, createEnv())
    const body = await readJson(response)

    expect(response.status).toBe(200)
    expect(body.status).toBe("ok")
    expect(typeof body.timestamp).toBe("string")
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("referrer-policy")).toBe("strict-origin-when-cross-origin")
  })

  it("returns 404 for unknown API paths", async () => {
    const response = await app.request("/api/missing", {}, createEnv())
    const body = await readJson(response)

    expect(response.status).toBe(404)
    expect(body).toEqual({ error: "Not found" })
  })

  it("requires auth for sync routes", async () => {
    const response = await app.request(
      "/api/sync/pull",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ limit: 1 }),
      },
      createEnv()
    )

    const body = await readJson(response)
    expect(response.status).toBe(401)
    expect(body.error).toBe("UNAUTHORIZED")
  })

  it("allows unauthenticated nutrition route access", async () => {
    const response = await app.request("/api/nutrition/search", {}, createEnv())
    const body = await readJson(response)

    expect(response.status).toBe(400)
    expect(body.error).toBe("Invalid search parameters")
  })

  it("accepts valid auth and validates pull payload", async () => {
    const token = await sign(
      {
        sub: "u1",
        email: "u1@example.com",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 300,
      },
      "test-secret",
      "HS256"
    )

    const response = await app.request(
      "/api/sync/pull",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ limit: 0 }),
      },
      createEnv()
    )

    const body = await readJson(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("INVALID_REQUEST")
  })

  it("validates auth login payload", async () => {
    const response = await app.request(
      "/api/auth/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "http://localhost" },
        body: JSON.stringify({}),
      },
      createEnv()
    )

    const body = await readJson(response)
    expect(response.status).toBe(400)
    expect(body.error).toBe("INVALID_TOKEN")
  })

  it("applies auth rate limiting after repeated requests", async () => {
    const requests = Array.from({ length: 31 }, () =>
      app.request(
        "/api/auth/login",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Origin: "http://localhost",
            "CF-Connecting-IP": "198.51.100.7",
          },
          body: JSON.stringify({}),
        },
        createEnv()
      )
    )

    const responses = await Promise.all(requests)
    expect(responses.some((response) => response.status === 429)).toBe(true)
  })
})
