# AGENTS.md - Training App

Guidelines for AI coding agents working on this codebase.

## Project Overview

A **Progressive Web App (PWA)** for tracking workouts and nutrition.
- **Stack:** Vite 7, React 19, TypeScript 5.9, Tailwind CSS v4, Zustand, React Router v7
- **UI:** shadcn/ui (base-nova), Recharts, Lucide icons
- **Database:** Dexie (IndexedDB wrapper) for offline-first storage
- **Hosting:** Cloudflare Pages (`wrangler.toml`)

## Build & Validation

```bash
pnpm install          # Install dependencies
pnpm dev --host       # Start dev server (accessible on network)
pnpm build            # Production build (runs tsc + vite build)
pnpm lint             # Lint with Oxlint (type-aware)
pnpm preview          # Preview production build
```

### Testing

- **No automated tests configured yet** - use Vitest if adding tests
- Run single test: `pnpm vitest run path/to/file.test.ts`
- Run tests in watch mode: `pnpm vitest path/to/file.test.ts`
- **Validation workflow:** Run `pnpm build` (includes type-check) then `pnpm lint`

## Project Structure

```
src/
├── App.tsx                 # Router with lazy-loaded routes
├── main.tsx                # Entry point
├── index.css               # Tailwind v4 imports & CSS variables
├── components/
│   ├── layout/             # Layout, Header, BottomNav
│   ├── ui/                 # shadcn/ui components (avoid modifying)
│   └── [feature]/          # Feature-specific components
├── hooks/                  # Custom hooks (useTheme, useRestTimer, etc.)
├── lib/
│   ├── types.ts            # Shared TypeScript interfaces/types
│   └── utils.ts            # Helpers (cn, formatDuration)
├── pages/                  # Route page components
├── services/               # External APIs, DB, notifications
├── stores/                 # Zustand stores
└── data/                   # Static data, exercise database
```

## Code Style

### TypeScript

- **Strict mode enabled** - avoid `any`, use proper typing
- **Path alias:** Always use `@/` for `src/` imports
- **Type imports:** Use `import type { Foo }` for type-only imports
- **Interfaces vs Types:** Interfaces for object shapes, Types for unions/aliases
- **Unused variables:** Prefix with underscore `_unused` or remove

```typescript
// Good
import type { FoodItem, MealType } from "@/lib/types"
import { useNutritionStore } from "@/stores/nutritionStore"

// Bad
import { FoodItem } from "@/lib/types"  // Missing 'type' keyword
import { useNutritionStore } from "../stores/nutritionStore"  // Relative path
```

### Import Order

1. React/external libraries
2. Internal components (`@/components/`)
3. Stores (`@/stores/`)
4. Hooks (`@/hooks/`)
5. Types (`@/lib/types`)
6. Utils (`@/lib/utils`)

### React Components

- **Named exports:** `export function ComponentName() { ... }`
- **File naming:** PascalCase for components (`Dashboard.tsx`)
- **Props:** Define inline or as separate interface above component
- **State:** `useState` for local, Zustand stores for global/persistent

```typescript
// Page component pattern
export function Dashboard() {
  const { data } = useSomeStore()
  
  return (
    <div className="space-y-4 p-4">
      {/* content */}
    </div>
  )
}
```

### Styling (Tailwind v4)

- **Utility-first:** Use Tailwind classes exclusively
- **Conditionals:** Use `cn()` helper from `@/lib/utils`
- **Theme colors:** Use CSS variables (`bg-background`, `text-muted-foreground`)
- **Responsive:** Mobile-first approach (`block md:hidden`)
- **Safe areas:** Use `safe-area-bottom` class or `env(safe-area-inset-*)` for PWA

```typescript
import { cn } from "@/lib/utils"

<div className={cn(
  "rounded-lg p-4 bg-card",
  isActive && "ring-2 ring-primary",
  className
)} />
```

### Zustand Stores

- **Naming:** `useNameStore` (e.g., `useNutritionStore`)
- **Location:** `src/stores/`
- **Persistence:** Use Dexie for IndexedDB storage (not Zustand persist)
- **Async init:** Stores load from Dexie via `init()` method

```typescript
interface StoreState {
  items: Item[]
  isInitialized: boolean
  init: () => Promise<void>
  addItem: (item: Omit<Item, "id">) => Promise<void>
}

export const useItemStore = create<StoreState>((set, get) => ({
  items: [],
  isInitialized: false,
  init: async () => { /* load from db */ },
  addItem: async (item) => { /* save to db, update state */ },
}))
```

### Error Handling

- **Async operations:** Always wrap in try/catch
- **User feedback:** Use `toast` from `sonner` for notifications
- **Logging:** `console.error` with context for debugging
- **Re-throw:** After logging/toasting if caller needs to handle

```typescript
try {
  await db.items.add(newItem)
  set((state) => ({ items: [...state.items, newItem] }))
} catch (error) {
  console.error("Failed to add item:", error)
  toast.error("Failed to save item")
  throw error
}
```

## Common Patterns

### Adding a New Page

1. Create `src/pages/NewPage.tsx` with named export
2. Add lazy import in `src/App.tsx`:
   ```typescript
   const NewPage = lazy(() => import("@/pages/NewPage").then((m) => ({ default: m.NewPage })))
   ```
3. Add route inside `<Routes>`:
   ```tsx
   <Route path="/new" element={<PageErrorBoundary><NewPage /></PageErrorBoundary>} />
   ```
4. Update `src/components/layout/BottomNav.tsx` if adding to main navigation

### Adding a Zustand Store

1. Create `src/stores/useNewStore.ts`
2. Define interface with state and actions
3. Implement with Dexie for persistence
4. Add initialization call in `src/components/AppInitializer.tsx`

### Database Operations

Use Dexie for all persistent data. Schema defined in `src/services/db.ts`.

```typescript
import { db } from "@/services/db"

// Read
const items = await db.tableName.toArray()

// Write
await db.tableName.add(item)
await db.tableName.put(item)  // upsert by primary key
await db.tableName.update(id, { field: value })
await db.tableName.delete(id)
```

## Linting Rules (Oxlint)

Key rules enabled (see `oxlintrc.json` and `package.json`):
- Type-aware checking with `--type-check`
- React, Promise, Node, Vitest, Import plugins
- Disabled: `react-in-jsx-scope`, floating promises, array sort/reverse warnings

## Key Files Reference

| Purpose | File |
|---------|------|
| Types | `src/lib/types.ts` |
| Utils | `src/lib/utils.ts` |
| Database | `src/services/db.ts` |
| Router | `src/App.tsx` |
| Theme/Settings | `src/stores/settingsStore.ts` |
| Workout State | `src/stores/workout/` |
| Nutrition State | `src/stores/nutritionStore.ts` |
