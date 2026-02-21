# AGENTS.md - Inertia

Guidelines for AI coding agents working on the Inertia codebase.

## Project Overview

Inertia is an offline-first PWA for tracking workouts, nutrition, and body progress. Built with React 19, Vite 7, TypeScript (native preview compiler via `tsgo`), TanStack Router, and Dexie.js (IndexedDB) for local-first persistence. Backend runs on Cloudflare Workers with Hono.

## Branding

- **Name:** Inertia
- **Palette:** Molten Orange `#ea580c` (primary), Kinetic Red (accent), Oil Black `#0a0a0a` (background).
- **Typography:** JetBrains Mono. All headers use `uppercase tracking-tight`.
- **Tone:** Technical, industrial, precise. Use "Momentum" for streaks/achievements.
- **Icons:** `lucide-react` only.

## Build, Lint, Test Commands

```bash
pnpm install              # Install dependencies
pnpm dev                  # Dev server with network access
pnpm build                # Production build (tsgo -b && vite build)
pnpm lint                 # Oxlint with type-checking
pnpm test                 # Run all tests once
pnpm coverage             # Run tests with coverage report
pnpm test src/features/sync/engine/pushPipeline.test.ts  # Run a single test file
pnpm vitest --watch      # Watch mode
pnpm deploy              # Build + deploy to Cloudflare Workers
```

**Always run build, lint and test before completing a task.**

## Architecture

### Directory Structure

```
src/
  features/[domain]/     # Domain-sliced features (workout/, nutrition/, achievements/, etc.)
    components/          # Feature-owned UI
    screens/             # Feature-owned screen implementations
    hooks/               # Feature-only hooks
    queries.ts           # React Query useQuery hooks
    mutations.ts         # React Query useMutation hooks
  features/sync/
    client/              # HTTP/auth/session client concerns
    model/               # Sync schemas, types, guards, JSON utils
    runtime/             # Zustand stores + runtime hooks/triggers
    tracking/            # Dexie hooks and pending/version tracking
    recovery/            # Recovery/reset/rebuild logic
    engine/              # Pull/push/orchestration pipelines
  services/              # Business logic (achievementService, statsService, db)
  lib/                   # Shared utilities and domain types (queryKeys.ts, types/, utils.ts, constants.ts)
  types/                 # Ambient/global app types
  components/            # App-shell + shared primitives only (layout/, ui/, app bootstrap)
  pages/                 # Thin route-facing wrappers re-exporting feature screens
  routes/                # TanStack Router route definitions (file-based)
  hooks/                 # Cross-feature shared hooks only
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
await achievementService.runNutritionSideEffects()
```

### Routing & State

- **Routing:** TanStack Router (file-based). Route files in `src/routes/` are thin wrappers that import page components from `src/pages/`.
- **Pages vs Screens:** `src/pages/` should stay minimal. Put real page implementation in `src/features/*/screens/*Screen.tsx`, then re-export from `src/pages/*`.
- **Ephemeral state:** Zustand (e.g., `restTimerStore.ts`). Never use Zustand for persisted data.
- **Persisted state:** Always React Query + Dexie.


### Backend (Cloudflare Workers + Hono)

- Entry: `worker/index.ts`. Routes mounted by feature (`worker/nutrition/routes.ts`, `worker/sync/routes.ts`).
- Auth: JWT middleware in `worker/middleware/auth.ts`, Google OAuth in `worker/auth/`.
- Database: Cloudflare D1 (SQL). Migrations in `migrations/`.
- Shared types: Zod schemas in `shared/syncSchemas.ts` used by both client and worker.
- Dev: `@cloudflare/vite-plugin` runs Workers locally during `pnpm dev`.

## Security Best Practices & Procedures

### Core Security Rules (Secure-by-Default)

- **No token persistence in Web Storage:** Never persist access tokens in `localStorage`/`sessionStorage`. Keep access tokens in memory only.
- **Refresh token handling:** Refresh tokens must remain `httpOnly` cookies scoped to auth routes.
- **CSRF/origin checks for auth state changes:** All state-changing auth endpoints must enforce trusted `Origin`/`Referer` checks.
- **Auth response caching:** Login/refresh/logout responses must send `Cache-Control: no-store`.
- **Input validation:** Treat all request inputs as untrusted. Validate with Zod before any DB or provider calls.
- **Request size limits:** Enforce payload size limits on sync endpoints (`/api/sync/push`, `/api/sync/pull`).
- **Rate limiting:** Keep route-level rate limits enabled for `/api/auth/*`, `/api/sync/*`, and `/api/nutrition/*`.
  - **Early dev exception:** Do not prioritize distributed/durable rate-limit architecture changes yet. In-memory middleware limits are acceptable until production hardening is explicitly requested.
- **SQL safety:** Use parameterized D1 queries only; never build SQL with string interpolation from user input.
- **Error hygiene:** Do not leak internal stack traces or secrets in API responses.
- **Security headers:** Preserve API security headers middleware (`nosniff`, referrer policy, permissions policy, CSP for API responses).
- **CSP maintenance:** Keep app-shell CSP in `index.html` aligned with required providers (Google OAuth, APIs) and avoid broad wildcards.
- **Secrets discipline:** Never hardcode credentials. Use Worker environment bindings (`JWT_SECRET`, `GOOGLE_CLIENT_ID`, provider secrets, `APP_ORIGINS`).

### Auth & Session Procedure

- Access token lifecycle:
  - Access token issued by `/api/auth/login` or `/api/auth/refresh`.
  - Access token stored only in memory state.
  - On app startup, restore session via `/api/auth/refresh` (cookie-based).
