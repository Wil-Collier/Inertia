# Inertia – Infrastructure Roadmap

> **Last Updated:** February 1, 2026  
> **Status:** Phase 0 Complete

---

## Executive Summary

This document outlines the infrastructure evolution for Inertia, focusing on:

1. **Migrating from Cloudflare Pages to Workers** (required – unify runtime + enable D1-backed sync)
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
| **Cloudflare Workers** | Standardize on a single runtime with broader platform features (D1, Durable Objects, Cron Triggers) |
| **Cloudflare D1**     | Zero-config SQLite database, same deployment, easy migration to LibSQL later                    |
| **Hono**              | Lightweight router (~14KB), middleware pattern for JWT auth, Express-like DX                    |
| **Google OAuth**      | Simple "velvet rope" auth via Google Cloud Console **Test users** allowlist                     |

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

Implement "Kinetic Cloud" sync using D1 + Hono. This is the core sync feature that enables users to sync their workout and nutrition data across devices.

> **Implements:** PLAN.md Phases 1-4  
> - Phase 1: Local Data Prep (3-6 hours)  
> - Phase 2: Backend Foundation (1-2 days)  
> - Phase 3: Frontend Auth (4-6 hours)  
> - Phase 4: Sync Engine (1-2 days)  
>
> See [PLAN.md § Section 7](./PLAN.md#7-implementation-phases) for detailed task checklists.

#### Deliverables

- Users can sign in with Google (if in the Google Console **Test users** allowlist)
- Data syncs between devices
- Offline-first behavior preserved
- Manual "Sync Now" button works

---

### Phase 2: Sync Polish

**Effort:** 3-5 days  
**Priority:** Medium

Improve sync reliability and user experience with automatic triggers, conflict resolution UI, and derived data recalculation.

> **Implements:** PLAN.md Phase 5 (Polish & Testing)  
>
> See [PLAN.md § Section 7](./PLAN.md#7-implementation-phases) for detailed task checklist.

#### Deliverables

- First-time sync flow with merge/overwrite options
- Automatic background sync (app open, network reconnect, visibility)
- Sync status indicator
- Conflict resolution dialog
- Robust error handling with retry logic

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
