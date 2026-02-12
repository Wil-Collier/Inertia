import { Hono } from "hono"
import { deleteCookie, getCookie, setCookie } from "hono/cookie"
import { sign } from "hono/jwt"
import type { Env } from "../env"
import { verifyGoogleIdToken } from "./google"
import { LoginRequestSchema } from "../../shared/syncSchemas"
import { logAudit } from "../lib/db"

const ACCESS_TOKEN_TTL_MS = 15 * 60 * 1000
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000
const PREVIOUS_TOKEN_GRACE_MS = 30 * 1000
const REFRESH_COOKIE_NAME = "inertia_rt"
const REFRESH_COOKIE_PATH = "/api/auth"

type RefreshSessionRow = {
  session_id: string
  user_id: string
  user_email: string
  token_hash_current: string
  token_hash_previous: string | null
  previous_valid_until: number | null
  expires_at: number
  revoked_at: number | null
}

export const authRoutes = new Hono<{ Bindings: Env }>()

authRoutes.use("*", async (c, next) => {
  if (c.req.method === "POST" && !isTrustedOrigin(c)) {
    c.header("Cache-Control", "no-store")
    c.header("Pragma", "no-cache")
    return c.json({ error: "FORBIDDEN", message: "Invalid request origin" }, 403)
  }

  await next()
  c.header("Cache-Control", "no-store")
  c.header("Pragma", "no-cache")
})

authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json()
    const parsed = LoginRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: "INVALID_TOKEN", message: "Invalid login payload" }, 400)
    }

    const { idToken } = parsed.data
    const verified = await verifyGoogleIdToken(idToken, c.env.GOOGLE_CLIENT_ID)

    const sessionId = crypto.randomUUID()
    const refreshSecret = createOpaqueToken()
    const refreshToken = `${sessionId}.${refreshSecret}`
    const refreshTokenHash = await sha256Hex(refreshToken)

    const now = Date.now()
    const refreshExpiresAtMs = now + REFRESH_TOKEN_TTL_MS

    await c.env.DB
      .prepare(`
        INSERT INTO refresh_sessions
          (session_id, user_id, user_email, token_hash_current, token_hash_previous, previous_valid_until, expires_at, revoked_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, NULL, NULL, ?, NULL, ?, ?)
      `)
      .bind(
        sessionId,
        verified.sub,
        verified.email,
        refreshTokenHash,
        refreshExpiresAtMs,
        now,
        now
      )
      .run()

    const access = await createAccessToken({
      userId: verified.sub,
      email: verified.email,
      secret: c.env.JWT_SECRET,
    })

    setRefreshCookie(c, refreshToken, REFRESH_TOKEN_TTL_MS)

    await logAudit(c.env.DB, {
      userId: verified.sub,
      userEmail: verified.email,
      action: "login",
    })

    return c.json({
      accessToken: access.token,
      userId: verified.sub,
      email: verified.email,
      expiresAtMs: access.expiresAtMs,
    })
  } catch (error) {
    const code = error instanceof Error ? error.message : "SERVER_ERROR"
    if (code === "INVALID_TOKEN") {
      return c.json({ error: "INVALID_TOKEN", message: "Invalid Google token" }, 401)
    }
    if (code === "FORBIDDEN") {
      return c.json({ error: "FORBIDDEN", message: "Account not allowed" }, 403)
    }
    return c.json({ error: "SERVER_ERROR", message: "Failed to sign in" }, 500)
  }
})

authRoutes.post("/refresh", async (c) => {
  const now = Date.now()
  const refreshToken = getCookie(c, REFRESH_COOKIE_NAME)
  const sessionId = getSessionIdFromToken(refreshToken)
  if (!refreshToken || !sessionId) {
    clearRefreshCookie(c)
    return c.json({ error: "UNAUTHORIZED", message: "Missing refresh token" }, 401)
  }

  const session = await c.env.DB
    .prepare(`
      SELECT session_id, user_id, user_email, token_hash_current, token_hash_previous, previous_valid_until, expires_at, revoked_at
      FROM refresh_sessions
      WHERE session_id = ?
    `)
    .bind(sessionId)
    .first<RefreshSessionRow>()

  if (!session || session.revoked_at !== null || session.expires_at <= now) {
    clearRefreshCookie(c)
    return c.json({ error: "UNAUTHORIZED", message: "Refresh session expired" }, 401)
  }

  const incomingHash = await sha256Hex(refreshToken)
  const matchesCurrent = incomingHash === session.token_hash_current
  const matchesPrevious =
    incomingHash === session.token_hash_previous &&
    session.previous_valid_until !== null &&
    session.previous_valid_until >= now

  if (!matchesCurrent && !matchesPrevious) {
    clearRefreshCookie(c)
    return c.json({ error: "UNAUTHORIZED", message: "Invalid refresh token" }, 401)
  }

  const nextRefreshToken = `${session.session_id}.${createOpaqueToken()}`
  const nextRefreshHash = await sha256Hex(nextRefreshToken)
  const nextRefreshExpiresAtMs = now + REFRESH_TOKEN_TTL_MS

  await c.env.DB
    .prepare(`
      UPDATE refresh_sessions
      SET token_hash_previous = token_hash_current,
          token_hash_current = ?,
          previous_valid_until = ?,
          expires_at = ?,
          updated_at = ?
      WHERE session_id = ?
    `)
    .bind(
      nextRefreshHash,
      now + PREVIOUS_TOKEN_GRACE_MS,
      nextRefreshExpiresAtMs,
      now,
      session.session_id
    )
    .run()

  const access = await createAccessToken({
    userId: session.user_id,
    email: session.user_email,
    secret: c.env.JWT_SECRET,
  })

  setRefreshCookie(c, nextRefreshToken, REFRESH_TOKEN_TTL_MS)

  await logAudit(c.env.DB, {
    userId: session.user_id,
    userEmail: session.user_email,
    action: "refresh",
  })

  return c.json({
    accessToken: access.token,
    userId: session.user_id,
    email: session.user_email,
    expiresAtMs: access.expiresAtMs,
  })
})

