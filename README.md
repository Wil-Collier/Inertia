<p align="center">
  <img src="public/logo.svg" alt="Inertia Logo" width="280">
</p>

<h1 align="center">Inertia</h1>

<p align="center">
Mass in motion. An offline-first Progressive Web App (PWA) for tracking workouts, nutrition, progress, and momentum.
</p>

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Version](https://img.shields.io/badge/version-1.0.0--alpha-orange.svg)

## Core Identity

Inertia is built for people who treat fitness like a system: measure inputs, execute consistently, and iterate with data.

## Features

### Workout Tracking

- Start blank workouts or launch directly from saved templates
- Active workout flow with sets, reps, load, timed sets, notes, and completion toggles
- Rest timer with optional browser notifications and audio cues
- Save completed sessions to history and optionally save the session as a new template
- Template management: create, edit, target values, and delete
- Workout history grouped by month with expandable detail and deletion controls

### Nutrition Tracking

- Daily meal logging by meal type (breakfast/lunch/dinner/snacks)
- Macro + calorie summary against configurable goals
- Food search with local + remote provider support
- Barcode scanning flow with fallback to custom entry creation
- Favorites, custom foods, and reusable meal templates
- Nutrition history with 7/30/90-day trends and macro averages

### Progress & Analytics

- Dashboard quick actions and today overview (workout + nutrition)
- Weekly consistency visualization
- Progress tabs for volume, training, body metrics, and awards
- Exercise progress and personal record tracking
- Body weight history tracking with unit-aware display
- Achievement system with momentum/streak updates

### Offline-First & Data Reliability

- IndexedDB persistence via Dexie for instant local-first UX
- PWA install support and offline-capable shell
- Export/import backup workflow with schema-version validation
- Database health checks and recovery/reset flow for corrupted local state

### Cloud Sync (Optional)

- Google sign-in
- Access token in memory + refresh token cookie session model
- Multi-device sync engine with push/pull pipelines, pending queue, and conflict handling
- Sync status, pending-change count, manual sync trigger, and initial sync resolution options

### Backend API (Cloudflare Workers + Hono)

- Auth routes: login, refresh, logout
- Sync routes: push and pull
- Nutrition routes: search, barcode lookup, provider introspection
- Security middleware: headers, origin checks for auth mutations, payload limits, route-level rate limiting, and sanitized error responses

## Tech Stack

- **Frontend:** [React 19](https://react.dev/), [Vite 7](https://vite.dev/), [TypeScript](https://www.typescriptlang.org/)
- **Routing:** [TanStack Router](https://tanstack.com/router)
- **State/Data:** [TanStack Query](https://tanstack.com/query), [Dexie.js](https://dexie.org/), [Zustand](https://zustand-demo.pmnd.rs/)
- **UI:** [Tailwind CSS v4](https://tailwindcss.com/), [lucide-react](https://lucide.dev/)
- **Backend:** [Cloudflare Workers](https://developers.cloudflare.com/workers/), [Hono](https://hono.dev/), Cloudflare D1
- **Validation:** [Zod](https://zod.dev/)
- **Testing:** [Vitest](https://vitest.dev/), Testing Library, MSW, Playwright

## Getting Started

### Prerequisites

- Node.js `>=24`
- `pnpm`

### Install & Run

```bash
pnpm install
pnpm dev
```

### Quality Gates

```bash
pnpm build
pnpm lint
pnpm test
```

### Useful Commands

```bash
pnpm coverage      # test coverage report
pnpm test:e2e      # Playwright e2e tests
pnpm deploy        # build + Cloudflare deploy
```

## Environment

Client env (`.env.local`):

```bash
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
VITE_ENABLE_SYNC=true
```

Worker bindings (Wrangler):

- `DB`
- `JWT_SECRET`
- `GOOGLE_CLIENT_ID`
- optional: `APP_ORIGINS`, `SYNC_EVENTS_RETENTION_DAYS`
- optional nutrition provider vars: `NUTRITION_PROVIDER`, `FAT_SECRET_CLIENT_ID`, `FAT_SECRET_CLIENT_SECRET`

## License

MIT
