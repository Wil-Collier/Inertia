# AGENTS.md - Training App

This document provides guidelines for AI coding agents working on this codebase.

## Project Overview

A **Progressive Web App (PWA)** for tracking workouts and nutrition, built with:
- **Vite 7** + **React 19** + **TypeScript 5.9**
- **Tailwind CSS v4** with `@tailwindcss/vite` plugin
- **shadcn/ui** (base-nova style) using `@base-ui/react` primitives
- **Zustand** for state management with localStorage persistence
- **React Router v7** for routing with lazy-loaded pages
- **Recharts** for data visualization
- **Cloudflare Pages** for hosting (configured via `wrangler.toml`)

## Build/Lint/Test Commands

```bash
# Install dependencies
pnpm install

# Development server (accessible on local network)
pnpm dev --host

# Production build (runs TypeScript check first)
pnpm build

# Preview production build
pnpm preview

# Lint with ESLint
pnpm lint

# Deploy to Cloudflare Pages
npx wrangler pages deploy dist
```

**Note:** There are no tests configured in this project. The build command (`tsc -b && vite build`) performs type checking.

## Project Structure

```
src/
├── App.tsx                 # Router with lazy-loaded pages
├── main.tsx               # React entry point
├── index.css              # Tailwind imports + CSS variables
├── components/
│   ├── layout/            # Header, BottomNav, Layout
│   └── ui/                # shadcn/ui components (button, card, dialog, etc.)
├── pages/                 # Route components (Dashboard, WorkoutPage, etc.)
├── stores/                # Zustand stores with persist middleware
├── hooks/                 # Custom React hooks
├── services/              # API services (openFoodFacts, dataExport)
├── data/                  # Static data (defaultExercises, defaultTemplates)
└── lib/
    ├── types.ts           # TypeScript interfaces and types
    └── utils.ts           # Utility functions (cn for classnames)
```

## Code Style Guidelines

### TypeScript

- **Strict mode enabled** with `noUnusedLocals`, `noUnusedParameters`
- Use `type` imports for type-only imports: `import type { Foo } from "./types"`
- Define interfaces in `src/lib/types.ts` for shared types
- Use union types for constrained strings: `type MealType = "breakfast" | "lunch" | "dinner" | "snack"`
- Prefer `interface` for object shapes, `type` for unions/aliases

### Imports

Use the `@/` path alias for all imports from `src/`:

```typescript
// Good
import { Button } from "@/components/ui/button"
import type { Workout } from "@/lib/types"
import { useWorkoutStore } from "@/stores/workoutStore"

// Bad
import { Button } from "../../../components/ui/button"
```

**Import order:**
1. React and external libraries
2. Internal components (`@/components/`)
3. Stores (`@/stores/`)
4. Hooks (`@/hooks/`)
5. Services (`@/services/`)
6. Types (`import type`)
7. Data/utils

### React Components

- Use **function components** with named exports
- Page components: `export function PageName() { ... }`
- UI components: `export function ComponentName() { ... }` or `export { Component }`
- Use `useState`, `useEffect`, `useCallback` from React
- Prefer controlled components for forms

```typescript
export function MyComponent() {
  const [value, setValue] = useState("")
  
  return <Input value={value} onChange={(e) => setValue(e.target.value)} />
}
```

### Zustand Stores

- Create stores in `src/stores/` with the pattern `use[Name]Store`
- Use `persist` middleware for localStorage persistence
- Include `version` and `migrate` for schema migrations

```typescript
export const useMyStore = create<MyStore>()(
  persist(
    (set, get) => ({
      // state and actions
    }),
    {
      name: "training-app-mystore",
      version: 1,
      migrate: (state, version) => { /* handle migrations */ }
    }
  )
)
```

### Styling

- Use **Tailwind CSS classes** exclusively
- Use `cn()` helper from `@/lib/utils` for conditional classes
- Follow mobile-first responsive design
- Use CSS variables from `index.css` for theming: `bg-background`, `text-foreground`, `text-muted-foreground`
- Common patterns:
  - Cards: `rounded-lg border bg-card`
  - Spacing: `space-y-4`, `gap-3`, `p-4`
  - Safe areas for PWA: `safe-area-top`, `safe-area-bottom`

```typescript
import { cn } from "@/lib/utils"

<div className={cn(
  "rounded-lg border p-4",
  isActive && "bg-primary/10 border-primary"
)} />
```

### Naming Conventions

- **Files:** `camelCase.ts` for utilities, `PascalCase.tsx` for components
- **Components:** PascalCase (`WorkoutPage`, `FoodListItem`)
- **Hooks:** camelCase with `use` prefix (`useRestTimer`, `useTheme`)
- **Stores:** camelCase with `use` prefix and `Store` suffix (`useWorkoutStore`)
- **Types/Interfaces:** PascalCase (`Workout`, `FoodItem`, `MealType`)
- **Constants:** UPPER_SNAKE_CASE or camelCase depending on context

### Error Handling

- Use try/catch for async operations
- Log errors with `console.error()` for debugging
- Return fallback values for failed operations
- Use `toast` from `sonner` for user-facing notifications

```typescript
try {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Failed: ${response.status}`)
  return await response.json()
} catch (error) {
  console.error("API error:", error)
  toast.error("Something went wrong")
  return null
}
```

### Navigation

- Use `react-router-dom` hooks: `useNavigate`, `useLocation`, `Link`, `NavLink`
- For conditional redirects in components, use `<Navigate to="..." replace />` instead of calling `navigate()` during render
- Routes are defined in `App.tsx` with lazy loading

### PWA Considerations

- Service worker configured via `vite-plugin-pwa`
- External API calls (Open Food Facts) are cached via Workbox
- Use `env(safe-area-inset-*)` for notch/home indicator areas
- App is designed for portrait orientation on mobile

## UI Components

shadcn/ui components are in `src/components/ui/`. Key components:
- `Button` - variants: default, outline, ghost, destructive, secondary
- `Card`, `CardHeader`, `CardContent`, `CardTitle`
- `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`
- `Sheet`, `SheetContent` - bottom sheets for mobile
- `Input`, `Label`, `Tabs`, `ScrollArea`, `Progress`

## Common Patterns

### Adding a new page
1. Create component in `src/pages/NewPage.tsx`
2. Add lazy import in `App.tsx`
3. Add route in the Routes configuration
4. Add to `BottomNav.tsx` if it's a main tab

### Adding a new store
1. Create `src/stores/newStore.ts`
2. Define interface for store state and actions
3. Use `persist` middleware with unique name and version
4. Export the hook: `export const useNewStore = create<...>()`

### Working with nutrition data
- Food items come from Open Food Facts API or custom entries
- All nutrition values are per serving
- Use `quantity` multiplier for calculating totals
