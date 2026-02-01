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

// Create the main Hono app
const app = new Hono<{ Bindings: Env }>()

// Middleware
app.use("*", logger())

// Mount nutrition routes
app.route("/api/nutrition", nutrition)

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
