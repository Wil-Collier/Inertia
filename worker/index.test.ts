import { describe, expect, it } from "vitest"
import { sign } from "hono/jwt"
import app from "./index"
import { isRecord } from "./lib/typeGuards"

function createEnv() {
  return {
    ASSETS: {
      fetch: async (input: RequestInfo | URL) => {
        const request = input instanceof Request ? input : new Request(input)
        const url = new URL(request.url)

        if (url.pathname === "/index.html") {
          const body = request.method === "HEAD"
            ? null
            : "<!doctype html><html><body>Inertia</body></html>"
          return new Response(body, {
            headers: { "Content-Type": "text/html; charset=utf-8" },
          })
        }

        if (url.pathname === "/assets/app.js") {
          return new Response("console.log('Inertia')", {
            headers: { "Content-Type": "text/javascript; charset=utf-8" },
          })
        }

        return new Response("Not found", { status: 404 })
      },
    },
    DB: {
      prepare: () => {
        throw new Error("DB should not be accessed in this test")
      },
    },
    JWT_SECRET: "test-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
  }
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

  it("serves index.html for non-api navigation routes", async () => {
    const response = await app.request(
      "/dashboard",
      {
        headers: {
          Accept: "text/html",
          "sec-fetch-mode": "navigate",
        },
      },
      createEnv()
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/html")
    await expect(response.text()).resolves.toContain("Inertia")
  })

  it("serves navigation headers without a body for HEAD routes", async () => {
    const response = await app.request(
      "/workout",
      {
        method: "HEAD",
        headers: {
          Accept: "text/html",
          "sec-fetch-mode": "navigate",
        },
      },
      createEnv()
    )

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/html")
    await expect(response.text()).resolves.toBe("")
  })

  it("returns 404 for missing asset-like paths instead of html fallback", async () => {
    const response = await app.request(
      "/assets/missing-chunk.js",
      {
        headers: {
          Accept: "*/*",
        },
      },
      createEnv()
    )

    expect(response.status).toBe(404)
    expect(response.headers.get("Content-Type") ?? "").not.toContain("text/html")
  })

  it("proxies existing asset requests to the asset binding", async () => {
    const response = await app.request("/assets/app.js", {}, createEnv())

    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("text/javascript")
    await expect(response.text()).resolves.toContain("Inertia")
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
    expect(body.error).toBe("INVALID_REQUEST")
    expect(body.message).toBe("Invalid search parameters")
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

    const responses = await Promise.all(requests.map((request) => Promise.resolve(request)))
    expect(responses.some((response) => response.status === 429)).toBe(true)
  })
})
