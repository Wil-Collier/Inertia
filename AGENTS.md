# AGENTS.md - Inertia

Guidelines for AI coding agents working on the Inertia codebase.

## Project Overview

Inertia is an offline-first PWA for tracking workouts, nutrition, and body progress. Built with React 19, Vite 7, TypeScript 5.9, TanStack Router, and Dexie.js (IndexedDB) for local-first persistence. Backend runs on Cloudflare Workers with Hono.

## Branding

- **Name:** Inertia (never "Training App").
- **Palette:** Molten Orange `#ea580c` (primary), Kinetic Red (accent), Oil Black `#0a0a0a` (background).
- **Typography:** JetBrains Mono. All headers use `uppercase tracking-tight`.
- **Tone:** Technical, industrial, precise. Use "Momentum" for streaks/achievements.
- **Icons:** `lucide-react` only.

## Build, Lint, Test Commands

```bash
pnpm install              # Install dependencies
pnpm dev --host           # Dev server with network access
pnpm build                # Production build (tsc -b && vite build)
pnpm lint                 # Oxlint with type-checking
pnpm vitest run           # Run all tests once
pnpm vitest run src/features/sync/__tests__/engine.test.ts  # Run a single test file
pnpm vitest --watch       # Watch mode
pnpm deploy              # Build + deploy to Cloudflare Workers
```

**Always run `pnpm build && pnpm lint` before completing a task.**

## Architecture

### Directory Structure

```
src/
  features/[domain]/     # Domain-sliced features (workout/, nutrition/, achievements/, etc.)
    queries.ts           # React Query useQuery hooks
    mutations.ts         # React Query useMutation hooks
  services/              # Business logic (achievementService, statsService, db)
  lib/                   # Shared utilities (queryKeys.ts, types.ts, utils.ts, constants.ts)
  types/                 # Type definitions per domain
  components/            # UI components (ui/ for shadcn primitives)
  pages/                 # Page-level components
  routes/                # TanStack Router route definitions (file-based)
  hooks/                 # Shared React hooks
  data/                  # Static data (exerciseDatabase.ts)
worker/                  # Cloudflare Workers backend (Hono)
shared/                  # Shared code between client and worker (Zod schemas)
```

### Data Layer (Dexie.js + IndexedDB)

- `src/services/db.ts` exports the singleton `db` instance.
- Default exercises are static in `src/data/exerciseDatabase.ts`; only user-created exercises go in `customExercises` table.
- **Schema version:** Keep `CURRENT_SCHEMA_VERSION` at `1` (early development, no migrations needed).
- Singleton records (settings, achievements) use `id: "settings"` / `id: "achievements"`.

### React Query Patterns

- **Query keys:** Use the factory in `src/lib/queryKeys.ts` — never hardcode key arrays.
- **Mutations:** DB operation inside `mutationFn`, then invalidate in `onSuccess`/`onSettled`.
- **Invalidation:** Use `void queryClient.invalidateQueries(...)` (void prefix satisfies no-floating-promises).
- **Optimistic updates:** Use `onMutate` to snapshot + set cache, `onError` to rollback, `onSettled` to invalidate.

### Sync-Aware Transactions (Critical)

All Dexie write transactions **must** include the sync tracking tables:

```ts
await db.transaction("rw", [db.foods, db.syncPendingChanges, db.syncRecordVersions], async () => {
  await db.foods.put(newFood)
})
```

Always include `db.syncPendingChanges` and `db.syncRecordVersions` alongside the domain tables.

### Side Effects in Mutations

After DB writes, call services for cross-cutting concerns:

```ts
await achievementService.updateStreaks()
await achievementService.checkNutritionAchievements()
```

### Routing & State

- **Routing:** TanStack Router (file-based). Route files in `src/routes/` are thin wrappers that import page components from `src/pages/`.
- **Ephemeral state:** Zustand (e.g., `restTimerStore.ts`). Never use Zustand for persisted data.
- **Persisted state:** Always React Query + Dexie.

### Backend (Cloudflare Workers + Hono)

- Entry: `worker/index.ts`. Routes mounted by feature (`worker/nutrition/routes.ts`, `worker/sync/routes.ts`).
- Auth: JWT middleware in `worker/middleware/auth.ts`, Google OAuth in `worker/auth/`.
- Database: Cloudflare D1 (SQL). Migrations in `migrations/`.
- Shared types: Zod schemas in `shared/syncSchemas.ts` used by both client and worker.
- Dev: `@cloudflare/vite-plugin` runs Workers locally during `pnpm dev`.

## Code Style & Conventions

### TypeScript

- **Strict mode.** No `any` — the linter enforces `typescript/no-explicit-any`.
- **`import type`** for type-only imports (enforced by `typescript/consistent-type-imports`).
- **Path alias:** Use `@/` for `src/` imports (e.g., `import { db } from "@/services/db"`).
- **UUIDs:** Always `crypto.randomUUID()`.

### Naming

- **PascalCase:** Components, types, interfaces, classes.
- **camelCase:** Functions, hooks, variables, object keys.
- **UPPER_SNAKE_CASE:** Constants and enum-like values.
- **Hooks:** Prefix with `use` (e.g., `useAddMealEntry`).

### Error Handling

- **User-facing errors:** `toast.error("message")` via `sonner`.
- **Success feedback:** `toast.success("message")` for destructive or important actions.
- **Non-user-facing:** `console.error(...)` for debugging.
- **Mutation errors:** Handle in `onError` callback with toast + optional rollback.
- **Typed errors:** Use specific error classes (e.g., `NutritionApiError`) when appropriate.

### React Components

- Function components with named exports.
- `useMemo` for expensive computations.
- Prefer composition over prop drilling.
- Styling: Tailwind v4 with theme CSS variables. Use `cn()` from `@/lib/utils` for conditional classes.
- shadcn/ui components in `src/components/ui/`.

### Formatting

- No semicolons (project convention observed in source files).
- Double quotes for strings.
- No trailing commas required — follow existing patterns in the file being edited.

## Linting (Oxlint)

Key enforced rules:

| Rule | Severity |
|------|----------|
| `typescript/no-explicit-any` | error |
| `typescript/consistent-type-imports` | error |
| `typescript/no-floating-promises` | error |
| `typescript/no-unsafe-type-assertion` | error |
| `typescript/no-misused-promises` | error |
| `react/exhaustive-deps` | error |
| `react/rules-of-hooks` | error |
| `import/no-duplicates` | error |
| `unicorn/no-array-sort` | error |
| `unicorn/no-array-reverse` | error |

Use `toSorted()` / `toReversed()` instead of mutating `.sort()` / `.reverse()`.

## Testing

- **Framework:** Vitest with jsdom environment.
- **Setup:** `src/test/setup.ts` imports `fake-indexeddb/auto` for IndexedDB mocking.
- **File patterns:** `src/**/*.test.ts`, `src/**/*.spec.ts`, `src/**/*.integration.test.ts`.
- **Run single test:** `pnpm vitest run path/to/file.test.ts`
- **Run with filter:** `pnpm vitest run -t "test name pattern"`

## Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 19.x | UI framework |
| @tanstack/react-query | 5.x | Server/async state |
| @tanstack/react-router | 1.x | File-based routing |
| dexie | 4.x | IndexedDB wrapper |
| zustand | 5.x | Ephemeral UI state |
| tailwindcss | 4.x | Styling |
| hono | 4.x | Worker HTTP framework |
| zod | 4.x | Schema validation |
| sonner | 2.x | Toast notifications |
| recharts | 3.x | Charts |
| lucide-react | 0.5x | Icons |
