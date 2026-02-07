import { createMiddleware } from "hono/factory"

interface RateLimitOptions {
  bucket: string
  windowMs: number
  max: number
}

type Counter = {
  count: number
  resetAt: number
}

const counters = new Map<string, Counter>()
let lastCleanupAt = 0

const CLEANUP_INTERVAL_MS = 60 * 1000

export function createRateLimitMiddleware(options: RateLimitOptions) {
  return createMiddleware(async (c, next) => {
    const now = Date.now()

    if (now - lastCleanupAt >= CLEANUP_INTERVAL_MS) {
      cleanupCounters(now)
      lastCleanupAt = now
    }

    const clientKey = getClientKey(c)
    const key = `${options.bucket}:${clientKey}`
    const existing = counters.get(key)

    const counter =
      !existing || existing.resetAt <= now
        ? { count: 1, resetAt: now + options.windowMs }
        : { count: existing.count + 1, resetAt: existing.resetAt }

    counters.set(key, counter)

    const remaining = Math.max(0, options.max - counter.count)
    const retryAfterSeconds = Math.max(1, Math.ceil((counter.resetAt - now) / 1000))

    c.header("X-RateLimit-Limit", String(options.max))
    c.header("X-RateLimit-Remaining", String(remaining))
    c.header("X-RateLimit-Reset", String(Math.floor(counter.resetAt / 1000)))

    if (counter.count > options.max) {
      c.header("Retry-After", String(retryAfterSeconds))
      return c.json({ error: "RATE_LIMITED", message: "Too many requests. Please retry later." }, 429)
    }

    await next()
  })
}

function cleanupCounters(now: number): void {
  counters.forEach((counter, key) => {
    if (counter.resetAt <= now) {
      counters.delete(key)
    }
  })
}

function getClientKey(c: { req: { header: (name: string) => string | undefined } }): string {
  const cfConnectingIp = c.req.header("CF-Connecting-IP")?.trim()
  if (cfConnectingIp) return cfConnectingIp

  const xForwardedFor = c.req.header("X-Forwarded-For")
  if (xForwardedFor) {
    const [firstIp] = xForwardedFor.split(",")
    const parsed = firstIp?.trim()
    if (parsed) return parsed
  }

  const xRealIp = c.req.header("X-Real-IP")?.trim()
  if (xRealIp) return xRealIp

  return "unknown"
}
