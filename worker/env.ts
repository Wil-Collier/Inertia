/**
 * Environment bindings for the Worker
 */
export interface Env {
    // Nutrition provider configuration
    NUTRITION_PROVIDER?: "openfoodfacts" | "fatsecret"
    FAT_SECRET_CLIENT_ID?: string
    FAT_SECRET_CLIENT_SECRET?: string

    // D1 Database (for future cloud sync)
    // DB?: D1Database
}
