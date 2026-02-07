# Kinetic Cloud - Implementation Plan

> **Project:** Cloud sync for Inertia workout app  
> **Architecture:** "Velvet Rope" - Private, invitation-only sync via Cloudflare Workers + D1  
> **Created:** January 21, 2026

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Data Model Changes](#3-data-model-changes)
4. [Backend Implementation](#4-backend-implementation)
5. [Frontend Implementation](#5-frontend-implementation)
6. [Sync Engine Design](#6-sync-engine-design)
7. [Implementation Phases](#7-implementation-phases)
8. [File-by-File Changes](#8-file-by-file-changes)
9. [Rollback Plan](#9-rollback-plan)

---

## 1. Executive Summary

### Goals
- Enable cloud sync between user devices (phone, tablet, desktop)
- Maintain offline-first PWA experience
- Private "velvet rope" access via Google OAuth **Test users** allowlist (Google Cloud Console)
- Zero breaking changes to existing functionality

### Tech Stack

| Component        | Technology                              |
| ---------------- | --------------------------------------- |
| Auth Provider    | Google OAuth via `@react-oauth/google` |
| Backend Runtime  | Cloudflare Workers + Hono              |
| Database         | Cloudflare D1 (SQLite)                 |
| Auth Tokens      | Stateless JWTs (90-day expiry)         |
| Sync Strategy    | Last-Write-Wins (LWW) with timestamps  |
| Delete Strategy  | Soft delete (`deleted` flag)           |
| Whitelist        | Google Cloud Console (OAuth consent screen → Test users) |

### Scope

- **In Scope:** Workouts, templates, nutrition logs, custom foods, custom exercises, body weight, settings
- **Out of Scope:** Achievements, streaks, userStats, personalRecords (derived data - recalculated locally)

### Resolved Decisions

| Question | Decision | Rationale |
| -------- | -------- | --------- |
| **Whitelist management** | Google Cloud Console **Test users** allowlist | Simplest "velvet rope" MVP. No DB admin surface. Note: Google limits test users (~100); if we outgrow it, revisit a server-side allowlist. |
| **User identifier (server)** | Use Google ID token `sub` as the stable `userId` | Email can change; `sub` is stable. Store email as an attribute for UI/audit logs. |
| **Sync custom exercises** | ✅ Yes | Include `customExercises` table in sync scope. |
| **Delete strategy** | Soft delete | Use `deleted` flag on sync_store records. Allows undo and conflict resolution. |
| **Token expiry** | Re-auth on expiry | 90-day JWTs are sufficient. Users re-login when expired. No refresh tokens needed. |

---

## 2. Current Architecture Analysis

### Existing Stack
```
src/
├── services/db.ts          # Dexie.js database (IndexedDB)
├── features/               # React Query hooks for data access
│   ├── workout/mutations.ts
│   ├── nutrition/mutations.ts
│   ├── bodyweight/mutations.ts
│   └── settings/mutations.ts
├── lib/queryClient.ts      # TanStack Query config
└── pages/SettingsPage.tsx  # Settings UI (will add sync section)
```

### Current Dexie Tables (db.ts)

| Table              | Primary Key        | Syncable       | Notes                             |
| ------------------ | ------------------ | -------------- | --------------------------------- |
| `customExercises`  | `id`               | ✅ Yes         | User-created exercises only       |
| `workoutSessions`  | `id`               | ✅ Yes         | Main user data                    |
| `workoutTemplates` | `id`               | ✅ Yes         | User templates                    |
| `personalRecords`  | `exerciseId`       | ❌ No          | Derived from workouts             |
| `foods`            | `id`               | ✅ Custom only | `isCustom: true` foods only       |
| `nutritionLogs`    | `date`             | ✅ Yes         | Daily nutrition entries           |
| `mealTemplates`    | `id`               | ✅ Yes         | Saved meal combos                 |
| `settings`         | `id` ("settings") | ✅ Yes         | Single record                     |
| `bodyWeight`       | `id`               | ✅ Yes         | Weight entries                    |
| `achievements`     | `id`               | ❌ No          | Derived                           |
| `userStats`        | `id`               | ❌ No          | Derived aggregates                |
| `activeSession`    | `id` ("current")  | ❌ No          | Ephemeral                         |
| `restTimer` | `id` | ❌ | Ephemeral |
| `metadata` | `key` | ❌ | App metadata |

### Key Insight: Missing `updatedAt` Field
Current types lack timestamps for sync. Every syncable type needs an `updatedAt` field, but legacy local data/backups may not have it yet — treat it as optional in TypeScript and enforce/populate it at write time (Dexie hooks) and at sync enable time (backfill).

---

## 3. Data Model Changes

### 3.1 Add `updatedAt` to All Syncable Types

```typescript
// src/lib/types/syncable.ts (NEW FILE)
export interface Syncable {
  /**
   * Unix timestamp (ms).
   * Optional for legacy local data; sync requires this to be present.
   */
  updatedAt?: number
}

export interface SyncableWithId extends Syncable {
  id: string
}
```

### 3.2 Update Existing Types

Add `updatedAt?: number` (Unix timestamp **ms**) to every **cloud-synced** record. The field becomes effectively-required once sync is enabled (Dexie hooks + one-time backfill).

**workout.ts:**
```typescript
export interface Workout extends SyncableWithId {
  // ... existing fields
}

export interface WorkoutTemplate extends SyncableWithId {
  // ... existing fields
}
```

**nutrition.ts:**
```typescript
export interface FoodItem extends SyncableWithId {
  // ... existing fields
}

export interface DailyNutrition extends Syncable {
  date: string  // Primary key
  entries: MealEntry[]
}

export interface MealTemplate extends SyncableWithId {
  name: string
  entries: Omit<MealEntry, 'id'>[]
}
```

**bodyweight.ts:**
```typescript
export interface WeightEntry extends SyncableWithId {
  // ... existing fields
}
```

**settings.ts:**
```typescript
export interface UserSettings extends Syncable {
  // ... existing fields
}
```

**exercise.ts (custom exercises only):**
```typescript
export interface Exercise extends SyncableWithId {
  // ... existing fields
}
```

> Note: `customExercises` is the only exercise table in Dexie. Default exercises remain static in `src/data/exerciseDatabase.ts` and are not synced.

### 3.3 Backfill Strategy (No Dexie Version Bump)

Inertia keeps `CURRENT_SCHEMA_VERSION` at **1** during early development, and avoids complex IndexedDB migration chains.

- Adding **non-indexed** fields like `updatedAt` does **not** require changing the Dexie store schema.
- To handle existing local data (and older backups) that may be missing `updatedAt`, backfill at **sync enable time** (first successful login) and/or immediately before the first push.

Example backfill (one-time):

```typescript
// Run once after sign-in, before first push/pull
const now = Date.now()

await db.transaction('rw', [
  db.workoutSessions,
  db.workoutTemplates,
  db.foods,
  db.nutritionLogs,
  db.mealTemplates,
  db.bodyWeight,
  db.settings,
  db.customExercises,
], async () => {
  await db.workoutSessions.toCollection().modify((w: { updatedAt?: number }) => { w.updatedAt ??= now })
  await db.workoutTemplates.toCollection().modify((t: { updatedAt?: number }) => { t.updatedAt ??= now })
  await db.foods.toCollection().modify((f: { updatedAt?: number }) => { f.updatedAt ??= now })
  await db.nutritionLogs.toCollection().modify((n: { updatedAt?: number }) => { n.updatedAt ??= now })
  await db.mealTemplates.toCollection().modify((m: { updatedAt?: number }) => { m.updatedAt ??= now })
  await db.bodyWeight.toCollection().modify((bw: { updatedAt?: number }) => { bw.updatedAt ??= now })
  await db.settings.toCollection().modify((s: { updatedAt?: number }) => { s.updatedAt ??= now })
  await db.customExercises.toCollection().modify((e: { updatedAt?: number }) => { e.updatedAt ??= now })
})
```

---

## 4. Backend Implementation

### 4.1 Architecture: Cloudflare Workers + Hono

> **Note:** This project migrated from Cloudflare Pages Functions to Cloudflare Workers with the Vite plugin. See [ROADMAP.md](./ROADMAP.md) for migration details.

We use **Cloudflare Workers** with **Hono** as the web framework:

| Aspect                | Technology                                       |
| --------------------- | ------------------------------------------------ |
| Runtime               | Cloudflare Workers                               |
| Web Framework         | Hono (~14KB, middleware support)                 |
| Build Tool            | Vite + `@cloudflare/vite-plugin`                 |
| Local Dev             | `pnpm dev` (Vite with Workers runtime)           |
| Deployment            | `pnpm deploy` (wrangler deploy)                  |
| Static Assets         | Same Worker, `[assets]` config                   |

### 4.2 Project Structure (Workers + Hono)

```
inertia/
├── worker/                       # Hono backend
│   ├── index.ts                  # Entry point, mounts all routes
│   ├── env.ts                    # Environment bindings type
│   ├── middleware/
│   │   ├── auth.ts               # JWT verification middleware
│   │   └── errors.ts             # Error handling middleware
│   ├── nutrition/                # Existing nutrition routes
│   │   ├── routes.ts
│   │   └── ...
│   ├── auth/                     # NEW: Auth routes
│   │   └── routes.ts             # POST /api/auth/login
│   └── sync/                     # NEW: Sync routes
│       └── routes.ts             # POST /api/sync/push, /api/sync/pull
├── migrations/                   # D1 migrations
│   └── 0001_initial.sql
├── wrangler.jsonc                # Workers config
├── tsconfig.worker.json          # Worker TypeScript config
├── src/                          # Frontend code
└── ...
```

### 4.3 Worker Configuration (wrangler.jsonc)

```jsonc
{
    "$schema": "./node_modules/wrangler/config-schema.json",
    "name": "inertia",
    "compatibility_date": "2026-01-10",
    "main": "./worker/index.ts",

    "assets": {
        "not_found_handling": "single-page-application",
        "run_worker_first": ["/api/*"]
    },

    // D1 Database binding (uncomment when implementing sync)
    // "d1_databases": [
    //     {
    //         "binding": "DB",
    //         "database_name": "kinetic-cloud",
    //         "database_id": "your-database-id"
    //     }
    // ]
}
```

**Environment Variables (set in Cloudflare Dashboard → Workers → Settings → Variables):**

| Variable             | Type   | Description                    |
| -------------------- | ------ | ------------------------------ |
| `JWT_SECRET`         | Secret | HMAC key for signing JWTs      |
| `GOOGLE_CLIENT_ID`   | Secret | Google OAuth client ID         |

### 4.4 D1 Database Schema

```sql
-- migrations/0001_initial.sql

	-- Main sync store
	CREATE TABLE IF NOT EXISTS sync_store (
	  user_id TEXT NOT NULL,        -- Stable user key (Google `sub`)
	  user_email TEXT NOT NULL,     -- Display/audit (may change)
	  collection TEXT NOT NULL,
	  id TEXT NOT NULL,
	  data TEXT,                    -- JSON blob (nullable for tombstones)
	  updated_at INTEGER NOT NULL,  -- Unix timestamp (ms)
	  deleted INTEGER NOT NULL DEFAULT 0, -- Soft delete flag (1 = deleted)
	  device_id TEXT,               -- For debugging conflicts
	  PRIMARY KEY (user_id, collection, id)
	);
	
	-- Index for efficient pull queries
	CREATE INDEX IF NOT EXISTS idx_sync_pull 
	  ON sync_store (user_id, updated_at, collection, id);

-- Audit log (optional but recommended)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,         -- 'push', 'pull', 'login'
  details TEXT,                 -- JSON metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
```

	**Soft Delete Strategy:**

When a user deletes a record locally:
1. Set `deleted = 1` in the sync_store
2. Push the change with the updated timestamp
3. Other devices pull the deletion and remove the local record
4. Soft deletes are preserved for conflict resolution and potential undo

### 4.5 Worker Type Definitions & Middleware

```typescript
// worker/env.ts
import type { D1Database } from '@cloudflare/workers-types'

export interface Env {
  DB: D1Database
  JWT_SECRET: string
  GOOGLE_CLIENT_ID: string
  NUTRITION_PROVIDER?: string
  FAT_SECRET_CLIENT_ID?: string
  FAT_SECRET_CLIENT_SECRET?: string
}
```

```typescript
// worker/middleware/auth.ts
import { createMiddleware } from 'hono/factory'
import { verify } from 'hono/jwt'
import type { Env } from '../env'

type Variables = {
  userId: string
  userEmail: string
}

export const authMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(
  async (c, next) => {
    const authHeader = c.req.header('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'UNAUTHORIZED', message: 'Missing bearer token' }, 401)
    }

    const token = authHeader.slice(7)
    try {
      const payload = await verify(token, c.env.JWT_SECRET)
      c.set('userId', payload.sub as string)
      c.set('userEmail', (payload.email as string) ?? '')
      await next()
    } catch {
      return c.json({ error: 'UNAUTHORIZED', message: 'Invalid or expired token' }, 401)
    }
  }
)
```

```typescript
// worker/index.ts - mounting auth routes
import { Hono } from 'hono'
import { authMiddleware } from './middleware/auth'
import { authRoutes } from './auth/routes'
import { syncRoutes } from './sync/routes'
import { nutritionRoutes } from './nutrition/routes'
import type { Env } from './env'

const app = new Hono<{ Bindings: Env }>()

// Health check (no auth)
app.get('/api/health', (c) => c.json({ status: 'ok' }))

// Auth routes (no auth required)
app.route('/api/auth', authRoutes)

// Nutrition routes (no auth required)
app.route('/api/nutrition', nutritionRoutes)

// Protected sync routes (auth required)
app.use('/api/sync/*', authMiddleware)
app.route('/api/sync', syncRoutes)

export default app
```

### 4.6 Collection Mapping

| Frontend Table     | `collection` Value | Notes                       |
| ------------------ | ------------------ | --------------------------- |
| `workoutSessions`  | `workouts`         |                             |
| `workoutTemplates` | `templates`        |                             |
| `foods`            | `foods`            | Only `isCustom: true`       |
| `nutritionLogs`    | `nutrition`        | Key is `date`               |
| `mealTemplates`    | `mealTemplates`    |                             |
| `bodyWeight`       | `weight`           |                             |
| `settings`         | `settings`         | Single record, id="settings" |
| `customExercises`  | `exercises`        | All custom exercises synced |

### 4.7 API Endpoints

#### `POST /api/auth/login`

```typescript
// Request
interface LoginRequest {
  idToken: string  // Google ID Token
}

	// Response (success)
	interface LoginResponse {
	  accessToken: string   // JWT for API calls
	  userId: string        // Stable user identifier (Google `sub`)
	  email: string
	  expiresAtMs: number   // Unix timestamp (ms) for UI/storage
	}

// Response (error)
interface ErrorResponse {
  error: 'INVALID_TOKEN' | 'FORBIDDEN' | 'SERVER_ERROR'
  message: string
}
```

	**Implementation:**
	1. Verify Google ID Token
	   - MVP: use Google's `tokeninfo` endpoint (simple, one network call)
	   - Preferred: verify signature via Google JWKS + validate `iss/aud/exp` (no dependency on tokeninfo availability)
	2. Extract `sub` (stable user id) + email from token payload
	3. Verify `aud` matches `GOOGLE_CLIENT_ID` and `email_verified` is true
	4. Generate JWT with 90-day expiry
	5. Log to `audit_log`

#### `POST /api/sync/push`

```typescript
// Request
interface PushRequest {
  changes: Array<{
    collection: string
    id: string
	    data: object | null  // null = tombstone (deleted)
	    updatedAt: number
	    deviceId?: string
	  }>
	}

// Response
interface PushResponse {
  accepted: number
  conflicts: Array<{
    collection: string
    id: string
    serverUpdatedAt: number
    reason: string
  }>
}
```

**Implementation (LWW with Clock Skew Protection):**

Before applying LWW, clamp timestamps to prevent "future" timestamps from locking records forever (e.g., if a user's clock is wrong):

```typescript
// worker/sync/routes.ts - Push handler
const MAX_CLOCK_SKEW_MS = 60 * 60 * 1000 // 1 hour buffer

for (const change of request.changes) {
  // Clamp timestamps to prevent future timestamps from locking records
  const serverNow = Date.now()
  const maxAllowedTimestamp = serverNow + MAX_CLOCK_SKEW_MS
  
  if (change.updatedAt > maxAllowedTimestamp) {
    console.warn(`[Sync] Clamping future timestamp: ${change.updatedAt} -> ${serverNow}`)
    change.updatedAt = serverNow
  }
  
  // Now apply LWW with the (possibly clamped) timestamp
  // ...
}
```

	**SQL for LWW:**
	```sql
		INSERT INTO sync_store (user_id, user_email, collection, id, data, updated_at, deleted, device_id)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT (user_id, collection, id) DO UPDATE SET
		  updated_at = CASE
		    WHEN excluded.updated_at > sync_store.updated_at THEN excluded.updated_at
		    WHEN excluded.updated_at = sync_store.updated_at
		      AND COALESCE(excluded.device_id, '') > COALESCE(sync_store.device_id, '')
		      THEN excluded.updated_at + 1
		    ELSE sync_store.updated_at
		  END,
		  user_email = excluded.user_email,
		  deleted = excluded.deleted,
		  device_id = excluded.device_id,
		  -- Preserve last known data when receiving a delete tombstone with null data.
		  data = CASE
		    WHEN excluded.deleted = 1 THEN COALESCE(sync_store.data, excluded.data)
		    ELSE excluded.data
		  END
	WHERE
	  -- Primary rule: newer timestamp wins.
	  excluded.updated_at > sync_store.updated_at
	  OR (
	    -- Tie-breaker: deterministic winner on equal timestamps to avoid multi-device divergence.
	    excluded.updated_at = sync_store.updated_at
	    AND COALESCE(excluded.device_id, '') > COALESCE(sync_store.device_id, '')
	  );
	```

#### `POST /api/sync/pull`

```typescript
// Request
	interface SyncCursor {
	  updatedAt: number
	  collection: string
	  id: string
	}

		interface PullRequest {
		  cursor?: SyncCursor        // Exclusive cursor for pagination
		  collections?: string[]     // Optional filter
		  limit?: number             // Optional page size (1..500). Defaults to 500.
		}

// Response
	interface PullResponse {
	  changes: Array<{
	    collection: string
	    id: string
	    data: object | null
	    updatedAt: number
	    deleted: boolean
	  }>
	  nextCursor: SyncCursor | null
	  serverTimestampMs: number  // For UI ("last synced"), diagnostics
	  hasMore: boolean         // For pagination
	}
```

	**Implementation:**
	```sql
	-- Order is stable even when many rows share the same updated_at.
	-- Cursor is (updated_at, collection, id) and is EXCLUSIVE.
	SELECT collection, id, data, updated_at, deleted
	FROM sync_store
		WHERE user_id = ?
		  AND (
		    updated_at > ?
		    OR (updated_at = ? AND (collection > ? OR (collection = ? AND id > ?)))
		  )
	  -- Optional: AND collection IN (...)
	ORDER BY updated_at ASC, collection ASC, id ASC
	LIMIT ?; -- (limit + 1) to compute hasMore without a second query
	```

### 4.8 JWT Structure

	```typescript
	interface JWTPayload {
	  sub: string      // Stable user id (Google `sub`)
	  email: string    // Display/audit
	  iat: number      // Issued at (seconds since epoch)
	  exp: number      // Expiry (seconds since epoch; +90 days)
	  iss: 'kinetic-cloud'
	}
	```

---

## 5. Frontend Implementation

### 5.1 New Dependencies

```bash
pnpm add @react-oauth/google
```

**Zod note:** `zod` is already used in the app (backup import/export). Reuse it for runtime validation of sync payloads on both client and server.

### 5.2 New Files Structure

```
src/
├── features/
│   └── sync/
│       ├── api.ts              # Sync API client
│       ├── hooks.ts            # useSync, useAuth hooks
│       ├── store.ts            # Zustand store for sync state
│       ├── syncEngine.ts       # Core sync logic
│       ├── projection.ts       # Local <-> cloud record projection (strip local-only fields)
│       ├── dexieHooks.ts       # Dexie hooks to set updatedAt + enqueue changes (low mutation churn)
│       ├── changeTracker.ts    # Track local pending ops (metadata-backed, no record blobs)
│       ├── schemas.ts          # Zod schemas for validation (re-export from shared)
│       ├── derivedData.ts      # Recalculate achievements, stats, etc.
│       └── types.ts            # Sync-specific types
├── components/
│   └── settings/
│       ├── SyncSettings.tsx    # Sync sign-in, status, and controls
│       └── SyncConflictDialog.tsx  # Conflict resolution UI
└── lib/
    └── constants.ts            # Add sync-related constants
```

> **Shared schemas (recommended):** Add `shared/syncSchemas.ts` at the repo root and import it from both `src/` and `worker/` to avoid client/server drift.

### 5.3 Auth Store (Zustand)

```typescript
// src/features/sync/store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { SyncCursor } from './types'

interface AuthState {
  accessToken: string | null
  userId: string | null
  email: string | null
  expiresAtMs: number | null
  isAuthenticated: boolean
  
  setAuth: (token: string, userId: string, email: string, expiresAtMs: number) => void
  clearAuth: () => void
}

interface SyncState {
  /** For UI only ("Last synced: ...") */
  lastSyncedAtMs: number | null
  /** For incremental pulls (pagination-safe cursor) */
  pullCursor: SyncCursor | null
  isSyncing: boolean
  pendingOps: number
  error: string | null
  
  setSyncing: (syncing: boolean) => void
  setLastSyncedAt: (timestampMs: number) => void
  setPullCursor: (cursor: SyncCursor | null) => void
  setPendingOps: (count: number) => void
  setError: (error: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      userId: null,
      email: null,
      expiresAtMs: null,
      isAuthenticated: false,
      
      setAuth: (accessToken, userId, email, expiresAtMs) =>
        set({ accessToken, userId, email, expiresAtMs, isAuthenticated: true }),
      clearAuth: () => 
        set({ accessToken: null, userId: null, email: null, expiresAtMs: null, isAuthenticated: false }),
    }),
    { name: 'kinetic-auth' }
  )
)

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      lastSyncedAtMs: null,
      pullCursor: null,
      isSyncing: false,
      pendingOps: 0,
      error: null,
      
      setSyncing: (isSyncing) => set({ isSyncing }),
      setLastSyncedAt: (lastSyncedAtMs) => set({ lastSyncedAtMs, error: null }),
      setPullCursor: (pullCursor) => set({ pullCursor }),
      setPendingOps: (pendingOps) => set({ pendingOps }),
      setError: (error) => set({ error }),
    }),
    { name: 'kinetic-sync' }
  )
)
```

### 5.4 Change Tracker

```typescript
// src/features/sync/changeTracker.ts
import { db } from '@/services/db'

// Store pending ops in the existing metadata table to avoid a Dexie schema version bump.
// Keyed by `${collection}:${id}` to dedupe rapid edits.
//
// Important: do NOT store full record blobs here. The push step should read the
// latest record from Dexie and apply a cloud projection (strip local-only fields).
const PENDING_OPS_KEY = 'sync.pendingOps'

export type PendingOpType = 'upsert' | 'delete'

export interface PendingOp {
  collection: string
  id: string           // Record id (or `date` for nutrition logs)
  op: PendingOpType
  updatedAt: number
  deviceId?: string
}

/**
 * Most collections use `id`, but nutrition logs use `date` as primary key.
 */
export function getCloudId(collection: string, record: Record<string, unknown>): string {
  return collection === 'nutrition' ? (record.date as string) : (record.id as string)
}

function buildKey(op: Pick<PendingOp, 'collection' | 'id'>): string {
  return `${op.collection}:${op.id}`
}

async function readPendingMap(): Promise<Record<string, PendingOp>> {
  const record = await db.metadata.get(PENDING_OPS_KEY)
  if (!record || typeof record.value !== 'string') return {}
  try {
    const parsed = JSON.parse(record.value) as Record<string, PendingOp>
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

async function writePendingMap(map: Record<string, PendingOp>): Promise<void> {
  await db.metadata.put({ key: PENDING_OPS_KEY, value: JSON.stringify(map) })
}

/**
 * Queue an operation for sync. Call this WITHIN a Dexie transaction that includes `db.metadata`
 * to ensure atomicity with the data mutation.
 */
export async function queuePendingOp(op: PendingOp): Promise<void> {
  const map = await readPendingMap()
  map[buildKey(op)] = op
  await writePendingMap(map)
}

export async function getPendingOps(): Promise<PendingOp[]> {
  const map = await readPendingMap()
  return Object.values(map).toSorted((a, b) => a.updatedAt - b.updatedAt)
}

export async function clearPendingOps(keys: Array<{ collection: string; id: string }>): Promise<void> {
  const map = await readPendingMap()
  for (const key of keys) {
    delete map[buildKey(key)]
  }
  await writePendingMap(map)
}
```

**Push behavior (important):**
- For `op: 'upsert'`, `syncEngine.push()` reads the current record from Dexie and converts it via `projection.toCloudRecord(collection, record)`.
- For `op: 'delete'`, `syncEngine.push()` sends a tombstone (`data: null`, `deleted: true`).

### 5.5 Zod Validation Schemas

```typescript
// src/features/sync/schemas.ts
import { z } from 'zod'
// Recommended: define these schemas in `shared/syncSchemas.ts` and re-export from here
// so the Worker and client share the exact same runtime validation.

// Sync change item schema
export const CollectionSchema = z.enum([
  'workouts', 'templates', 'foods', 'nutrition',
  'mealTemplates', 'weight', 'settings', 'exercises'
])

export const SyncChangeSchema = z.object({
  collection: CollectionSchema,
  id: z.string().min(1),
  data: z.record(z.unknown()).nullable(),
  updatedAt: z.number().positive(),
  deviceId: z.string().optional(),
})

export const SyncCursorSchema = z.object({
  updatedAt: z.number().min(0),
  collection: CollectionSchema,
  id: z.string().min(1),
})

export const PushRequestSchema = z.object({
  changes: z.array(SyncChangeSchema).max(100),
})

export const PullRequestSchema = z.object({
  cursor: SyncCursorSchema.optional(),
  collections: z.array(CollectionSchema).optional(),
  limit: z.number().int().min(1).max(500).optional(),
})

export const PullResponseSchema = z.object({
  changes: z.array(SyncChangeSchema.extend({
    deleted: z.boolean(),
  })),
  nextCursor: SyncCursorSchema.nullable(),
  serverTimestampMs: z.number().min(0),
  hasMore: z.boolean(),
})

// Type inference
export type SyncChange = z.infer<typeof SyncChangeSchema>
export type PushRequest = z.infer<typeof PushRequestSchema>
export type PullRequest = z.infer<typeof PullRequestSchema>
export type PullResponse = z.infer<typeof PullResponseSchema>
```

### 5.6 Derived Data Recalculation

After pulling changes from the cloud, derived data must be recalculated:

```typescript
// src/features/sync/derivedData.ts
import { achievementService } from '@/services/achievementService'
import { statsService } from '@/services/statsService'
import { db } from '@/services/db'

/**
 * Recalculates all derived data after a sync pull.
 * Derived data is NOT synced - it's recomputed from synced source data.
 */
export async function recalculateDerivedData(): Promise<void> {
  console.log('[Sync] Recalculating derived data...')

  // 1. Recalculate all personal records from workout history
  await rebuildPersonalRecords()

  // 2. Recalculate incremental stats from scratch
  await statsService.recalculateAll()

  // 3. Recalculate streaks + check achievements (uses existing service)
  await achievementService.checkAll()

  console.log('[Sync] Derived data recalculation complete')
}

function estimateOneRepMax(weight: number, reps: number): number {
  // Match the app's existing PR comparison logic (see activeSessionService).
  if (reps === 0 || weight === 0) return 0
  if (reps === 1) return weight
  if (reps >= 13) return weight * (1 + reps / 30)
  return weight * (36 / (37 - reps))
}

async function rebuildPersonalRecords(): Promise<void> {
  await db.transaction('rw', [db.workoutSessions, db.personalRecords], async () => {
    const workouts = await db.workoutSessions.toArray()

    const bestByExercise = new Map<string, {
      e1rm: number
      weight: number
      reps: number
      date: string
      workoutId: string
    }>()

    for (const workout of workouts) {
      for (const exercise of workout.exercises) {
        for (const set of exercise.sets) {
          if (!set.isCompleted || set.weight <= 0 || set.reps <= 0) continue

          const e1rm = estimateOneRepMax(set.weight, set.reps)
          const existing = bestByExercise.get(exercise.exerciseId)
          if (!existing || e1rm > existing.e1rm) {
            bestByExercise.set(exercise.exerciseId, {
              e1rm,
              weight: set.weight,
              reps: set.reps,
              date: workout.date,
              workoutId: workout.id,
            })
          }
        }
      }
    }

    await db.personalRecords.clear()
    await db.personalRecords.bulkPut(
      Array.from(bestByExercise.entries()).map(([exerciseId, pr]) => ({
        exerciseId,
        weight: pr.weight,
        reps: pr.reps,
        date: pr.date,
        workoutId: pr.workoutId,
      }))
    )
  })
}
```

### 5.7 Sync Hook

```typescript
// src/features/sync/hooks.ts
import { useCallback } from 'react'
import { useAuthStore, useSyncStore } from './store'
import { syncEngine } from './syncEngine'
import { recalculateDerivedData } from './derivedData'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'

export function useSync() {
  const queryClient = useQueryClient()
  const { isAuthenticated, accessToken } = useAuthStore()
  const { isSyncing, pullCursor, lastSyncedAtMs, pendingOps, error, setSyncing, setPullCursor, setLastSyncedAt, setError } = useSyncStore()

  const sync = useCallback(async () => {
    if (!isAuthenticated || !accessToken || isSyncing) return

    try {
      setSyncing(true)
      setError(null)

      // Push local changes
      await syncEngine.push(accessToken)

      // Pull remote changes
      const pulled = await syncEngine.pull(accessToken, pullCursor)

      // Apply changes to local DB
      await syncEngine.applyChanges(pulled.changes)

      // Recalculate derived data (achievements, PRs, stats)
      if (pulled.changes.length > 0) {
        await recalculateDerivedData()
      }

      // Update cursor + UI timestamp
      setPullCursor(pulled.nextCursor)
      setLastSyncedAt(pulled.serverTimestampMs)

      // Invalidate affected queries
      void queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.templates.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.nutrition.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.foods.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.bodyWeight.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.settings.all })
      void queryClient.invalidateQueries({ queryKey: queryKeys.achievements.all })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
      throw err
    } finally {
      setSyncing(false)
    }
  }, [isAuthenticated, accessToken, isSyncing, pullCursor, queryClient])

  const pushOnly = useCallback(async () => {
    if (!isAuthenticated || !accessToken || isSyncing) return

    try {
      setSyncing(true)
      setError(null)
      await syncEngine.push(accessToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setSyncing(false)
    }
  }, [isAuthenticated, accessToken, isSyncing])

  return {
    sync,
    pushOnly,
    isSyncing,
    lastSyncedAtMs,
    pendingOps,
    error,
    isAuthenticated,
  }
}
```

### 5.8 Google OAuth Integration

```typescript
// src/main.tsx - Update to wrap with GoogleOAuthProvider
import { GoogleOAuthProvider } from '@react-oauth/google'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID

createRoot(rootElement).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <QueryClientProvider client={queryClient}>
        <App />
      </QueryClientProvider>
    </GoogleOAuthProvider>
  </StrictMode>
)
```


### 5.9 Sync Settings UI

```typescript
// src/components/settings/SyncSettings.tsx
export function SyncSettings() {
  const { sync, isSyncing, lastSyncedAtMs, isAuthenticated, error } = useSync()
  const { email, clearAuth } = useAuthStore()

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="uppercase tracking-tight">KINETIC CLOUD</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Sign in to sync your data across devices.
          </p>
          <GoogleLogin
            onSuccess={async (credentialResponse) => {
              const idToken = credentialResponse.credential
              if (!idToken) throw new Error('Missing Google ID token')

              // Exchange Google ID token for our API JWT via /api/auth/login
              const result = await syncApi.login(idToken)
              useAuthStore.getState().setAuth(
                result.accessToken,
                result.userId,
                result.email,
                result.expiresAtMs
              )
            }}
            onError={() => {
              // Show toast or set error state
              console.error('Google sign-in failed')
            }}
          />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="uppercase tracking-tight">KINETIC CLOUD</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">{email}</span>
          <Button variant="ghost" size="sm" onClick={clearAuth}>
            Sign Out
          </Button>
        </div>
        
        {lastSyncedAtMs && (
          <p className="text-xs text-muted-foreground">
            Last synced: {formatDistanceToNow(lastSyncedAtMs)} ago
          </p>
        )}
        
        {error && (
          <p className="text-xs text-destructive">{error}</p>
        )}
        
        <Button onClick={sync} disabled={isSyncing} className="w-full">
          {isSyncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          {isSyncing ? 'Syncing...' : 'Sync Now'}
        </Button>
      </CardContent>
    </Card>
  )
}
```

---

## 6. Sync Engine Design

### 6.0 First-Time Sync Flow

When a user signs in to enable sync:

```
FIRST-TIME SYNC FLOW

1) User signs in with Google → receives API JWT
2) Determine:
   - Is local DB empty?
   - Does cloud have any data for this account? (lightweight pull, limit=1)

3) If local is empty:
   - Pull from cloud (auto)

4) If local has data:
   - If cloud is empty → Push local (auto)
   - If cloud has data → Show dialog:
     - Merge (Union + LWW)
     - Use Cloud (replace local)
     - Use Local (overwrite cloud)

5) Recalculate derived data (achievements, stats, PRs)
```

**"Merge" Strategy Definition (Union + LWW):**

To avoid complex diffing UIs, "Merge" is strictly defined as:

| Scenario                         | Action                                      |
|----------------------------------|---------------------------------------------|
| Record exists on **Cloud only**  | Add to Local                                |
| Record exists on **Local only**  | Push to Cloud                               |
| Record exists on **Both**        | Last-Write-Wins (later `updatedAt` wins)    |

This is a simple "Union + LWW" approach that:

- Avoids losing *entire records* during **Merge** (union of both sets)
- Still uses **record-level** LWW (field-level concurrent edits can be overwritten)
- Resolves conflicts deterministically (timestamp-based)
- Requires no user intervention for individual records

**Destructive Options (Explicit Confirmations Required):**
- **Use Cloud (replace local):** Clears *local sync scope* tables and pulls from cloud. Recommend exporting a local backup first.
- **Use Local (overwrite cloud):** Clears *cloud sync scope* rows (equivalent to "Clear cloud data") then pushes the local snapshot.

**Different Google Account:**
If user signs in with a different Google account than before:
- Treat as a completely new sync account
- Follow the same first-time sync flow above
- Previous account's cloud data remains on their servers (accessible if they sign back in)

### 6.0.1 Sign-Out Behavior

| Action | Behavior |
|--------|----------|
| Sign out | Keep local data, clear auth tokens |
| "Clear cloud data" option | Delete all user data from D1, keep local |
| Sign in with different account | Treat as new sync, follow first-time flow |

### 6.0.2 Conflict Resolution

When a push detects a conflict (server has newer data than expected):

```typescript
// Conflict detected during push
interface SyncConflict {
  collection: string
  id: string
  localData: object
  localUpdatedAt: number
  serverData: object
  serverUpdatedAt: number
}

// User is shown a dialog:
// "Conflict detected for [Workout: Leg Day]
//  Local version: Modified Jan 31, 2026 at 3:45 PM
//  Cloud version: Modified Jan 31, 2026 at 4:12 PM
//  [Use Local] [Use Cloud] [View Both]"
```

The `SyncConflictDialog` component shows:
- Record name/type
- Both timestamps formatted nicely
- Preview of differences if applicable
- Choice buttons: "Use Local", "Use Cloud"

### 6.1 Sync Triggers

| Trigger | Behavior | When |
|---------|----------|------|
| App opens | Pull in background | Once per session |
| Network reconnects | Pull + push pending | `online` event |
| After local mutation | Queue change, debounce push | 5 seconds after last change |
| Tab becomes visible | Pull if stale (>1 min) | `visibilitychange` event |
| Manual "Sync Now" | Immediate push + pull | User clicks button in Settings |
| Periodic (optional) | Pull in background | Every 5 minutes |

#### Implementation: Sync Triggers Hook

```typescript
// src/features/sync/useSyncTriggers.ts
import { useEffect, useRef } from 'react'
import { useSync } from './hooks'

const STALE_THRESHOLD_MS = 60 * 1000  // 1 minute
const PERIODIC_SYNC_MS = 5 * 60 * 1000  // 5 minutes

export function useSyncTriggers() {
  const { sync, lastSyncedAtMs, isAuthenticated } = useSync()
  const hasInitialSynced = useRef(false)

  // 1. Sync on app open (once per session)
  useEffect(() => {
    if (isAuthenticated && !hasInitialSynced.current) {
      hasInitialSynced.current = true
      void sync()
    }
  }, [isAuthenticated, sync])

  // 2. Sync on network reconnect
  useEffect(() => {
    if (!isAuthenticated) return

    const handleOnline = () => {
      console.log('[Sync] Network reconnected, syncing...')
      void sync()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [isAuthenticated, sync])

  // 3. Sync when tab becomes visible (if stale)
  useEffect(() => {
    if (!isAuthenticated) return

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const isStale = !lastSyncedAtMs || (Date.now() - lastSyncedAtMs > STALE_THRESHOLD_MS)
        if (isStale) {
          console.log('[Sync] Tab visible and stale, pulling...')
          void sync()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated, lastSyncedAtMs, sync])

  // 4. Optional: Periodic sync (every 5 minutes)
  useEffect(() => {
    if (!isAuthenticated) return

    const interval = setInterval(() => {
      console.log('[Sync] Periodic sync...')
      void sync()
    }, PERIODIC_SYNC_MS)

    return () => clearInterval(interval)
  }, [isAuthenticated, sync])
}
```

#### Implementation: Debounced Push After Mutations

Changes are tracked immediately, but pushed to the server with a 5-second debounce to batch rapid edits:

```typescript
// src/features/sync/useDebouncedPush.ts
import { useEffect, useCallback, useRef } from 'react'
import { useSync } from './hooks'
import { useSyncStore } from './store'

const DEBOUNCE_MS = 5000

export function useDebouncedPush() {
  const { pushOnly, isAuthenticated } = useSync()
  const { pendingOps } = useSyncStore()
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced push function
  const debouncedPush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (pendingOps > 0) {
        console.log(`[Sync] Debounced push: ${pendingOps} ops`)
        void pushOnly()
      }
    }, DEBOUNCE_MS)
  }, [pendingOps, pushOnly])

  // Trigger debounced push when pending changes increase
  useEffect(() => {
    if (isAuthenticated && pendingOps > 0) {
      debouncedPush()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isAuthenticated, pendingOps, debouncedPush])
}
```

#### Note: `pushOnly`

Expose a `pushOnly()` method from `useSync()` (shown in §5.7) so debounced pushes can batch local edits without doing a pull every time.

#### Where to Mount the Triggers

Add the sync triggers at the app root level:

```typescript
// src/App.tsx
import { useSyncTriggers } from '@/features/sync/useSyncTriggers'
import { useDebouncedPush } from '@/features/sync/useDebouncedPush'

function App() {
  // Mount sync triggers (only active when authenticated)
  useSyncTriggers()
  useDebouncedPush()

  return <RouterProvider router={router} />
}
```

#### Sync Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        USER ACTIONS                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [Create Workout] ──► Dexie hook queues op ──► pendingOps++     │
│                                              │                   │
│                                              ▼                   │
│                                    ┌─────────────────┐          │
│                                    │ Debounce 5 sec  │          │
│                                    └────────┬────────┘          │
│                                              │                   │
│                                              ▼                   │
│                                    ┌─────────────────┐          │
│                                    │   pushOnly()    │          │
│                                    │  Push to D1     │          │
│                                    └─────────────────┘          │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                        SYSTEM EVENTS                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  [App Opens] ─────────────────────────► sync() (pull + push)    │
│                                                                  │
│  [Tab Visible] ───► Is stale? ──yes──► sync() (pull + push)    │
│                          │                                       │
│                          no                                      │
│                          │                                       │
│                          ▼                                       │
│                      (no action)                                 │
│                                                                  │
│  [Network Online] ────────────────────► sync() (pull + push)    │
│                                                                  │
│  [Every 5 min] ───────────────────────► sync() (pull + push)    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Mutation Integration Pattern

Prefer **Dexie hooks** over editing every mutation site. This keeps the sync system correct even as new mutations are added, and it reduces the risk of missing a `queuePendingOp()` call.

**Critical rule:** enqueueing a pending op must be in the **same Dexie transaction** as the write. Dexie hooks run inside the transaction, which provides the atomicity we want.

**Implementation sketch:**

```typescript
// src/features/sync/dexieHooks.ts
import { db } from '@/services/db'
import { useAuthStore } from '@/features/sync/store'
import { queuePendingOp } from '@/features/sync/changeTracker'
import { getDeviceId } from '@/features/sync/deviceId'

function isAuthed(): boolean {
  return useAuthStore.getState().isAuthenticated
}

function nowMs(): number {
  return Date.now()
}

export function registerSyncDexieHooks(): void {
  const deviceId = getDeviceId()

  db.workoutSessions.hook('creating', (_primKey, obj, tx) => {
    obj.updatedAt ??= nowMs()
    if (isAuthed()) void queuePendingOp({ collection: 'workouts', id: obj.id, op: 'upsert', updatedAt: obj.updatedAt, deviceId })
  })

  db.workoutSessions.hook('updating', (mods, primKey) => {
    const updatedAt = nowMs()
    // Ensure all updates bump the timestamp.
    ;(mods as Record<string, unknown>).updatedAt = updatedAt
    if (isAuthed()) void queuePendingOp({ collection: 'workouts', id: String(primKey), op: 'upsert', updatedAt, deviceId })
    return mods
  })

  db.workoutSessions.hook('deleting', (primKey) => {
    const updatedAt = nowMs()
    if (isAuthed()) void queuePendingOp({ collection: 'workouts', id: String(primKey), op: 'delete', updatedAt, deviceId })
  })

  // Repeat for templates, nutritionLogs (id = date), mealTemplates, bodyWeight, settings, customExercises, foods (custom only).
  // For foods: skip queueing when only `usageCount` changes to avoid noisy pushes.
}
```

**Notes & exceptions:**
- Hooks should only be registered once (e.g., at app startup).
- Register hooks and sync triggers only after the DB health check passes (see `AppInitializer`) to avoid attaching to a corrupted database state.
- `foods.usageCount` is a local optimization field and should not cause sync traffic. Either:
  - skip queueing when the only change is `usageCount`, and/or
  - exclude `usageCount` in `projection.toCloudRecord()` (still recommended even if you skip).
- Some values are intentionally local/derived (`workout.exerciseIds`, `foods.usageCount`). The sync path should not rely on these being present on the wire (see “projection” in §5.2).

### 6.3 Conflict Resolution (LWW + Daily Nutrition Merge)

Most collections use record-level LWW. **Nutrition logs are a special case** because a day is a single record containing many meal entries. LWW alone would drop entries when two devices log food on the same date. We **always merge** `DailyNutrition.entries` by `MealEntry.id` and let the remote entry win on conflicts. No fallback to pure LWW for `nutritionLogs`.

```typescript
// In syncEngine.applyChanges
	async function applyChanges(changes: SyncChange[]): Promise<void> {
	  for (const change of changes) {
	    const localRecord = await getLocalRecord(change.collection, change.id)
	    
	    // Nutrition logs are merged by entry id to avoid losing same-day logs.
	    if (change.collection === 'nutrition') {
	      if (change.deleted) {
	        await deleteLocalRecord(change.collection, change.id)
	        continue
	      }

	      const remote = projection.fromCloudRecord(change.collection, change.data)
	      const merged = mergeDailyNutrition(localRecord, remote)
	      await upsertLocalRecord(change.collection, change.id, merged)
	      continue
	    }

	    // LWW: Only apply if remote is newer
	    if (!localRecord || change.updatedAt > localRecord.updatedAt) {
	      if (change.deleted) {
	        await deleteLocalRecord(change.collection, change.id)
	      } else {
	        // Normalize cloud payload to local shape and recompute local-only fields.
	        const local = projection.fromCloudRecord(change.collection, change.data)
	        await upsertLocalRecord(change.collection, change.id, local)
	      }
	    }
	  }
	}

	function mergeDailyNutrition(local: DailyNutrition | null, remote: DailyNutrition): DailyNutrition {
	  if (!local) return remote

	  const byId = new Map(local.entries.map((entry) => [entry.id, entry]))
	  for (const entry of remote.entries) {
	    byId.set(entry.id, entry)
	  }

	  return {
	    ...remote,
	    entries: Array.from(byId.values()),
	    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0),
	  }
	}
```

### 6.4 Local-Only Field Rebuild + Query Invalidation

Some fields are **local-only** and not sent over sync. After applying remote changes, rebuild these fields so local queries and indexes stay correct:

| Field | Source | Why |
|------|--------|-----|
| `workout.exerciseIds` | `workout.exercises` | Required for Dexie multi-entry index |
| `foods.usageCount` | `nutritionLogs` | Used for safe deletion checks |

**Strategy:** After any pull with changes, run a rebuild step:
- For workouts touched by the pull, recompute `exerciseIds` from `exercises`.
- Recompute `foods.usageCount` by scanning `nutritionLogs` or by updating counts based on changed days.

**Also invalidate React Query caches** after applying changes because queries use `staleTime: Infinity`. Use a collection → queryKeys map and call `queryClient.invalidateQueries()` for affected domains.

### 6.5 Derived Data Recalculation

Derived data (`userStats`, `personalRecords`, `achievements`, `streaks`) is **not synced** but must be recalculated after pulling changes that affect source data.

#### When Recalculation Happens

| Trigger | What Gets Recalculated |
|---------|----------------------|
| Sync pulls new/updated workouts | `userStats`, `personalRecords`, `streaks`, workout `achievements` |
| Sync pulls deleted workouts | `userStats`, `personalRecords`, `streaks` |
| Sync pulls nutrition changes | Nutrition `streaks`, nutrition `achievements` |
| Initial sync (first login) | All derived data (full recalculation) |

#### Implementation

- Implement `recalculateDerivedData()` in `src/features/sync/derivedData.ts` (see §5.6).
- Call it after `applyChanges()` completes **when** the pull contained changes that affect derived state (workouts, nutrition, templates, exercises). For MVP, calling it whenever `pulled.changes.length > 0` is acceptable.

#### Performance Considerations

| Scenario | Strategy |
|----------|----------|
| **First sync (many workouts)** | Full recalculation runs once; takes ~1-3s for 500 workouts |
| **Incremental sync (few changes)** | Still does full recalc, but data is small so it's fast |
| **Optimization (future)** | Could diff changes and update incrementally, but not worth complexity initially |

#### Why Full Recalculation?

1. **Simplicity**: Reuses existing `achievementService` logic
2. **Correctness**: No risk of drift between devices
3. **Rarity**: Only happens on sync, not every mutation
4. **Speed**: With indexed Dexie queries, 500 workouts recalc <2s

---

## 7. Implementation Phases

### Phase 1: Local Data Prep (3-6 hours)
- [ ] Add `updatedAt?: number` to all sync-scope types (`Workout`, `WorkoutTemplate`, `FoodItem`, `DailyNutrition`, `MealTemplate`, `WeightEntry`, `UserSettings`, `Exercise`)
- [ ] Implement `projection.toCloudRecord()` / `projection.fromCloudRecord()` to strip local-only fields (e.g. `foods.usageCount`, `workout.exerciseIds`)
- [ ] Implement metadata-backed pending ops queue (`src/features/sync/changeTracker.ts`) (no record blobs)
- [ ] Register Dexie hooks (`src/features/sync/dexieHooks.ts`) to bump `updatedAt` + enqueue ops atomically (skip noisy local-only updates like `foods.usageCount`)
- [ ] Backfill missing `updatedAt` on first successful login (see §3.3)
- [ ] Strip/reset sync metadata on import (pending ops, cursors, auth state, device id)
- [ ] Ensure shared sync schemas compile in both app and worker builds (update `tsconfig.app.json` and `tsconfig.worker.json` includes to add `shared/`)

### Phase 2: Backend Foundation (1-2 days)
- [ ] Configure Google OAuth consent screen in **Testing** mode and add **Test users** allowlist
- [ ] Create D1 database: `wrangler d1 create kinetic-cloud`
- [ ] Add D1 binding to `wrangler.jsonc`
- [ ] Create `migrations/0001_initial.sql` with `sync_store` and `audit_log` tables
- [ ] Apply migrations: `wrangler d1 execute kinetic-cloud --file=./migrations/0001_initial.sql`
- [ ] Implement `worker/auth/routes.ts` with POST /api/auth/login
- [ ] Implement Google ID Token verification in `worker/auth/google.ts`
- [ ] Implement `worker/sync/routes.ts` with push/pull endpoints
- [ ] Add auth middleware `worker/middleware/auth.ts` (uses `hono/jwt`)
- [ ] Test locally with `pnpm dev`
- [ ] Deploy with `pnpm deploy`

### Phase 3: Frontend Auth (4-6 hours)
- [ ] Install dependency: `pnpm add @react-oauth/google`
- [ ] Create auth Zustand store (`src/features/sync/store.ts`)
- [ ] Create sync Zustand store
- [ ] Create Zod validation schemas (`src/features/sync/schemas.ts`)
- [ ] Add `GoogleOAuthProvider` to `main.tsx`
- [ ] Create `SyncSettings` component
- [ ] Add `SyncSettings` to Settings page
- [ ] Handle token expiry / re-auth prompts

### Phase 4: Sync Engine (1-2 days)
- [ ] Create sync API client (`src/features/sync/api.ts`)
- [ ] Implement change tracker (`src/features/sync/changeTracker.ts`)
- [ ] Implement push logic in `syncEngine.ts`
- [ ] Implement pull logic in `syncEngine.ts`
- [ ] Implement LWW conflict resolution
- [ ] Implement `DailyNutrition` merge strategy (merge entries by `MealEntry.id`, remote wins on conflicts)
- [ ] Implement first-time sync flow:
  - [ ] Detect local empty vs cloud empty
  - [ ] Show "Merge" / "Use Cloud" / "Use Local" when both have data
  - [ ] Handle sign-in with different Google account
- [ ] Implement local-only field rebuild after pull (`workout.exerciseIds`, `foods.usageCount`) (`src/features/sync/localRebuild.ts`)
- [ ] Invalidate React Query caches after pull (collection → queryKeys map) (`src/features/sync/queryInvalidation.ts`)
- [ ] Implement derived data recalculation (`src/features/sync/derivedData.ts`)
- [ ] Wire up sync triggers (app open, network reconnect, visibility change)
- [ ] Implement debounced push (5 second debounce after mutations)
- [ ] Verify no mutation paths bypass Dexie hooks (bulk writes, service helpers)

### Phase 5: Polish & Testing (1 day)
- [ ] Add sync status indicator in Settings page
- [ ] Create `SyncConflictDialog` component for manual conflict resolution
- [ ] Add visual feedback for sync success/failure (toasts)
- [ ] Implement error handling with retry logic
- [ ] Test multi-device scenarios
- [ ] Test offline/online transitions
- [ ] Test conflict scenarios
- [ ] Performance testing

**Total Estimated Time: 5-7 days**

---

## 8. File-by-File Changes

### New Files

| Path | Purpose |
|------|---------|
| `worker/auth/routes.ts` | POST /api/auth/login endpoint |
| `worker/auth/google.ts` | Google ID Token verification |
| `worker/sync/routes.ts` | POST /api/sync/push and /api/sync/pull endpoints |
| `worker/lib/db.ts` | D1 query helpers |
| `migrations/0001_initial.sql` | D1 database schema (`sync_store`, `audit_log`) |
| `shared/syncSchemas.ts` | Shared Zod schemas/types for sync payloads (imported by `worker/` + `src/`) |
| `src/features/sync/api.ts` | API client for sync endpoints |
| `src/features/sync/hooks.ts` | `useSync`, `useAuth` hooks |
| `src/features/sync/store.ts` | Zustand stores for auth/sync state |
| `src/features/sync/syncEngine.ts` | Core sync push/pull logic |
| `src/features/sync/projection.ts` | Local <-> cloud record projection (strip local-only fields) |
| `src/features/sync/dexieHooks.ts` | Dexie hooks to bump `updatedAt` + enqueue ops |
| `src/features/sync/changeTracker.ts` | Track local changes |
| `src/features/sync/schemas.ts` | Zod schemas for validation |
| `src/features/sync/derivedData.ts` | Recalculate achievements, stats, PRs |
| `src/features/sync/useSyncTriggers.ts` | Automatic sync triggers (app open, online, visibility, periodic) |
| `src/features/sync/useDebouncedPush.ts` | Debounced push batching after mutations |
| `src/features/sync/deviceId.ts` | Stable device id for conflict diagnostics |
| `src/features/sync/types.ts` | Sync-specific types |
| `src/features/sync/localRebuild.ts` | Rebuild local-only fields after pull |
| `src/features/sync/queryInvalidation.ts` | React Query invalidation map for pulled collections |
| `src/components/settings/SyncSettings.tsx` | Sync sign-in and status UI |
| `src/components/settings/SyncConflictDialog.tsx` | Conflict resolution UI |
| `src/lib/types/syncable.ts` | Base syncable interface |

### Modified Files

| Path | Changes |
|------|---------|
| `wrangler.jsonc` | Add D1 database binding |
| `worker/index.ts` | Mount auth and sync routes |
| `worker/env.ts` | Add DB binding type |
| `migrations/0001_initial.sql` | Use `user_id` (Google `sub`) as partition key; keep `user_email` as attribute |
| `src/services/db.ts` | No schema version bump; types only (stores unchanged) |
| `src/lib/types/workout.ts` | Add `updatedAt` to `Workout`, `WorkoutTemplate` |
| `src/lib/types/nutrition.ts` | Add `updatedAt` to `FoodItem`, `DailyNutrition`, `MealTemplate` |
| `src/lib/types/bodyweight.ts` | Add `updatedAt` to `WeightEntry` |
| `src/lib/types/settings.ts` | Add `updatedAt` to `UserSettings` |
| `src/lib/types/exercise.ts` | Add `updatedAt` to `Exercise` (custom exercises only) |
| `src/lib/types.ts` | Export `syncable` types |
| `src/components/AppInitializer.tsx` | Register sync Dexie hooks + mount sync triggers after DB health check |
| `src/pages/SettingsPage.tsx` | Add `SyncSettings` component |
| `src/main.tsx` | Wrap with `GoogleOAuthProvider` |
| `package.json` | Add `@react-oauth/google` |
| `src/services/dataExport.ts` | Strip/reset sync metadata on import |
| `tsconfig.app.json` | Include `shared/` in compilation |
| `tsconfig.worker.json` | Include `shared/` in compilation |
| `.env.example` | Add `VITE_GOOGLE_CLIENT_ID` |

---

## 9. Rollback Plan

### If Issues Occur

1. **Frontend rollback**: Revert to pre-sync commit, sync features behind feature flag
2. **Backend rollback**: Worker has instant rollback via Cloudflare dashboard
3. **Data safety**: LWW is deterministic but can overwrite concurrent edits within the same record. Mitigate with explicit confirmations for destructive flows + recommend exporting a local backup before enabling sync.
4. **Feature flag**: Add `VITE_ENABLE_SYNC=false` to disable sync UI entirely

### Environment Variables

#### Frontend (.env.local)

```bash
# Required for Google OAuth (Frontend)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Optional: Feature flag to disable sync UI entirely
VITE_ENABLE_SYNC=true
```

> **Note:** No `VITE_SYNC_API_URL` needed — Worker handles API routes at `/api/*` same-origin.

#### Backend Local (.dev.vars)

For local development of the Cloudflare Worker. Do NOT commit this file.

```bash
# Same as frontend - for token verification
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Random 32+ char string for signing JWTs
JWT_SECRET=your-local-dev-secret-string
```

#### Backend Production (Cloudflare Secrets)

Set these via Cloudflare Dashboard or CLI:

```bash
# Via Cloudflare Dashboard:
# Workers & Pages → your-worker → Settings → Variables → Add variable (encrypted)

# Or via CLI:
wrangler secret put JWT_SECRET
wrangler secret put GOOGLE_CLIENT_ID
```

| Variable | Where | Description |
|----------|-------|-------------|
| `VITE_GOOGLE_CLIENT_ID` | `.env.local` | Google OAuth Client ID (for frontend) |
| `VITE_ENABLE_SYNC` | `.env.local` | Feature flag, default `true` |
| `JWT_SECRET` | Cloudflare Secrets | Random 32+ char string for signing JWTs |
| `GOOGLE_CLIENT_ID` | Cloudflare Secrets | Same as frontend, for token verification |

#### Setup Checklist

1. **Create Google OAuth credentials:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
   - Configure **OAuth consent screen**:
     - Set **Publishing status** to **Testing**
     - Add your allowed accounts under **Test users**
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized origins: `http://localhost:5173`, `https://your-domain.com`
   - Copy Client ID

2. **Generate JWT secret:**
   ```bash
   openssl rand -base64 32
   ```

3. **Set local environment variables:**

   **Create `.env.local` (Frontend):**
   ```bash
   VITE_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
   VITE_ENABLE_SYNC=true
   ```

   **Create `.dev.vars` (Backend):**
   ```bash
   GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
   JWT_SECRET=your-generated-secret-from-step-2
   ```

4. **Set Cloudflare secrets:**
   ```bash
   wrangler secret put JWT_SECRET
   # Paste your generated secret
   
   wrangler secret put GOOGLE_CLIENT_ID  
   # Paste the same Google Client ID
   ```

---

## Appendix: Quick Reference

### Syncable Collections Mapping

```typescript
const COLLECTION_MAP = {
  workoutSessions: 'workouts',
  workoutTemplates: 'templates', 
  foods: 'foods',           // isCustom only
  nutritionLogs: 'nutrition',
  mealTemplates: 'mealTemplates',
  bodyWeight: 'weight',
  settings: 'settings',
  customExercises: 'exercises',   // custom exercises only
} as const
```

### Derived Data (Recalculate, Don't Sync)

- `personalRecords` → Recalculate from `workoutSessions`
- `achievements` → Recalculate from workout/nutrition patterns
- `userStats` → Recalculate from `workoutSessions`
- `streaks` → Recalculate from `workoutSessions`/`nutritionLogs`

---

## Appendix B: Edge Cases & Considerations

### First Sync Flow (New Login with Existing Local Data)

When a user logs in for the first time but already has local data:

```
1. User logs in → receives JWT
2. Lightweight pull (cursor = undefined, limit=1) to determine if cloud is empty
3. If cloud is empty → Push local snapshot (auto)
4. If cloud has data → Show first-time sync dialog (Merge / Use Cloud / Use Local)
5. Pull (paginated) → Apply changes → Recalculate derived data
6. Persist `pullCursor` (from `nextCursor`) and `lastSyncedAtMs` (from `serverTimestampMs`)
```

This preserves local data and avoids silent overwrites when both local and cloud already contain records.

### Token Expiry / Re-auth Strategy

JWTs expire after 90 days. Handle re-auth:

```typescript
// In src/features/sync/hooks.ts
function useTokenExpiryPrompt() {
  const { expiresAtMs, clearAuth } = useAuthStore()
  
  useEffect(() => {
    if (!expiresAtMs) return
    
    const msUntilExpiry = expiresAtMs - Date.now()
    const reauthBufferMs = 7 * 24 * 60 * 60 * 1000 // 7 days before expiry
    
    if (msUntilExpiry < reauthBufferMs) {
      // Token expiring soon - prompt re-login
      toast.info('Please sign in again to continue syncing')
      clearAuth()
    }
  }, [expiresAtMs, clearAuth])
}
```

### Error Handling & Retry Logic

```typescript
// In syncEngine.ts
const MAX_RETRIES = 3
const RETRY_DELAYS = [1000, 5000, 15000] // Exponential backoff

async function syncWithRetry(): Promise<void> {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      await sync()
      return
    } catch (error) {
      if (attempt < MAX_RETRIES - 1) {
        await sleep(RETRY_DELAYS[attempt])
      } else {
        throw error // Final attempt failed
      }
    }
  }
}
```

### Custom Exercises & Foods Filter

Only sync items where `isCustom: true`:

```typescript
// When pushing exercises
const customExercises = await db.customExercises.toArray()

// When pushing foods  
const customFoods = await db.foods
  .filter(f => f.isCustom === true)
  .toArray()
```

### Device ID Generation

For debugging sync conflicts, generate a stable device ID:

```typescript
// src/features/sync/deviceId.ts
const DEVICE_ID_KEY = 'kinetic-device-id'

export function getDeviceId(): string {
  let deviceId = localStorage.getItem(DEVICE_ID_KEY)
  if (!deviceId) {
    deviceId = crypto.randomUUID()
    localStorage.setItem(DEVICE_ID_KEY, deviceId)
  }
  return deviceId
}
```

### Network Status Detection

Trigger sync on network reconnect:

```typescript
// In App.tsx or a dedicated hook
useEffect(() => {
  const handleOnline = () => {
    if (useAuthStore.getState().isAuthenticated) {
      void sync()
    }
  }
  
  window.addEventListener('online', handleOnline)
  return () => window.removeEventListener('online', handleOnline)
}, [])
```

### Whitelist Management

Whitelist is enforced via Google Cloud Console:

1. **OAuth consent screen** → set **Publishing status** to **Testing**
2. Add allowed accounts under **Test users**

Only accounts on the Test users list can complete sign-in and obtain ID tokens for this client.

> If you later move the consent screen to **Production**, the Test users restriction is removed. At that point, add a server-side allowlist (or domain restriction) before inviting broader access.

### TypeScript Config for Worker

> **Note:** `tsconfig.worker.json` was created during Phase 0. No additional setup needed.

The worker TypeScript config extends the base config and adds Workers types:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true
  },
  "include": ["worker/**/*.ts"]
}
```

### Local Development with D1

```bash
# Create local D1 database for dev
wrangler d1 execute kinetic-cloud --local --file=./migrations/0001_initial.sql

# Run dev server (Vite + Cloudflare Workers runtime)
pnpm dev

# The Cloudflare Vite plugin automatically handles D1 bindings in development
```

### Backup / Import Note

Backups (and older local data) may be missing `updatedAt` on sync-scope records. No schema-version migration is required for this plan — run the same one-time `updatedAt` backfill used during first sync enable (see §3.3).

After import, **strip/reset all sync metadata** to avoid replaying stale pending ops or cursors on a different device. This includes pending ops queue, pull cursor, last synced timestamp, auth tokens, and device id. The app should re-auth and run the first-sync flow.
