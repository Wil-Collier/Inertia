# AGENTS.md - Training App

This document provides guidelines for AI coding agents working on this codebase.

## Project Overview

A **Progressive Web App (PWA)** for tracking workouts and nutrition.
- **Stack:** Vite 7, React 19, TypeScript 5.9, Tailwind CSS v4, Zustand, React Router v7.
- **UI:** shadcn/ui (base-nova), Recharts.
- **Hosting:** Cloudflare Pages (`wrangler.toml`).

## Build & Validation

```bash
# Install dependencies
pnpm install

# Start development server
pnpm dev --host

# Production build (includes type check)
pnpm build

# Lint code (Oxlint)
pnpm lint

# Preview production build
pnpm preview
```

**Testing:**
- **No automated tests** are currently configured.
- If implementing tests, use **Vitest**.
- To verify changes: run `pnpm build` for type safety and `pnpm dev` for manual verification.

## Project Structure

```text
src/
├── App.tsx                 # Router & Lazy loading
├── components/
│   ├── layout/            # Layout, Header, BottomNav
│   └── ui/                # shadcn/ui components (do not modify unless necessary)
├── hooks/                 # Custom hooks (useCamelCase)
├── lib/
│   ├── types.ts           # Shared interfaces/types
│   └── utils.ts           # Helpers (cn, formatters)
├── pages/                 # Route components (PascalCase)
├── services/              # API clients (OpenFoodFacts)
├── stores/                # Zustand stores (useStoreName)
└── index.css              # Tailwind v4 imports & variables
```

## Code Style & Conventions

### TypeScript & Imports
- **Strict Mode:** Enabled. No `any` unless absolutely necessary.
- **Path Alias:** Always use `@/` for `src/` (e.g., `import { Button } from "@/components/ui/button"`).
- **Type Imports:** Use `import type` for types.
- **Definitions:** Interfaces for object shapes, Types for unions/aliases.
- **Import Order:** React -> Internal (@/components, @/stores, @/hooks) -> Types -> Utils.

### React Components
- **Format:** `export function ComponentName() { ... }` (Named exports).
- **State:** Use `useState` for local, Zustand for global.
- **Forms:** Prefer controlled components.
- **Routing:** Use `useNavigate` and `<Navigate />` from `react-router-dom`.

### Styling (Tailwind v4)
- **Engine:** Tailwind CSS v4 with `@tailwindcss/vite`.
- **Classes:** Use utility classes exclusively.
- **Conditionals:** Use `cn()` helper: `className={cn("base-class", condition && "active")}`.
- **Theme:** Use CSS variables (e.g., `bg-background`, `text-muted-foreground`).
- **Responsive:** Mobile-first (`block md:hidden`).
- **PWA:** Respect safe areas: `pt-[env(safe-area-inset-top)]`.

### State Management (Zustand)
- **Pattern:** `export const useNameStore = create<State>()(...)`
- **Persistence:** Use `persist` middleware with unique name and versioning.
- **Location:** `src/stores/`.

### Error Handling
- **Async:** Wrap in `try/catch`.
- **Feedback:** Use `toast` from `sonner` for user alerts.
- **Logging:** `console.error` for debugging.

## Common Tasks

### Adding a Page
1. Create `src/pages/NewPage.tsx`.
2. Lazy load in `src/App.tsx`.
3. Add route definition.
4. Update `src/components/layout/BottomNav.tsx` if it's a primary tab.

### Adding a Store
1. Define interface in `src/stores/useNewStore.ts`.
2. Implement with `create` + `persist`.
3. Export hook `useNewStore`.

### Nutrition Data
- Source: Open Food Facts API (cached via Workbox).
- Logic: `src/services/openFoodFacts.ts`.
