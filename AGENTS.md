# AGENTS.md - Training App

Guidelines for AI coding agents working on this codebase.

## Build & Validation

```bash
pnpm install          # Install dependencies
pnpm dev --host       # Start dev server
pnpm build            # Production build (tsc + vite build)
pnpm lint             # Oxlint (type-aware, includes --type-check)
pnpm vitest run [path]# Run tests (Vitest)
```
- **Validation:** Always run `pnpm build && pnpm lint` before completing a task.

## Project Structure

- `src/routes/`: TanStack Router route definitions (file-based routing).
- `src/pages/`: Page components associated with routes.
- `src/features/[domain]/`: React Query `queries.ts` and `mutations.ts`.
- `src/services/`: Persistence (`db.ts`), stats tracking, and external APIs.
- `src/components/ui/`: Base shadcn/ui components (avoid modifying).
- `src/lib/`: Types, query keys, and shared utilities.

## Code Style

### TypeScript & Naming
- **Strict Mode:** Avoid `any`. Use `import type` for type-only imports.
- **Paths:** Use `@/` for all internal `src/` imports.
- **Naming:** PascalCase for components, camelCase for functions/variables.
- **Booleans:** Prefix with `is`, `has`, or `should` (e.g., `isLoading`).

### React Components
- **Named Exports:** `export function Component() { ... }`
- **Props:** Define inline or as an interface above the component.
- **Performance:** Use `useMemo` for expensive logic. Isolate high-frequency re-renders (e.g., timers) into small, specialized sub-components.
- **Icons:** Use `lucide-react`. Icon-only buttons MUST have `aria-label`.

### Data Management
- **React Query:** Use the factory in `src/lib/queryKeys.ts`. Invalidate queries in mutations.
- **Dexie (IndexedDB):** Use `db` from `@/services/db`.
- **Performance:** Avoid full table scans for stats. Use `statsService.ts` for incremental tracking (volume, counts) in the `userStats` table.
- **Dates:** Store as `yyyy-MM-dd` strings. Use `date-fns` for all manipulations.

### Error Handling & UI
- **Safety:** Wrap all DB/API calls in `try/catch`.
- **Feedback:** Use `sonner` (`toast`) for user notifications.
- **Logging:** Use `console.error` with context. Gate debug logs behind `import.meta.env.DEV`.
- **Linting:** Use `void` prefix for intentional floating promises (e.g., `void router.navigate()`).

## Common Patterns

### Adding a Feature
1. Add keys to `src/lib/queryKeys.ts`.
2. Create `queries.ts` and `mutations.ts` in `src/features/[feature]/`.
3. Export custom hooks that wrap `useQuery` or `useMutation`.

### DB Migrations
1. Increment `CURRENT_SCHEMA_VERSION` in `src/services/db.ts`.
2. Add a `.version().stores().upgrade()` block in `db.ts`.
3. Add a corresponding migration function to `src/services/backupMigrations.ts` for file imports.

### Navigation
- Use `Link` or `useNavigate` from `@tanstack/react-router`.
- Follow the route typing conventions in `BottomNav.tsx` to maintain type safety.
