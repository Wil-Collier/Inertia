import { Hono } from "hono"
import { sign } from "hono/jwt"
import type { Env } from "../env"
import { verifyGoogleIdToken } from "./google"
import { LoginRequestSchema } from "../../shared/syncSchemas"
import { logAudit } from "../lib/db"

const TOKEN_TTL_DAYS = 90

export const authRoutes = new Hono<{ Bindings: Env }>()

authRoutes.post("/login", async (c) => {
  try {
    const body = await c.req.json()
    const parsed = LoginRequestSchema.safeParse(body)
    if (!parsed.success) {
      return c.json({ error: "INVALID_TOKEN", message: "Invalid login payload" }, 400)
    }

    const { idToken } = parsed.data
    const verified = await verifyGoogleIdToken(idToken, c.env.GOOGLE_CLIENT_ID)

    const nowSeconds = Math.floor(Date.now() / 1000)
    const expSeconds = nowSeconds + TOKEN_TTL_DAYS * 24 * 60 * 60

    const token = await sign(
      {
        sub: verified.sub,
        email: verified.email,
        iat: nowSeconds,
        exp: expSeconds,
      },
      c.env.JWT_SECRET,
      "HS256"
    )

    await logAudit(c.env.DB, {
      userId: verified.sub,
      userEmail: verified.email,
      action: "login",
    })

    return c.json({
      accessToken: token,
      userId: verified.sub,
      email: verified.email,
      expiresAtMs: expSeconds * 1000,
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
