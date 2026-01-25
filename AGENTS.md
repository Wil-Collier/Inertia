# AGENTS.md - Inertia

Guidelines for AI coding agents working on the Inertia codebase.

## Branding & Design Language

- **Name:** Inertia (Never "Training App")
- **Palette:** Molten Orange (Primary), Kinetic Red (Accent), Oil Black (Background).
- **Typography:** JetBrains Mono. All headers MUST be `uppercase tracking-tight`.
- **Tone:** Technical, industrial, and precise. Avoid terms like "Fuel", "Engine" or "Protocol" in the UI. Use standard terms like "Nutrition" and "Workout".

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

- `src/routes/`: TanStack Router route definitions.
- `src/pages/`: Page components.
- `src/features/[domain]/`: React Query logic.
- `src/services/`: Persistence and external APIs.

## Code Style

### TypeScript & Naming
- **Strict Mode:** Avoid `any`. Use `import type`.
- **Naming:** PascalCase for components, camelCase for functions.
- **Icons:** Use `lucide-react`. Prefer technical/industrial icons.

### React Components
- **Performance:** Use `useMemo` for expensive logic.
- **Styling:** Use Tailwind v4 with the defined Inertia theme variables.
