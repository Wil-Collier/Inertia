# Inertia – Infrastructure Roadmap

> **Last Updated:** January 31, 2026  
> **Status:** Phase 0 Complete

---

## Executive Summary

This document outlines the infrastructure evolution for Inertia, focusing on:

1. **Migrating from Cloudflare Pages to Workers** (required – Pages is deprecated)
2. **Implementing cloud sync** with D1 and Hono
3. **Future portability considerations** with Drizzle/LibSQL

The guiding principle is **MVP first, portability later** – ship working cloud sync on Cloudflare, then abstract for multi-cloud if needed.

---

## Current State

| Component      | Technology                       | Status              |
| -------------- | -------------------------------- | ------------------- |
| Frontend       | Vite + React 19 + TanStack Router | ✅ Stable           |
| Local Data     | Dexie.js (IndexedDB)             | ✅ Stable           |
| Backend        | Cloudflare Workers + Hono        | ✅ Migrated         |
| Nutrition API  | `/api/nutrition/*` (FatSecret/OpenFoodFacts) | ✅ Working |
| Cloud Sync     | —                                | ❌ Not implemented  |

---

## Technology Decisions

### ✅ Confirmed Choices

| Decision              | Rationale                                                                                        |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| **Cloudflare Workers** | Pages is deprecated; Workers has broader features (D1, Durable Objects, Cron Triggers)          |
| **Cloudflare D1**     | Zero-config SQLite database, same deployment, easy migration to LibSQL later                    |
| **Hono**              | Lightweight router (~14KB), middleware pattern for JWT auth, Express-like DX                    |
| **Google OAuth**      | Simple "velvet rope" auth via email whitelist                                                   |

### ❌ Not Needed Now

| Technology         | Why Not (Yet)                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **TanStack Start** | Adds complexity; Inertia is an offline-first PWA with minimal SSR needs. Current TanStack Router + Query stack is sufficient.    |
| **Drizzle ORM**    | Nice-to-have for typed queries and migrations, but raw D1 is simpler for MVP. Add later when schema stabilizes.                  |
| **LibSQL / Turso** | Portability concern for later. D1 uses standard SQLite SQL, easily migrated.                                                     |

### Future Considerations

If we need multi-cloud deployment or self-hosting:

1. **Drizzle** provides a database abstraction layer that works with D1, LibSQL, Postgres
2. **LibSQL/Turso** offers edge SQLite compatible with multiple providers
3. **TanStack Start** would make sense if we need SSR or server components

---

## Implementation Phases

### Phase 0: Infrastructure Migration ✅ COMPLETE

**Effort:** 1-2 days  
**Priority:** High (required before cloud sync)  
**Status:** ✅ Complete (January 31, 2026)

Migrated from Cloudflare Pages to Cloudflare Workers with static assets using the Cloudflare Vite plugin.

#### Completed Tasks

- [x] Created `wrangler.jsonc` with Workers configuration
- [x] Installed Cloudflare Vite plugin (`@cloudflare/vite-plugin`)
- [x] Installed Hono (`hono`)
- [x] Created Worker entry point (`worker/index.ts`)
- [x] Migrated nutrition routes from Pages Functions to Hono
- [x] Created `tsconfig.worker.json` for Worker TypeScript support
- [x] Updated `vite.config.ts` to use Cloudflare Vite plugin
- [x] Updated `package.json` scripts for Workers workflow
- [x] Removed old `wrangler.toml` and `functions/` directory
- [x] Verified build, lint, and dev server work correctly

#### Deliverables

- ✅ Working development with Cloudflare Vite plugin
- ✅ Existing nutrition API functionality preserved (`/api/nutrition/search`, `/api/nutrition/barcode`)
- ✅ Health check endpoint (`/api/health`)
- ✅ Clean Hono-based routing structure ready for auth/sync routes

#### New File Structure

```
worker/
├── index.ts                    # Hono app entry point
├── env.ts                      # Environment bindings type
└── nutrition/
    ├── types.ts                # Nutrition types
    ├── routes.ts               # Hono routes for /api/nutrition/*
    ├── providerFactory.ts      # Provider selection logic
    ├── openFoodFacts.ts        # OpenFoodFacts provider
    └── fatSecret.ts            # FatSecret provider with OAuth
```

---

### Phase 1: Cloud Sync MVP

**Effort:** 1-2 weeks  
**Priority:** High (core feature)

Implement "Kinetic Cloud" sync using D1 + Hono.

> See [PLAN.md](./PLAN.md) for detailed sync architecture (update for Workers/Hono)

#### Backend Tasks

- [ ] Create D1 database

  ```bash
  wrangler d1 create kinetic-cloud
  ```

- [ ] Add D1 binding to `wrangler.jsonc`

  ```jsonc
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "kinetic-cloud",
      "database_id": "your-database-id"
    }
  ]
  ```

- [ ] Create database schema (`migrations/0001_initial.sql`)
  - `whitelist` table (email-based access control)
  - `sync_store` table (user data by collection)
  - `audit_log` table (optional, for debugging)

- [ ] Implement auth routes
  - `POST /api/auth/login` – Verify Google ID token, check whitelist, issue JWT

- [ ] Implement sync routes
  - `POST /api/sync/push` – Accept local changes, LWW conflict resolution
  - `POST /api/sync/pull` – Return changes since last sync timestamp

- [ ] Add JWT middleware for `/api/sync/*` routes

