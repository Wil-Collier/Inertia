import { createMiddleware } from "hono/factory"

export const securityHeadersMiddleware = createMiddleware(async (c, next) => {
  await next()

  c.header("X-Content-Type-Options", "nosniff")
  c.header("X-Frame-Options", "DENY")
  c.header("Referrer-Policy", "strict-origin-when-cross-origin")
  c.header("Permissions-Policy", "camera=(self), microphone=(), geolocation=()")
  c.header("Cross-Origin-Resource-Policy", "same-origin")
  c.header("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'")
})
