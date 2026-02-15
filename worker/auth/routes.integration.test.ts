import { beforeEach, describe, expect, it, vi } from "vitest"
import { authRoutes } from "./routes"

const verifyGoogleIdTokenMock = vi.fn()

vi.mock("./google", () => ({
  verifyGoogleIdToken: (...args: unknown[]) => verifyGoogleIdTokenMock(...args),
}))

type RefreshSession = {
  session_id: string
  user_id: string
  user_email: string
  token_hash_current: string
  token_hash_previous: string | null
  previous_valid_until: number | null
  expires_at: number
  revoked_at: number | null
  created_at: number
  updated_at: number
}

function readStringArg(args: unknown[], index: number): string {
  const value = args[index]
  if (typeof value !== "string") {
    throw new TypeError(`Expected string argument at index ${index}`)
  }
  return value
}

function readNumberArg(args: unknown[], index: number): number {
  const value = args[index]
  if (typeof value !== "number") {
    throw new TypeError(`Expected number argument at index ${index}`)
  }
  return value
}

function assertJsonObject(value: unknown): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Expected JSON object response")
  }
}

class FakePrepared {
  private args: unknown[] = []
  private readonly db: FakeD1
  private readonly sql: string

  constructor(db: FakeD1, sql: string) {
    this.db = db
    this.sql = sql
  }

  bind(...args: unknown[]) {
    this.args = args
    return this
  }

  async run() {
    const sql = this.sql

    if (sql.includes("DELETE FROM refresh_sessions")) {
      if (this.db.failCleanupOnDelete) {
        throw new Error("cleanup failed")
      }
      return { success: true }
    }

    if (sql.includes("INSERT INTO refresh_sessions")) {
      const sessionId = readStringArg(this.args, 0)
      const userId = readStringArg(this.args, 1)
      const userEmail = readStringArg(this.args, 2)
      const tokenHashCurrent = readStringArg(this.args, 3)
      const expiresAt = readNumberArg(this.args, 4)
      const createdAt = readNumberArg(this.args, 5)
      const updatedAt = readNumberArg(this.args, 6)

      this.db.refreshSessions.set(sessionId, {
        session_id: sessionId,
        user_id: userId,
        user_email: userEmail,
        token_hash_current: tokenHashCurrent,
        token_hash_previous: null,
        previous_valid_until: null,
        expires_at: expiresAt,
        revoked_at: null,
        created_at: createdAt,
        updated_at: updatedAt,
      })

      return { success: true }
    }

    if (sql.includes("UPDATE refresh_sessions") && sql.includes("token_hash_previous")) {
      const nextHash = readStringArg(this.args, 0)
      const previousValidUntil = readNumberArg(this.args, 1)
      const expiresAt = readNumberArg(this.args, 2)
      const updatedAt = readNumberArg(this.args, 3)
      const sessionId = readStringArg(this.args, 4)
      const session = this.db.refreshSessions.get(sessionId)
      if (session) {
        session.token_hash_previous = session.token_hash_current
        session.token_hash_current = nextHash
        session.previous_valid_until = previousValidUntil
        session.expires_at = expiresAt
        session.updated_at = updatedAt
      }
      return { success: true }
    }

    if (sql.includes("UPDATE refresh_sessions") && sql.includes("revoked_at")) {
      const revokedAt = readNumberArg(this.args, 0)
      const updatedAt = readNumberArg(this.args, 1)
      const sessionId = readStringArg(this.args, 2)
      const session = this.db.refreshSessions.get(sessionId)
      if (session) {
        session.revoked_at = revokedAt
        session.updated_at = updatedAt
      }
      return { success: true }
    }

    if (sql.includes("INSERT INTO audit_log")) {
      return { success: true }
    }

    return { success: true }
  }

  async first() {
    const sql = this.sql

    if (sql.includes("FROM refresh_sessions") && sql.includes("WHERE session_id = ?")) {
      const sessionId = readStringArg(this.args, 0)
      return this.db.refreshSessions.get(sessionId) ?? null
    }

    return null
  }
}

class FakeD1 {
  refreshSessions = new Map<string, RefreshSession>()
  failCleanupOnDelete = false

  prepare(sql: string) {
    return new FakePrepared(this, sql)
  }
}

function parseSetCookieValue(setCookie: string | null): string {
  if (!setCookie) return ""
  const firstPart = setCookie.split(";")[0]
  const [, value] = firstPart.split("=")
  return value ?? ""
}

const TEST_ORIGIN = "http://localhost"