- Cookie policy:
  - Use `httpOnly`, `sameSite`, `secure` (when HTTPS), and explicit `path`.
- Origin allowlist:
  - Configure trusted origins with `APP_ORIGINS` (comma-separated) in Worker env for production.

### Security Review Procedure (Required on Security-Relevant Changes)

Security-relevant scope includes: auth, sync, middleware, API routes, request parsing, storage, CSP/headers, third-party network calls.

1. Identify trust boundary changes (browser/client, Worker API, D1, third-party APIs).
2. Confirm all new/changed inputs are schema-validated and bounded.
3. Confirm no new sensitive data is persisted in Web Storage or logs.
4. Confirm auth endpoints keep origin checks and `no-store` behavior.
5. Confirm rate limits and payload caps still apply to changed routes.
6. Add/update integration tests for security behavior (for example: 401/403/413/429 paths).
7. Run verification commands:
   - `pnpm vitest run`
   - `pnpm build && pnpm lint`

### Testing Expectations for Security Controls

- Add or update tests when touching security controls:
  - Auth origin enforcement (`403` on untrusted origin).
  - Rate limiting behavior (`429`).
  - Request validation failures (`400`).
  - Payload limit enforcement (`413`).
  - Session refresh behavior and auth-state transitions.

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
- If a previously removed shadcn/base-ui primitive is needed again, regenerate/re-add only the exact primitive needed (for example via `shadcn add <component>`), then add a real feature/page call site in the same change so it does not become dead code again.

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

- **Framework:** Vitest (project mode: jsdom for `src`, node for `worker` and `shared`).
- **Setup:** `src/test/setup.ts` configures `fake-indexeddb/auto` and MSW server handlers.
- **File patterns:** `src/**/*.test.{ts,tsx}`, `src/**/*.spec.{ts,tsx}`, `src/**/*.integration.test.{ts,tsx}`, plus `worker/**/*.test.{ts,tsx}` and `shared/**/*.test.{ts,tsx}`.
- **Run single test:** `pnpm vitest run path/to/file.test.ts`
- **Run with filter:** `pnpm vitest run -t "test name pattern"`

### Testing Methodology (Behavior-First, Mock-Last)

- Prefer behavior tests over implementation tests:
  - Assert user-observable outcomes (rendered state, navigation, toasts, persisted DB changes).
  - Avoid testing hook internals, private function call order, or component implementation details.
- Prefer seeded integration tests for pages and feature flows:
  - Use real React Query + Dexie + Router behavior via `src/test/helpers/renderAppRoute.tsx`.
  - Seed runtime state with `src/test/helpers/seedTestState.ts`.
  - Reset runtime between tests with `src/test/helpers/resetTestRuntime.ts`.
- Use deterministic factories for test data:
  - Prefer `src/test/factories/*` helpers over inline object literals.
  - Keep IDs deterministic unless a test explicitly requires randomness.

### Mocking Policy (Strict)

- Do not mock internal feature hooks by default (`@/features/*/queries`, `@/features/*/mutations`) in integration-style tests.
- Mock only true external boundaries:
  - Network boundaries via MSW (`src/test/msw/server.ts`, `src/test/msw/handlers.ts`)
  - Browser/hardware APIs not available in jsdom (camera/scanner, notifications, audio, etc.)
- If a mock is used for non-boundary code, document why it is unavoidable in test comments.

### Network Test Policy (MSW-First)

- For client code that performs HTTP requests (`fetch`, auth/sync clients, provider clients), prefer MSW handlers over stubbing `global.fetch` or mocking API modules.
- In tests that exercise request/response behavior, avoid `vi.mock` for internal transport helpers such as `@/features/*/api` unless the test is explicitly unit-scoped to that module.
- Use MSW to verify protocol-level behavior:
  - auth headers/token propagation
  - 401 refresh + retry behavior
  - server error mapping (4xx/5xx)
  - payload/query param handling
- Keep default handlers in `src/test/msw/handlers.ts` broad and deterministic; override per-test with `server.use(...)` for scenario-specific behavior.
- Prefer asserting outcomes from real request flow (returned data, store state changes, error class/messages) rather than asserting internal mock call counts.

### Test Type Integrity

- If a file is named `*.integration.test.*`, it should run with real module wiring for the feature under test.
- Integration tests may still mock:
  - unavailable browser/runtime capabilities
  - heavyweight visualization primitives that jsdom cannot render reliably
- Integration tests should not replace the core business collaborators of the subject under test with `vi.mock(...)`; if that is required, treat it as a unit test and name/scope it accordingly.

### Fail-First and Defect-Driven Fixes

- For behavior changes and bug work, use fail-first workflow:
  1. Add or update a test that fails on current behavior.
  2. Implement the minimal production fix.
  3. Verify the new test and surrounding suite pass.
- When a migrated test exposes a real defect, fix production code in the same change set rather than weakening assertions.

### Test Quality Criteria

- Every test should verify at least one meaningful behavior outcome.
- Avoid snapshot-only tests and coverage-only assertions with no behavior signal.
- Prefer assertions on stable outcomes:
  - Route path/state
  - Persisted records in Dexie
  - Visible UI state and actionable controls
- Keep tests resilient:
  - Avoid brittle selectors tied to incidental markup.
  - Prefer role/label/text queries based on user interaction.

### Test Validation Gates

- For any non-trivial test change:
  1. `pnpm vitest run <changed test files>`
  2. `pnpm vitest run`
  3. `pnpm build && pnpm lint`

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
