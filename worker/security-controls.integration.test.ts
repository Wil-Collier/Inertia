/**
 * Security Controls Integration Tests
 *
 * These tests verify that security controls defined in AGENTS.md are properly enforced:
 * - Auth origin enforcement (403 on untrusted origin)
 * - Rate limiting behavior (429)
 * - Request validation failures (400)
 * - Payload limit enforcement (413)
 * - Auth middleware (401)
 */

import { beforeEach, describe, expect, it, vi } from "vitest"
import { sign } from "hono/jwt"
import app from "./index"

vi.mock("./auth/google", () => ({
    verifyGoogleIdToken: vi.fn().mockResolvedValue({
        sub: "user-1",
        email: "u@example.com",
    }),
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

        if (sql.includes("INSERT INTO audit_log")) {
            return { success: true }
        }

        return { success: true }
    }

    async first() {
        return null
    }

    async all() {
        return { results: [] }
    }
}

class FakeD1 {
    refreshSessions = new Map<string, RefreshSession>()

    prepare(sql: string) {
        return new FakePrepared(this, sql)
    }
}

function createEnv(db: FakeD1) {
    return {
        DB: db,
        JWT_SECRET: "test-secret",
        GOOGLE_CLIENT_ID: "google-client-id",
        APP_ORIGINS: "https://trusted.example.com",
    }
}

async function createValidToken() {
    return await sign(
        {
            sub: "u1",
            email: "u1@example.com",
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + 300,
        },
        "test-secret",
        "HS256"
    )
}

async function createExpiredToken() {
    return await sign(
        {
            sub: "u1",
            email: "u1@example.com",
            iat: Math.floor(Date.now() / 1000) - 600,
            exp: Math.floor(Date.now() / 1000) - 300,
        },
        "test-secret",
        "HS256"
    )
}

describe("Security Controls", () => {
    let db: FakeD1

    beforeEach(() => {
        db = new FakeD1()
    })

    describe("Origin Enforcement (403)", () => {
        it("returns 403 when Origin header is missing on auth endpoints", async () => {
            const response = await app.request(
                "/api/auth/login",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ idToken: "google-token" }),
                },
                createEnv(db)
            )

            expect(response.status).toBe(403)
            const body = await response.json()
            expect(body).toMatchObject({ error: "FORBIDDEN" })
        })

        it("returns 403 when Origin header is from untrusted domain", async () => {
            const response = await app.request(
                "/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Origin: "https://malicious.example.com",
                    },
                    body: JSON.stringify({ idToken: "google-token" }),
                },
                createEnv(db)
            )

            expect(response.status).toBe(403)
            const body = await response.json()
            expect(body).toMatchObject({ error: "FORBIDDEN", message: "Invalid request origin" })
        })

        it("allows request from trusted origin in APP_ORIGINS", async () => {
            const response = await app.request(
                "/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Origin: "https://trusted.example.com",
                    },
                    body: JSON.stringify({ idToken: "google-token" }),
                },
                createEnv(db)
            )

            // Should not be 403 - may be 200 or another error, but not origin rejection
            expect(response.status).not.toBe(403)
        })

        it("returns 403 for logout without trusted origin", async () => {
            const response = await app.request(
                "/api/auth/logout",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                },
                createEnv(db)
            )

            expect(response.status).toBe(403)
        })

        it("returns 403 for refresh without trusted origin", async () => {
            const response = await app.request(
                "/api/auth/refresh",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                },
                createEnv(db)
            )

            expect(response.status).toBe(403)
        })
    })

    describe("Auth Middleware (401)", () => {
        it("returns 401 for sync endpoints without bearer token", async () => {
            const response = await app.request(
                "/api/sync/push",
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ changes: [] }),
                },
                createEnv(db)
            )

            expect(response.status).toBe(401)
            const body = await response.json()
            expect(body).toMatchObject({ error: "UNAUTHORIZED", message: "Missing bearer token" })
        })

        it("allows unauthenticated nutrition endpoints", async () => {
            const response = await app.request(
                "/api/nutrition/search",
                {
                    method: "GET",
                    headers: {},
                },
                createEnv(db)
            )

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body).toMatchObject({ error: "Invalid search parameters" })
        })

        it("returns 401 for expired JWT token", async () => {
            const expiredToken = await createExpiredToken()
            const response = await app.request(
                "/api/sync/pull",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${expiredToken}`,
                    },
                    body: JSON.stringify({}),
                },
                createEnv(db)
            )

            expect(response.status).toBe(401)
            const body = await response.json()
            expect(body).toMatchObject({ error: "UNAUTHORIZED", message: "Invalid or expired token" })
        })

        it("returns 401 for invalid JWT format", async () => {
            const response = await app.request(
                "/api/sync/pull",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Bearer invalid.token.here",
                    },
                    body: JSON.stringify({}),
                },
                createEnv(db)
            )

            expect(response.status).toBe(401)
        })

        it("returns 401 when Authorization header is not Bearer format", async () => {
            const response = await app.request(
                "/api/sync/pull",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: "Basic dXNlcjpwYXNz",
                    },
                    body: JSON.stringify({}),
                },
                createEnv(db)
            )

            expect(response.status).toBe(401)
            const body = await response.json()
            expect(body).toMatchObject({ error: "UNAUTHORIZED", message: "Missing bearer token" })
        })
    })

    describe("Payload Size Limits (413)", () => {
        it("returns 413 for oversized push payload via Content-Length", async () => {
            const token = await createValidToken()
            const oversizedPayload = JSON.stringify({
                changes: [
                    {
                        collection: "foods",
                        id: "food-1",
                        data: { note: "x".repeat(1024 * 1024) },
                        baseVersion: 0,
                        mutationId: "m-1",
                    },
                ],
            })

            const response = await app.request(
                "/api/sync/push",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "Content-Length": String(oversizedPayload.length),
                    },
                    body: oversizedPayload,
                },
                createEnv(db)
            )

            expect(response.status).toBe(413)
            const body = await response.json()
            expect(body).toMatchObject({ error: "PAYLOAD_TOO_LARGE" })
        })

        it("returns 413 for oversized pull payload", async () => {
            const token = await createValidToken()
            const oversizedPayload = JSON.stringify({
                cursor: { version: 0 },
                padding: "x".repeat(70 * 1024),
            })

            const response = await app.request(
                "/api/sync/pull",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                        "Content-Length": String(oversizedPayload.length),
                    },
                    body: oversizedPayload,
                },
                createEnv(db)
            )

            expect(response.status).toBe(413)
            const body = await response.json()
            expect(body).toMatchObject({ error: "PAYLOAD_TOO_LARGE", message: "Pull payload exceeds size limit" })
        })
    })

    describe("Request Validation (400)", () => {
        it("returns 400 for invalid sync push schema", async () => {
            const token = await createValidToken()
            const response = await app.request(
                "/api/sync/push",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ changes: [{ id: "missing-collection" }] }),
                },
                createEnv(db)
            )

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body).toMatchObject({ error: "INVALID_REQUEST", message: "Invalid push payload" })
        })

        it("returns 400 for invalid sync pull schema", async () => {
            const token = await createValidToken()
            const response = await app.request(
                "/api/sync/pull",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: JSON.stringify({ cursor: { bad: true } }),
                },
                createEnv(db)
            )

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body).toMatchObject({ error: "INVALID_REQUEST", message: "Invalid pull payload" })
        })

        it("returns 400 for malformed JSON body", async () => {
            const token = await createValidToken()
            const response = await app.request(
                "/api/sync/push",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`,
                    },
                    body: "{ not valid json",
                },
                createEnv(db)
            )

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body).toMatchObject({ error: "INVALID_REQUEST", message: "Invalid JSON payload" })
        })

        it("returns 400 for invalid login payload", async () => {
            const response = await app.request(
                "/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Origin: "https://trusted.example.com",
                    },
                    body: JSON.stringify({ wrongField: "value" }),
                },
                createEnv(db)
            )

            expect(response.status).toBe(400)
            const body = await response.json()
            expect(body).toMatchObject({ error: "INVALID_TOKEN", message: "Invalid login payload" })
        })
    })

    describe("Rate Limiting (429)", () => {
        it("returns 429 when auth rate limit is exceeded", async () => {
            const env = createEnv(db)

            // Make 30 requests to fill the rate limit bucket.
            // These are independent so we fire them concurrently with Promise.all.
            const burnRequests = Array.from({ length: 30 }, () =>
                app.request(
                    "/api/auth/refresh",
                    {
                        method: "POST",
                        headers: { Origin: "https://trusted.example.com" },
                    },
                    env
                )
            )
            await Promise.all(burnRequests)

            // The 31st request should be rate limited
            const response = await app.request(
                "/api/auth/refresh",
                {
                    method: "POST",
                    headers: { Origin: "https://trusted.example.com" },
                },
                env
            )

            expect(response.status).toBe(429)
            const body = await response.json()
            expect(body).toMatchObject({ error: "RATE_LIMITED" })
            expect(response.headers.get("Retry-After")).toBeTruthy()
            expect(response.headers.get("X-RateLimit-Limit")).toBe("30")
            expect(response.headers.get("X-RateLimit-Remaining")).toBe("0")
        })
    })

    describe("Security Headers", () => {
        it("returns no-store cache control for auth error responses", async () => {
            // Use a unique IP to avoid interference from rate limit tests
            const response = await app.request(
                "/api/auth/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "CF-Connecting-IP": "10.99.99.99",
                        // Missing Origin header triggers 403 with cache headers
                    },
                    body: JSON.stringify({ idToken: "google-token" }),
                },
                createEnv(db)
            )

            expect(response.status).toBe(403)
            expect(response.headers.get("Cache-Control")).toBe("no-store")
            expect(response.headers.get("Pragma")).toBe("no-cache")
        })

        it("includes security headers on API responses", async () => {
            const response = await app.request("/api/health", {}, createEnv(db))

            expect(response.status).toBe(200)
            expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
            expect(response.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin")
        })
    })
})
