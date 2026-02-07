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

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>()

// Middleware
app.use("*", logger())
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
app.use("/api/nutrition/*", authMiddleware)
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

export default app
