/**
 * Inertia API Worker
 *
 * Main entry point for the Cloudflare Worker.
 * Uses Hono for routing with middleware support.
 */

import { Hono } from "hono"
import { logger } from "hono/logger"
import type { Env } from "./env"
import { nutrition } from "./nutrition/routes"
import { authRoutes } from "./auth/routes"
import { syncRoutes } from "./sync/routes"
import { authMiddleware } from "./middleware/auth"
import { securityHeadersMiddleware } from "./middleware/securityHeaders"
import { createRateLimitMiddleware } from "./middleware/rateLimit"
import { compactSyncEvents } from "./sync/compaction"
import type { ExecutionContext, ScheduledEvent } from "@cloudflare/workers-types"

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>()

function isVitestRuntime(): boolean {
  const processLike = Reflect.get(globalThis, "process")
  if (typeof processLike !== "object" || processLike === null) {
    return false
  }

  const envLike = Reflect.get(processLike, "env")
  if (typeof envLike !== "object" || envLike === null) {
    return false
  }

  return Reflect.get(envLike, "VITEST") === "true"
}

function hasFileExtension(pathname: string): boolean {
  const lastSegment = pathname.split("/").at(-1) ?? ""
  return lastSegment.includes(".")
}

function isNavigationRequest(request: Request): boolean {
  if (request.method !== "GET" && request.method !== "HEAD") {
    return false
  }

  const secFetchMode = request.headers.get("sec-fetch-mode")
  if (secFetchMode && secFetchMode !== "navigate") {
    return false
  }

  const accept = request.headers.get("accept") ?? ""
  return accept.includes("text/html")
}

// Middleware
if (!isVitestRuntime()) {
  app.use("*", logger())
}
app.use("/api/*", securityHeadersMiddleware)
app.use("/api/auth/*", createRateLimitMiddleware({ bucket: "auth", windowMs: 60_000, max: 30 }))
app.use("/api/sync/*", createRateLimitMiddleware({ bucket: "sync", windowMs: 60_000, max: 240 }))
app.use("/api/nutrition/*", createRateLimitMiddleware({ bucket: "nutrition", windowMs: 60_000, max: 120 }))

// Global error handler — prevent leaking internal details
app.onError((err, c) => {
    console.error("Unhandled error:", err)
    return c.json({ error: "Internal server error" }, 500)
})

// Mount nutrition routes (auth required)
// Nutrition catalog routes are public (search/barcode) and remain rate limited.
app.route("/api/nutrition", nutrition)

// Auth routes (no auth required)
app.route("/api/auth", authRoutes)

// Sync routes (auth required)
app.use("/api/sync/*", authMiddleware)
app.route("/api/sync", syncRoutes)

// Health check endpoint
app.get("/api/health", (c) => {
    return c.json({
        status: "ok",
        timestamp: new Date().toISOString(),
    })
})

// 404 for unmatched API routes
app.all("/api/*", (c) => {
    return c.json({ error: "Not found" }, 404)
})

// Serve the SPA shell for real navigation requests and proxy everything else
// to the asset binding so existing assets resolve and missing assets stay 404s.
app.on(["GET", "HEAD"], "*", async (c) => {
  const request = c.req.raw
  const url = new URL(request.url)

  if (!c.env.ASSETS) {
    return c.notFound()
  }

  if (isNavigationRequest(request) && !hasFileExtension(url.pathname)) {
    // Cloudflare's asset binding redirects /index.html to /. Fetching the
    // canonical root directly avoids a redirect loop when this worker handles /.
    const indexUrl = new URL("/", url)
    return await c.env.ASSETS.fetch(new Request(indexUrl.toString(), request))
  }

  return await c.env.ASSETS.fetch(request)
})

export default app

export async function scheduled(
  _event: ScheduledEvent,
  env: Env,
  ctx: ExecutionContext
): Promise<void> {
  const retentionDays = Number(env.SYNC_EVENTS_RETENTION_DAYS ?? "30")
  const safeRetentionDays = Number.isFinite(retentionDays) && retentionDays > 0 ? retentionDays : 30

  ctx.waitUntil(
    compactSyncEvents(env.DB, { retentionDays: safeRetentionDays }).catch((error) => {
      console.error("Failed to compact sync_events:", error)
    })
  )
}
