import { createMiddleware } from "hono/factory"
import { verify } from "hono/jwt"
import type { Env } from "../env"

type Variables = {
  userId: string
  userEmail: string
}

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header("Authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return c.json({ error: "UNAUTHORIZED", message: "Missing bearer token" }, 401)
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verify(token, c.env.JWT_SECRET, "HS256")
      const userId = typeof payload.sub === "string" ? payload.sub : null
      if (!userId) {
        return c.json({ error: "UNAUTHORIZED", message: "Invalid token payload" }, 401)
      }
      const userEmail = typeof payload.email === "string" ? payload.email : ""
      c.set("userId", userId)
      c.set("userEmail", userEmail)
      await next()
    } catch {
      return c.json({ error: "UNAUTHORIZED", message: "Invalid or expired token" }, 401)
    }
  }
)