describe("authRoutes integration", () => {
  let db: FakeD1

  beforeEach(() => {
    db = new FakeD1()
    verifyGoogleIdTokenMock.mockReset().mockResolvedValue({
      sub: "user-1",
      email: "u@example.com",
    })
  })

  it("logs in, stores refresh session, and sets refresh cookie", async () => {
    const response = await authRoutes.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
        body: JSON.stringify({ idToken: "google-token" }),
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )

    const body = await response.json()
    assertJsonObject(body)
    const accessToken = body["accessToken"]
    expect(response.status).toBe(200)
    expect(body["userId"]).toBe("user-1")
    if (typeof accessToken !== "string") {
      throw new TypeError("Expected accessToken to be a string")
    }
    expect(accessToken.length).toBeGreaterThan(10)

    const setCookie = response.headers.get("set-cookie")
    expect(setCookie).toContain("inertia_rt=")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(response.headers.get("pragma")).toBe("no-cache")
    expect(db.refreshSessions.size).toBe(1)
  })

  it("continues login when refresh session cleanup fails", async () => {
    db.failCleanupOnDelete = true
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    try {
      const response = await authRoutes.request(
        "/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
          body: JSON.stringify({ idToken: "google-token" }),
        },
        {
          DB: db,
          JWT_SECRET: "secret",
          GOOGLE_CLIENT_ID: "google-client",
        }
      )

      expect(response.status).toBe(200)
      expect(db.refreshSessions.size).toBe(1)
      expect(consoleErrorSpy).toHaveBeenCalled()
    } finally {
      consoleErrorSpy.mockRestore()
    }
  })

  it("rejects state-changing auth requests without trusted origin", async () => {
    const response = await authRoutes.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: "google-token" }),
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )

    expect(response.status).toBe(403)
  })

  it("fails closed for non-local origins when APP_ORIGINS is not configured", async () => {
    const response = await authRoutes.request(
      "https://api.example.com/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: "https://app.example.com" },
        body: JSON.stringify({ idToken: "google-token" }),
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )

    expect(response.status).toBe(403)
    expect(verifyGoogleIdTokenMock).not.toHaveBeenCalled()
  })

  it("extends refresh session expiry when rotating refresh tokens", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date("2026-02-08T00:00:00.000Z"))

      const login = await authRoutes.request(
        "/login",
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
          body: JSON.stringify({ idToken: "google-token" }),
        },
        {
          DB: db,
          JWT_SECRET: "secret",
          GOOGLE_CLIENT_ID: "google-client",
        }
      )

      const originalToken = parseSetCookieValue(login.headers.get("set-cookie"))
      const sessionAfterLogin = db.refreshSessions.values().next().value
      if (!sessionAfterLogin) {
        throw new TypeError("Expected refresh session to be created")
      }
      const loginExpiry = sessionAfterLogin.expires_at

      vi.setSystemTime(new Date("2026-02-08T12:00:00.000Z"))
      const refresh = await authRoutes.request(
        "/refresh",
        {
          method: "POST",
          headers: { Cookie: `inertia_rt=${originalToken}`, Origin: TEST_ORIGIN },
        },
        {
          DB: db,
          JWT_SECRET: "secret",
          GOOGLE_CLIENT_ID: "google-client",
        }
      )

      expect(refresh.status).toBe(200)

      const sessionAfterRefresh = db.refreshSessions.get(sessionAfterLogin.session_id)
      if (!sessionAfterRefresh) {
        throw new TypeError("Expected refresh session after rotation")
      }
      expect(sessionAfterRefresh.expires_at).toBeGreaterThan(loginExpiry)
    } finally {
      vi.useRealTimers()
    }
  })

  it("allows previous refresh token during grace window then rejects after expiry", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-02-08T00:00:00.000Z"))

    const login = await authRoutes.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
        body: JSON.stringify({ idToken: "google-token" }),
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )

    const originalToken = parseSetCookieValue(login.headers.get("set-cookie"))

    const firstRefresh = await authRoutes.request(
      "/refresh",
      {
        method: "POST",
        headers: { Cookie: `inertia_rt=${originalToken}`, Origin: TEST_ORIGIN },
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )
    expect(firstRefresh.status).toBe(200)

    vi.setSystemTime(new Date("2026-02-08T00:00:10.000Z"))
    const graceRefresh = await authRoutes.request(
      "/refresh",
      {
        method: "POST",
        headers: { Cookie: `inertia_rt=${originalToken}`, Origin: TEST_ORIGIN },
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )
    expect(graceRefresh.status).toBe(200)

    vi.setSystemTime(new Date("2026-02-08T00:00:40.000Z"))
    const expiredOldToken = await authRoutes.request(
      "/refresh",
      {
        method: "POST",
        headers: { Cookie: `inertia_rt=${originalToken}`, Origin: TEST_ORIGIN },
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )

    expect(expiredOldToken.status).toBe(401)
    vi.useRealTimers()
  })

  it("revokes session on logout and blocks subsequent refresh", async () => {
    const login = await authRoutes.request(
      "/login",
      {
        method: "POST",
        headers: { "Content-Type": "application/json", Origin: TEST_ORIGIN },
        body: JSON.stringify({ idToken: "google-token" }),
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )

    const token = parseSetCookieValue(login.headers.get("set-cookie"))

    const logout = await authRoutes.request(
      "/logout",
      {
        method: "POST",
        headers: { Cookie: `inertia_rt=${token}`, Origin: TEST_ORIGIN },
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )

    expect(logout.status).toBe(200)

    const refresh = await authRoutes.request(
      "/refresh",
      {
        method: "POST",
        headers: { Cookie: `inertia_rt=${token}`, Origin: TEST_ORIGIN },
      },
      {
        DB: db,
        JWT_SECRET: "secret",
        GOOGLE_CLIENT_ID: "google-client",
      }
    )

    expect(refresh.status).toBe(401)
  })
})
