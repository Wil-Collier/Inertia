/**
 * Provider factory that returns the configured nutrition provider.
 */

import type { Env } from "../env"
import type { NutritionProvider } from "./types"
import { createOpenFoodFactsProvider } from "./openFoodFacts"
import { createFatSecretProvider } from "./fatSecret"

export function getProvider(env: Env): {
    provider: NutritionProvider
    name: "openfoodfacts" | "fatsecret"
} {
    const providerName = env.NUTRITION_PROVIDER || "openfoodfacts"

    if (providerName === "fatsecret") {
        if (!env.FAT_SECRET_CLIENT_ID || !env.FAT_SECRET_CLIENT_SECRET) {
            throw new Error(
                "FatSecret provider requires FAT_SECRET_CLIENT_ID and FAT_SECRET_CLIENT_SECRET"
            )
        }
        return {
            provider: createFatSecretProvider(env),
            name: "fatsecret",
        }
    }

    return {
        provider: createOpenFoodFactsProvider(),
        name: "openfoodfacts",
    }
}