authRoutes.post("/logout", async (c) => {
  const refreshToken = getCookie(c, REFRESH_COOKIE_NAME)
  const sessionId = getSessionIdFromToken(refreshToken)
  const now = Date.now()

  if (sessionId) {
    await c.env.DB
      .prepare("UPDATE refresh_sessions SET revoked_at = ?, updated_at = ? WHERE session_id = ?")
      .bind(now, now, sessionId)
      .run()
  }

  clearRefreshCookie(c)
  return c.json({ success: true as const })
})

function getSessionIdFromToken(token: string | undefined): string | null {
  if (!token) return null
  const [sessionId, secret] = token.split(".")
  if (!sessionId || !secret) return null
  return sessionId
}

function setRefreshCookie(c: Parameters<typeof setCookie>[0], value: string, ttlMs: number): void {
  setCookie(c, REFRESH_COOKIE_NAME, value, {
    httpOnly: true,
    sameSite: "Strict",
    secure: c.req.url.startsWith("https://"),
    path: REFRESH_COOKIE_PATH,
    maxAge: Math.floor(ttlMs / 1000),
  })
}

function clearRefreshCookie(c: Parameters<typeof setCookie>[0]): void {
  deleteCookie(c, REFRESH_COOKIE_NAME, {
    path: REFRESH_COOKIE_PATH,
  })
}

async function createAccessToken(args: {
  userId: string
  email: string
  secret: string
}): Promise<{ token: string; expiresAtMs: number }> {
  const nowSeconds = Math.floor(Date.now() / 1000)
  const expSeconds = nowSeconds + Math.floor(ACCESS_TOKEN_TTL_MS / 1000)
  const token = await sign(
    {
      sub: args.userId,
      email: args.email,
      iat: nowSeconds,
      exp: expSeconds,
    },
    args.secret,
    "HS256"
  )

  return {
    token,
    expiresAtMs: expSeconds * 1000,
  }
}

function createOpaqueToken(bytes = 32): string {
  const buffer = new Uint8Array(bytes)
  crypto.getRandomValues(buffer)
  return toBase64Url(buffer)
}

async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest("SHA-256", data)
  const bytes = new Uint8Array(digest)
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
}

function toBase64Url(bytes: Uint8Array): string {
  const binary = Array.from(bytes)
    .map((byte) => String.fromCharCode(byte))
    .join("")
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "")
}

function isTrustedOrigin(c: { req: { header: (name: string) => string | undefined; url: string }; env: Env }): boolean {
  const requestOrigin = getRequestOrigin(c.req.header("Origin"), c.req.header("Referer"))
  if (!requestOrigin) return false

  const configuredOrigins = c.env.APP_ORIGINS
    ?.split(",")
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => origin !== null)

  if (configuredOrigins && configuredOrigins.length > 0) {
    return configuredOrigins.includes(requestOrigin)
  }

  // Fail closed in production when APP_ORIGINS is not configured.
  // Localhost fallback is retained for local development and tests.
  const apiOrigin = normalizeOrigin(c.req.url)
  return apiOrigin !== null && isLocalhostOrigin(apiOrigin) && isLocalhostOrigin(requestOrigin)
}

function getRequestOrigin(originHeader?: string, refererHeader?: string): string | null {
  const explicitOrigin = normalizeOrigin(originHeader)
  if (explicitOrigin) {
    return explicitOrigin
  }
  return normalizeOrigin(refererHeader)
}

function normalizeOrigin(urlLike: string | undefined): string | null {
  if (!urlLike) return null
  try {
    return new URL(urlLike).origin
  } catch {
    return null
  }
}

function isLocalhostOrigin(origin: string): boolean {
  try {
    const hostname = new URL(origin).hostname
    return hostname === "localhost" || hostname === "127.0.0.1" || hostname === "::1"
  } catch {
    return false
  }
}
