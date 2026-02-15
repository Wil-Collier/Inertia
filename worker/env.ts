/**
 * Environment bindings for the Worker
 */
import type { D1Database } from "@cloudflare/workers-types"

export interface Env {
    DB: D1Database
    JWT_SECRET: string
    GOOGLE_CLIENT_ID: string
    APP_ORIGINS?: string
    SYNC_EVENTS_RETENTION_DAYS?: string

    // Nutrition provider configuration
    NUTRITION_PROVIDER?: "openfoodfacts" | "fatsecret"
    FAT_SECRET_CLIENT_ID?: string
    FAT_SECRET_CLIENT_SECRET?: string
}
