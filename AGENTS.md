# AGENTS.md - Inertia

Guidelines for AI coding agents working on the Inertia codebase.

## Project Overview

Inertia is an offline-first Progressive Web App (PWA) for tracking workouts, nutrition, and body progress. Built with React 19, Vite 7, TypeScript, and TanStack Router, it uses IndexedDB (via Dexie.js) for local-first data persistence.

## Branding & Design Language

- **Name:** Inertia (Never "Training App")
- **Palette:** Molten Orange (#ea580c) (Primary), Kinetic Red (Accent), Oil Black (#0a0a0a) (Background).
- **Typography:** JetBrains Mono (via `@fontsource-variable/jetbrains-mono`). All headers MUST be `uppercase tracking-tight`.
- **Tone:** Technical, industrial, and precise.
- **Terminology:**
    - Use standard terms like "Nutrition" and "Workout".
    - Avoid terms like "Fuel", "Engine", or "Protocol" in the UI.
    - Use "Momentum" for streaks/achievements.
- **Icons:** Use `lucide-react`. Prefer technical/industrial icons.

## Build & Validation

```bash
pnpm install          # Install dependencies
pnpm dev --host       # Start dev server (includes network access)
pnpm build            # Production build (tsc -b + vite build)
pnpm preview          # Preview production build
pnpm lint             # Oxlint (type-aware, includes --type-check)
pnpm vitest run [path]# Run tests (Vitest)
pnpm seed             # Open dev server with ?seed=true query param
```
- **Validation:** Always run `pnpm build && pnpm lint` before completing a task.

## Architecture

### Data Layer (Dexie.js + IndexedDB)
- **Database Definition:** `src/services/db.ts` exports the singleton `db` instance of `TrainingAppDatabase`.
- **Schema:** Tables include `customExercises`, `workoutSessions`, `workoutTemplates`, `personalRecords`, `foods`, `nutritionLogs`, `mealTemplates`, `settings`, `bodyWeight`, `achievements`, `restTimer`, `activeSession`, `metadata`, `userStats`.
- **Exercise Storage:** Default exercises are static in `src/data/exerciseDatabase.ts`. Only user-created exercises are in `customExercises`.
- **Versioning:** This app is in early development and is not in production. There is no need for migrations or backwards compatibility. Keep `CURRENT_SCHEMA_VERSION` at `1` in `db.ts`.

### Feature Organization
Domain-sliced in `src/features/[domain]/` (e.g., `achievements/`, `workout/`, `nutrition/`).
Each feature typically contains:
- `queries.ts`: React Query hooks using `useQuery`.
- `mutations.ts`: React Query hooks using `useMutation`.

### React Query Pattern
- **Query Keys:** Centralized in `src/lib/queryKeys.ts` using a structured factory pattern.
- **Data Flow:** Mutations perform DB operations then invalidate relevant keys. Mutations often trigger side effects via services.

### Services (`src/services/`)
Services encapsulate business logic and cross-cutting concerns (e.g., `achievementService`, `statsService`). They are called from mutation hooks to trigger side effects after DB operations.

### Routing & State
- **Routing:** TanStack Router (file-based). Routes in `src/routes/`, page components in `src/pages/`.
- **State:** Zustand for ephemeral UI state (e.g., `restTimerStore.ts`). Use React Query + Dexie for all persisted data.

### Backend (Cloudflare Workers + Hono)
- **Entry Point:** `worker/index.ts` - Hono app that handles all `/api/*` routes.
- **Configuration:** `wrangler.jsonc` - Cloudflare Workers configuration with static asset handling.
- **Environment:** `worker/env.ts` - TypeScript interface for environment bindings.
- **Routing:** Hono routes mounted by feature (e.g., `worker/nutrition/routes.ts`).
- **Development:** The Cloudflare Vite plugin (`@cloudflare/vite-plugin`) runs Workers locally during `pnpm dev`.
- **Deployment:** `pnpm deploy` builds and deploys to Cloudflare Workers.

## Code Style & Conventions

### TypeScript & Naming
- **Strict Mode:** Avoid `any`. Use proper types from `src/lib/types.ts` or `src/types/`.
- **Imports:** Use `import type` for type-only imports.
- **Naming:** PascalCase for components/types/interfaces, camelCase for functions/hooks/variables, UPPER_SNAKE_CASE for constants.
- **UUIDs:** Use `crypto.randomUUID()`.

### React Components
- **Performance:** Use `useMemo` for expensive computations.
- **Styling:** Tailwind v4 with the defined Inertia theme variables.
- **Patterns:** Function components with named exports for queries/mutations. Prefer composition over prop drilling.

## Key Dependencies
- **@tanstack/react-query** (v5)
- **@tanstack/react-router** (v1)
- **dexie** (v4)
- **zustand** (v5)
- **tailwindcss** (v4)
- **recharts** (v3)
- **lucide-react** - Icons
- **hono** - Lightweight web framework for Workers
- **@cloudflare/vite-plugin** - Vite integration for Cloudflare Workers
