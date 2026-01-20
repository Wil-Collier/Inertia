import type { WorkoutTemplate } from "@/lib/types"

/**
 * Default workout templates shipped with the app.
 * 
 * Currently empty - templates are seeded via devSeeding in development
 * or created by users. This file is kept for future use when default
 * templates may be added for new users.
 * 
 * @see src/services/devSeeding.ts for development seed data
 */
export const defaultTemplates: WorkoutTemplate[] = []