#### Frontend Tasks

- [ ] Add `updatedAt` field to all syncable types
  - `Workout`, `WorkoutTemplate`, `FoodItem`, `DailyNutrition`, `WeightEntry`, `UserSettings`

- [ ] Dexie schema migration to add `updatedAt`

- [ ] Install Google OAuth

  ```bash
  pnpm add @react-oauth/google
  ```

- [ ] Create sync feature (`src/features/sync/`)
  - `store.ts` – Zustand stores for auth + sync state
  - `api.ts` – Typed fetch wrappers for sync endpoints
  - `syncEngine.ts` – Push/pull logic
  - `changeTracker.ts` – Track pending local changes

- [ ] Create `SyncSettings` component for Settings page

- [ ] Wrap app with `GoogleOAuthProvider`

#### Deliverables

- Users can sign in with Google (if whitelisted)
- Data syncs between devices
- Offline-first behavior preserved
- Manual "Sync Now" button works

---

### Phase 2: Sync Polish

**Effort:** 3-5 days  
**Priority:** Medium

Improve sync reliability and user experience.

#### Tasks

- [ ] Implement sync triggers
  - On app open (once per session)
  - On network reconnect (`online` event)
  - On tab visible (if stale > 1 minute)
  - Periodic background sync (every 5 minutes)
  - Best-effort push on `beforeunload`

- [ ] Debounced push after local mutations (5 second debounce)

- [ ] Conflict UI – Show conflicts to user (optional, LWW handles silently)

- [ ] Sync status indicator in header/nav

- [ ] Error handling + retry logic

- [ ] Recalculate derived data after sync
  - `userStats`, `achievements`, `personalRecords`, `streaks`

#### Deliverables

- Automatic background sync
- Visual sync status
- Robust error handling

---

### Phase 3: Portability (Future)

**Effort:** 1-2 weeks  
**Priority:** Low (only if needed)

Abstract database layer for multi-cloud deployment.

#### Tasks

- [ ] Introduce Drizzle ORM

  ```bash
  pnpm add drizzle-orm
  pnpm add -D drizzle-kit
  ```

- [ ] Create Drizzle schema matching D1 tables

- [ ] Migrate raw SQL queries to Drizzle

- [ ] Consider LibSQL/Turso for edge SQLite across providers

- [ ] Evaluate TanStack Start if SSR becomes needed

#### When to do this?

- If Cloudflare becomes too limiting
- If we need self-hosted option
- If we want to deploy to Vercel, Deno Deploy, etc.

---

## Portability Assessment

**Q: Will using Workers now make portability difficult later?**

**A: No.** The Cloudflare-specific pieces are minimal and easily abstracted:

| Component          | Cloudflare-Specific        | Portable Equivalent                 |
| ------------------ | -------------------------- | ----------------------------------- |
| Worker entry point | `export default { fetch }` | Standard in all edge runtimes       |
| D1 queries         | `env.DB.prepare()`         | Abstract behind a thin DB layer     |
| Static assets      | `env.ASSETS.fetch()`       | Each platform has asset handling    |
| Secrets            | `env.JWT_SECRET`           | Environment variables everywhere    |

The frontend (Vite + React + Dexie) is completely platform-agnostic.

---

## File Structure (Current)

```
inertia/
├── worker/                        # Hono backend (Phase 0 ✅)
│   ├── index.ts                   # Entry point
│   ├── env.ts                     # Environment bindings
│   └── nutrition/                 # Nutrition routes
│       ├── routes.ts
│       ├── types.ts
│       ├── providerFactory.ts
│       ├── openFoodFacts.ts
│       └── fatSecret.ts
├── src/                           # Frontend
│   ├── features/
│   │   └── ...existing features
│   └── ...existing src
├── wrangler.jsonc                 # Workers config
├── tsconfig.worker.json           # Worker TypeScript config
├── vite.config.ts                 # Vite + Cloudflare plugin
└── ...existing files
```

---

## Dependencies Added (Phase 0)

```bash
pnpm add hono
pnpm add -D @cloudflare/vite-plugin
```

---

## Dependencies to Add

### Phase 1

```bash
pnpm add @react-oauth/google
```

### Phase 3 (Future)

```bash
pnpm add drizzle-orm
pnpm add -D drizzle-kit
```

---

## Open Questions

1. **Admin UI for whitelist?** – How do we add emails to the whitelist? Direct D1 console, or build a simple admin page?

2. **Token refresh strategy?** – PLAN.md mentions 90-day JWTs. Do we need refresh tokens, or is re-auth on expiry acceptable?

3. **Sync scope?** – Should we sync custom exercises? They're in `customExercises` table but PLAN.md is ambiguous.

4. **Delete handling?** – Soft delete with `deleted` flag, or hard delete with a separate tombstone table?

---

## References

- [PLAN.md](./PLAN.md) – Detailed cloud sync architecture (needs update for Hono)
- [MIGRATION.md](./MIGRATION.md) – Nutrition provider migration (completed)
- [Cloudflare Pages → Workers Migration Guide](https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/)
- [Cloudflare Vite Plugin](https://developers.cloudflare.com/workers/vite-plugin/)
- [Hono Documentation](https://hono.dev/)
- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Cloudflare Workers static assets](https://developers.cloudflare.com/workers/static-assets/)
- [Cloudflare Workers documentation](https://developers.cloudflare.com/workers/)
