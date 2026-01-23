# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Inertia is an offline-first Progressive Web App (PWA) for tracking workouts, nutrition ("fuel"), and body progress. Built with React 19, Vite 7, TypeScript, and TanStack Router, it uses IndexedDB (via Dexie.js) for local-first data persistence.

## Commands

### Development
```bash
pnpm install          # Install dependencies
pnpm dev              # Start dev server (includes --host flag for network access)
pnpm build            # Type-check with tsc then build with Vite
pnpm preview          # Preview production build
pnpm lint             # Run oxlint with type-checking enabled
pnpm seed             # Open dev server with ?seed=true query param for test data
```

### Validation
Always run `pnpm build && pnpm lint` before completing tasks. The build includes TypeScript compilation (`tsc -b`) followed by Vite bundling.

## Architecture

### Data Layer (Dexie.js + IndexedDB)

**Database Definition:** `src/services/db.ts` exports the singleton `db` instance of `TrainingAppDatabase`.

**Schema:**
- Tables include: `customExercises`, `workoutSessions`, `workoutTemplates`, `personalRecords`, `foods`, `nutritionLogs`, `mealTemplates`, `settings`, `bodyWeight`, `achievements`, `restTimer`, `activeSession`, `metadata`, `userStats`
- **Exercise Storage Strategy:** Default exercises come from the static `src/data/exerciseDatabase.ts` module (bundled with app). Only user-created custom exercises are stored in IndexedDB (`customExercises` table).
- Schema versioning: `CURRENT_SCHEMA_VERSION` constant tracks the current schema. When changing schema, increment this version and add migration logic in both the `db.ts` version chain AND `src/services/backupMigrations.ts` (for importing old backups).

**Export/Import:** Uses `dexie-export-import` addon. `exportDatabase()` and `importDatabase()` functions handle backup/restore with automatic rollback on import failure.

### Feature Organization

Features are domain-sliced in `src/features/[domain]/`:
- `achievements/` - Gamification and streak tracking
- `bodyweight/` - Weight entry logging
- `exercises/` - Exercise management (custom + default)
- `nutrition/` - Food tracking and macro logging
- `settings/` - User preferences
- `workout/` - Workout sessions, templates, and active session state

**Each feature typically contains:**
- `queries.ts` - React Query hooks for data fetching (uses `useQuery`)
- `mutations.ts` - React Query hooks for data modifications (uses `useMutation`)
- May include feature-specific services or hooks

### React Query Pattern

**Query Keys:** Centralized in `src/lib/queryKeys.ts` using a structured factory pattern (e.g., `queryKeys.workouts.list()`, `queryKeys.workouts.detail(id)`).

**Data Flow:**
1. Queries call Dexie methods directly: `queryFn: async () => db.workoutSessions.get(id)`
2. Mutations perform DB operations, then invalidate relevant query keys
3. Mutations often trigger side effects (achievement checks, stats updates) via service layer

**Example Pattern:**
```typescript
// queries.ts
export function useWorkout(id: string) {
  return useQuery({
    queryKey: queryKeys.workouts.detail(id),
    queryFn: async () => db.workoutSessions.get(id),
    enabled: !!id,
  })
}

// mutations.ts
export function useCreateWorkout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (workout) => {
      const newWorkout = { ...workout, id: crypto.randomUUID() }
      await db.workoutSessions.add(newWorkout)
      await statsService.addWorkout(newWorkout) // Side effects
      await achievementService.updateWorkoutStreak(workout.date)
      return newWorkout
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
    }
  })
}
```

### Services (`src/services/`)

Services encapsulate business logic and cross-cutting concerns:
- `achievementService.ts` - Unlock achievements and update streaks
- `statsService.ts` - Incremental statistics calculations
- `workoutService.ts` / `workoutSessionService.ts` - Workout-specific operations
- `openFoodFacts.ts` - External API integration for barcode scanning
- `dataExport.ts` - Backup/restore orchestration
- `backupMigrations.ts` - Schema migration logic for importing old backups
- `devSeeding.ts` - Development test data generation
- `notifications.ts` - Push notification handling

Services are called from mutation hooks to trigger side effects (stats updates, achievement checks) after DB operations.

### Routing (TanStack Router)

**Router Setup:** `src/router.tsx` creates router with `routeTree` (auto-generated in `src/routeTree.gen.ts`) and provides `queryClient` in context.

**Route Files:** Located in `src/routes/`. The router uses file-based routing with auto-generation via `@tanstack/router-plugin`.

**Page Components:** Actual page components live in `src/pages/` and are imported by route files.

### State Management (Zustand)

Used for ephemeral UI state that doesn't need React Query caching:
- `src/features/workout/restTimerStore.ts` - Rest timer countdown state
- Other stores may exist per-feature for transient UI state

**Pattern:** Zustand is lightweight and hook-based. Use for UI-specific state, not for persisted data (that's React Query + Dexie).

### PWA Configuration

Configured in `vite.config.ts` using `vite-plugin-pwa`:
- **Service Worker:** Auto-updates enabled
- **Caching Strategy:** Network-first for OpenFoodFacts API with expiration policies
- **Manifest:** Defined inline with theme colors (Molten Orange #ea580c, Oil Black #0a0a0a)

## Branding & Design

**App Name:** Always "Inertia" (never "Training App")

**Theme:**
- Primary: Molten Orange (#ea580c)
- Accent: Kinetic Red
- Background: Oil Black (#0a0a0a)
- Typography: JetBrains Mono (via `@fontsource-variable/jetbrains-mono`)

**Terminology:**
- Use "Fuel" for nutrition/food
- Use "Engine Output" or "Protocol" for workouts
- Use "Momentum" for streaks/achievements
- Maintain technical, industrial tone

**Styling:**
- All headers MUST be `uppercase tracking-tight`
- Use Tailwind CSS v4 with theme variables
- Icons from `lucide-react` (prefer technical/industrial style)

## Code Conventions

### TypeScript
- Strict mode enabled
- Avoid `any` - use proper types from `src/lib/types.ts` or `src/types/`
- Use `import type` for type-only imports
- UUID generation: `crypto.randomUUID()`

### React
- Use `useMemo` for expensive computations
- Function components with named exports for queries/mutations
- Prefer composition over prop drilling

### Naming
- PascalCase: Components, types, interfaces
- camelCase: Functions, variables, hooks
- UPPER_SNAKE_CASE: Constants

### Performance
- Leverage React Query's automatic caching and deduplication
- Dexie compound indexes defined in schema for common query patterns
- Code splitting configured in `vite.config.ts` (vendor chunks for react, tanstack, recharts, etc.)

## Key Dependencies

- **@tanstack/react-query** (v5) - Server/DB state management
- **@tanstack/react-router** (v1) - File-based routing
- **dexie** (v4) - IndexedDB wrapper
- **zustand** (v5) - Client state management
- **zod** (v4) - Runtime validation
- **tailwindcss** (v4) - Styling
- **recharts** (v3) - Charts and data visualization
- **html5-qrcode** - Barcode scanning
- **sonner** - Toast notifications

## Testing & Linting

**Linter:** Oxlint with extensive plugins (react, promise, node, vitest, import) and type-aware checking enabled. Configuration in `oxlintrc.json`.

**Important:** The lint command includes `--type-check` and `--type-aware` flags, so it performs type checking beyond just linting.
