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
9. [Testing Strategy](#9-testing-strategy)
10. [Rollback Plan](#10-rollback-plan)

---

## 1. Executive Summary

### Goals
- Enable cloud sync between user devices (phone, tablet, desktop)
- Maintain offline-first PWA experience
- Private "velvet rope" access via email whitelist
- Zero breaking changes to existing functionality

### Tech Stack
| Component | Technology |
|-----------|------------|
| Auth Provider | Google OAuth via `@react-oauth/google` |
| Backend Runtime | Cloudflare Workers |
| Database | Cloudflare D1 (SQLite) |
| Auth Tokens | Stateless JWTs |
| Sync Strategy | Last-Write-Wins (LWW) with timestamps |

### Scope
- **In Scope:** Workouts, templates, nutrition logs, custom foods, body weight, settings
- **Out of Scope:** Achievements, streaks, userStats, personalRecords (derived data - recalculated locally)

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

| Table | Primary Key | Syncable | Notes |
|-------|-------------|----------|-------|
| `exercises` | `id` | ✅ Custom only | Default exercises seeded locally |
| `workoutSessions` | `id` | ✅ | Main user data |
| `workoutTemplates` | `id` | ✅ | User templates |
| `personalRecords` | `exerciseId` | ❌ | Derived from workouts |
| `foods` | `id` | ✅ Custom only | `isCustom: true` foods only |
| `nutritionLogs` | `date` | ✅ | Daily nutrition entries |
| `mealTemplates` | `id` | ✅ | Saved meal combos |
| `settings` | `id` ("settings") | ✅ | Single record |
| `bodyWeight` | `id` | ✅ | Weight entries |
| `achievements` | `id` | ❌ | Derived |
| `userStats` | `id` | ❌ | Derived aggregates |
| `activeSession` | `id` ("current") | ❌ | Ephemeral |
| `restTimer` | `id` | ❌ | Ephemeral |
| `metadata` | `key` | ❌ | App metadata |

### Key Insight: Missing `updatedAt` Field
Current types lack timestamps for sync. Every syncable type needs an `updatedAt: number` field.

---

## 3. Data Model Changes

### 3.1 Add `updatedAt` to All Syncable Types

```typescript
// src/lib/types/syncable.ts (NEW FILE)
export interface Syncable {
  updatedAt: number  // Unix timestamp (ms)
}

export interface SyncableWithId extends Syncable {
  id: string
}
```

### 3.2 Update Existing Types

**workout.ts:**
```typescript
export interface Workout extends SyncableWithId {
  // ... existing fields
  updatedAt: number  // ADD
}

export interface WorkoutTemplate extends SyncableWithId {
  // ... existing fields  
  updatedAt: number  // ADD
}
```

**nutrition.ts:**
```typescript
export interface FoodItem extends SyncableWithId {
  // ... existing fields
  updatedAt: number  // ADD
}

export interface DailyNutrition extends Syncable {
  date: string  // Primary key
  entries: MealEntry[]
  updatedAt: number  // ADD
}
```

**bodyweight.ts:**
```typescript
export interface WeightEntry extends SyncableWithId {
  // ... existing fields
  updatedAt: number  // ADD
}
```

**settings.ts:**
```typescript
export interface UserSettings extends Syncable {
  // ... existing fields
  updatedAt: number  // ADD
}
```

### 3.3 Database Schema Migration (v3)

```typescript
// In db.ts - add version 3
this.version(3).stores({
  // Same schema, just adding updatedAt field
  // No index changes needed
}).upgrade(async (tx) => {
  const now = Date.now()
  
  // Add updatedAt to all existing records
  await tx.table('workoutSessions').toCollection().modify(w => { w.updatedAt = now })
  await tx.table('workoutTemplates').toCollection().modify(t => { t.updatedAt = now })
  await tx.table('foods').toCollection().modify(f => { f.updatedAt = now })
  await tx.table('nutritionLogs').toCollection().modify(n => { n.updatedAt = now })
  await tx.table('mealTemplates').toCollection().modify(m => { m.updatedAt = now })
  await tx.table('bodyWeight').toCollection().modify(w => { w.updatedAt = now })
  await tx.table('settings').toCollection().modify(s => { s.updatedAt = now })
})
```

---

## 4. Backend Implementation

### 4.1 Why Pages Functions (Not Separate Worker)

Since the app already deploys to Cloudflare Pages (`wrangler.toml` with assets), we'll use **Pages Functions** instead of a separate Worker project:

| Aspect | Pages Functions ✅ | Separate Worker ❌ |
|--------|-------------------|-------------------|
| Deployment | Single `wrangler pages deploy` | Two separate deploys |
| Routing | Automatic via `/functions` folder | Manual route config |
| D1 Binding | Same wrangler.toml | Separate wrangler.toml |
| Local Dev | `wrangler pages dev` | Two dev servers |
| CORS | Same origin, no CORS needed | Cross-origin config needed |

### 4.2 Project Structure (Pages Functions)

```
training-app/
├── functions/                    # NEW: Pages Functions directory
│   ├── api/
│   │   ├── auth/
│   │   │   └── login.ts          # POST /api/auth/login
│   │   └── sync/
│   │       ├── push.ts           # POST /api/sync/push
│   │       └── pull.ts           # POST /api/sync/pull
│   ├── _middleware.ts            # Auth middleware for /api/* routes
│   └── lib/
│       ├── jwt.ts                # JWT sign/verify utilities
│       ├── google.ts             # Google ID Token verification
│       └── db.ts                 # D1 query helpers
├── migrations/                   # NEW: D1 migrations
│   └── 0001_initial.sql
├── wrangler.toml                 # UPDATED: Add D1 binding
├── src/                          # Existing frontend code
└── ...
```

### 4.3 Updated wrangler.toml

```toml
name = "training-app"
compatibility_date = "2026-01-10"

[assets]
directory = "./dist"
not_found_handling = "single-page-application"

# D1 Database binding
[[d1_databases]]
binding = "DB"
database_name = "kinetic-cloud"
database_id = "your-database-id-here"  # From `wrangler d1 create kinetic-cloud`

# Environment variables (set via dashboard or wrangler secret)
# JWT_SECRET, GOOGLE_CLIENT_ID are stored as secrets
```

### 4.4 D1 Database Schema

```sql
-- migrations/0001_initial.sql

-- Whitelist for velvet rope access
CREATE TABLE IF NOT EXISTS whitelist (
  email TEXT PRIMARY KEY,
  added_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000),
  added_by TEXT
);

-- Main sync store
CREATE TABLE IF NOT EXISTS sync_store (
  user_email TEXT NOT NULL,
  collection TEXT NOT NULL,
  id TEXT NOT NULL,
  data TEXT NOT NULL,           -- JSON blob
  updated_at INTEGER NOT NULL,  -- Unix timestamp (ms)
  deleted INTEGER DEFAULT 0,    -- Soft delete flag
  device_id TEXT,               -- For debugging conflicts
  PRIMARY KEY (user_email, collection, id)
);

-- Index for efficient pull queries
CREATE INDEX IF NOT EXISTS idx_sync_pull 
  ON sync_store (user_email, updated_at);

-- Audit log (optional but recommended)
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_email TEXT NOT NULL,
  action TEXT NOT NULL,         -- 'push', 'pull', 'login'
  details TEXT,                 -- JSON metadata
  created_at INTEGER NOT NULL DEFAULT (unixepoch() * 1000)
);
```

### 4.5 Pages Functions Type Definitions

```typescript
// functions/lib/types.ts

export interface Env {
  DB: D1Database
  JWT_SECRET: string
  GOOGLE_CLIENT_ID: string
}

export interface AuthenticatedEnv extends Env {
  userEmail: string  // Set by middleware after JWT verification
}
```

### 4.3 Collection Mapping

| Frontend Table | `collection` Value | Notes |
|----------------|-------------------|-------|
| `workoutSessions` | `workouts` | |
| `workoutTemplates` | `templates` | |
| `foods` | `foods` | Only `isCustom: true` |
| `nutritionLogs` | `nutrition` | Key is `date` |
| `mealTemplates` | `mealTemplates` | |
| `bodyWeight` | `weight` | |
| `settings` | `settings` | Single record, id="settings" |
| `exercises` | `exercises` | Only `isCustom: true` |

### 4.4 API Endpoints

#### `POST /auth/login`

```typescript
// Request
interface LoginRequest {
  idToken: string  // Google ID Token
}

// Response (success)
interface LoginResponse {
  accessToken: string   // JWT for API calls
  email: string
  expiresAt: number     // Unix timestamp
}

// Response (error)
interface ErrorResponse {
  error: 'INVALID_TOKEN' | 'NOT_WHITELISTED' | 'SERVER_ERROR'
  message: string
}
```

**Implementation:**
1. Verify Google ID Token via Google's tokeninfo endpoint
2. Extract email from token payload
3. Check email exists in `whitelist` table
4. Generate JWT with 7-day expiry
5. Log to `audit_log`

#### `POST /sync/push`

```typescript
// Request
interface PushRequest {
  changes: Array<{
    collection: string
    id: string
    data: object | null  // null = mark as deleted
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

**Implementation (LWW):**
```sql
INSERT INTO sync_store (user_email, collection, id, data, updated_at, deleted, device_id)
VALUES (?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (user_email, collection, id) DO UPDATE SET
  data = CASE WHEN excluded.updated_at > sync_store.updated_at 
         THEN excluded.data ELSE sync_store.data END,
  updated_at = CASE WHEN excluded.updated_at > sync_store.updated_at 
               THEN excluded.updated_at ELSE sync_store.updated_at END,
  deleted = CASE WHEN excluded.updated_at > sync_store.updated_at 
            THEN excluded.deleted ELSE sync_store.deleted END,
  device_id = CASE WHEN excluded.updated_at > sync_store.updated_at 
              THEN excluded.device_id ELSE sync_store.device_id END
WHERE excluded.updated_at > sync_store.updated_at OR sync_store.updated_at IS NULL;
```

#### `POST /sync/pull`

```typescript
// Request
interface PullRequest {
  lastSyncTimestamp: number
  collections?: string[]  // Optional filter
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
  serverTimestamp: number  // Use as next lastSyncTimestamp
  hasMore: boolean         // For pagination
}
```

**Implementation:**
```sql
SELECT collection, id, data, updated_at, deleted
FROM sync_store
WHERE user_email = ? AND updated_at > ?
ORDER BY updated_at ASC
LIMIT 500;
```

### 4.5 JWT Structure

```typescript
interface JWTPayload {
  sub: string      // User email
  iat: number      // Issued at
  exp: number      // Expiry (90 days)
  iss: 'kinetic-cloud'
}
```

---

## 5. Frontend Implementation

### 5.1 New Dependencies

```bash
pnpm add @react-oauth/google
```

### 5.2 New Files Structure

```
src/
├── features/
│   └── sync/
│       ├── api.ts              # Sync API client
│       ├── hooks.ts            # useSync, useAuth hooks
│       ├── store.ts            # Zustand store for sync state
│       ├── syncEngine.ts       # Core sync logic
│       ├── changeTracker.ts    # Track local changes
│       └── types.ts            # Sync-specific types
├── components/
│   └── settings/
│       └── SyncSettings.tsx    # New: Sync UI in settings
└── lib/
    └── constants.ts            # Add sync-related constants
```

### 5.3 Auth Store (Zustand)

```typescript
// src/features/sync/store.ts
import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  accessToken: string | null
  email: string | null
  expiresAt: number | null
  isAuthenticated: boolean
  
  setAuth: (token: string, email: string, expiresAt: number) => void
  clearAuth: () => void
}

interface SyncState {
  lastSyncAt: number | null
  isSyncing: boolean
  pendingChanges: number
  error: string | null
  
  setSyncing: (syncing: boolean) => void
  setLastSync: (timestamp: number) => void
  setPendingChanges: (count: number) => void
  setError: (error: string | null) => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      email: null,
      expiresAt: null,
      isAuthenticated: false,
      
      setAuth: (accessToken, email, expiresAt) => 
        set({ accessToken, email, expiresAt, isAuthenticated: true }),
      clearAuth: () => 
        set({ accessToken: null, email: null, expiresAt: null, isAuthenticated: false }),
    }),
    { name: 'kinetic-auth' }
  )
)

export const useSyncStore = create<SyncState>()(
  persist(
    (set) => ({
      lastSyncAt: null,
      isSyncing: false,
      pendingChanges: 0,
      error: null,
      
      setSyncing: (isSyncing) => set({ isSyncing }),
      setLastSync: (lastSyncAt) => set({ lastSyncAt, error: null }),
      setPendingChanges: (pendingChanges) => set({ pendingChanges }),
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

// Add new Dexie table for pending changes
// In db.ts, add to schema:
// pendingSyncChanges: 'id, collection, operation, timestamp'

export interface PendingChange {
  id: string           // UUID of the change record
  collection: string
  recordId: string     // ID of the changed record
  operation: 'create' | 'update' | 'delete'
  timestamp: number
  data?: object        // Snapshot for creates/updates
}

export async function trackChange(
  collection: string,
  recordId: string,
  operation: 'create' | 'update' | 'delete',
  data?: object
): Promise<void> {
  await db.pendingSyncChanges.put({
    id: crypto.randomUUID(),
    collection,
    recordId,
    operation,
    timestamp: Date.now(),
    data
  })
}

export async function getPendingChanges(): Promise<PendingChange[]> {
  return db.pendingSyncChanges.orderBy('timestamp').toArray()
}

export async function clearPendingChanges(ids: string[]): Promise<void> {
  await db.pendingSyncChanges.bulkDelete(ids)
}
```

### 5.5 Sync Hook

```typescript
// src/features/sync/hooks.ts
import { useCallback } from 'react'
import { useAuthStore, useSyncStore } from './store'
import { syncEngine } from './syncEngine'
import { useQueryClient } from '@tanstack/react-query'

export function useSync() {
  const queryClient = useQueryClient()
  const { isAuthenticated, accessToken } = useAuthStore()
  const { isSyncing, lastSyncAt, pendingChanges, error, setSyncing, setLastSync, setError } = useSyncStore()

  const sync = useCallback(async () => {
    if (!isAuthenticated || !accessToken || isSyncing) return

    try {
      setSyncing(true)
      setError(null)

      // Push local changes
      await syncEngine.push(accessToken)

      // Pull remote changes
      const pulledChanges = await syncEngine.pull(accessToken, lastSyncAt ?? 0)

      // Apply changes to local DB
      await syncEngine.applyChanges(pulledChanges)

      // Update sync timestamp
      setLastSync(Date.now())

      // Invalidate affected queries
      queryClient.invalidateQueries({ queryKey: ['workouts'] })
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      queryClient.invalidateQueries({ queryKey: ['nutrition'] })
      queryClient.invalidateQueries({ queryKey: ['foods'] })
      queryClient.invalidateQueries({ queryKey: ['bodyWeight'] })
      queryClient.invalidateQueries({ queryKey: ['settings'] })

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sync failed')
      throw err
    } finally {
      setSyncing(false)
    }
  }, [isAuthenticated, accessToken, isSyncing, lastSyncAt, queryClient])

  return {
    sync,
    isSyncing,
    lastSyncAt,
    pendingChanges,
    error,
    isAuthenticated,
  }
}
```

### 5.6 Google OAuth Integration

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

### 5.7 Sync Settings UI

```typescript
// src/components/settings/SyncSettings.tsx
export function SyncSettings() {
  const { sync, isSyncing, lastSyncAt, isAuthenticated, error } = useSync()
  const { email, clearAuth } = useAuthStore()
  const login = useGoogleLogin({
    onSuccess: async (response) => {
      // Exchange for our JWT via /auth/login
      const result = await syncApi.login(response.credential)
      useAuthStore.getState().setAuth(result.accessToken, result.email, result.expiresAt)
    }
  })

  if (!isAuthenticated) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Kinetic Cloud</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            Sign in to sync your data across devices.
          </p>
          <Button onClick={() => login()} className="w-full">
            <Cloud className="mr-2 h-4 w-4" />
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Kinetic Cloud</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-sm">{email}</span>
          <Button variant="ghost" size="sm" onClick={clearAuth}>
            Sign Out
          </Button>
        </div>
        
        {lastSyncAt && (
          <p className="text-xs text-muted-foreground">
            Last synced: {formatDistanceToNow(lastSyncAt)} ago
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

### 6.1 Sync Triggers

| Trigger | Behavior | When |
|---------|----------|------|
| App opens | Pull in background | Once per session |
| Network reconnects | Pull + push pending | `online` event |
| After local mutation | Queue change, debounce push | 5 seconds after last change |
| Tab becomes visible | Pull if stale (>1 min) | `visibilitychange` event |
| Manual "Sync Now" | Immediate push + pull | User clicks button |
| Before app close | Best-effort push | `beforeunload` event |
| Periodic (optional) | Pull in background | Every 5 minutes |

#### Implementation: Sync Triggers Hook

```typescript
// src/features/sync/useSyncTriggers.ts
import { useEffect, useRef } from 'react'
import { useSync } from './hooks'
import { useAuthStore } from './store'
import { useDebouncedCallback } from '@/hooks/useDebouncedValue'

const STALE_THRESHOLD_MS = 60 * 1000  // 1 minute
const PERIODIC_SYNC_MS = 5 * 60 * 1000  // 5 minutes
const DEBOUNCE_PUSH_MS = 5 * 1000  // 5 seconds

export function useSyncTriggers() {
  const { sync, pushOnly, lastSyncAt, isAuthenticated } = useSync()
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
        const isStale = !lastSyncAt || (Date.now() - lastSyncAt > STALE_THRESHOLD_MS)
        if (isStale) {
          console.log('[Sync] Tab visible and stale, pulling...')
          void sync()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [isAuthenticated, lastSyncAt, sync])

  // 4. Best-effort push before app close
  useEffect(() => {
    if (!isAuthenticated) return

    const handleBeforeUnload = () => {
      // Use sendBeacon for reliable delivery on page close
      // This is a simplified version - actual implementation
      // would need to serialize pending changes
      navigator.sendBeacon?.('/api/sync/push', JSON.stringify({
        // pending changes
      }))
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [isAuthenticated])

  // 5. Optional: Periodic sync (every 5 minutes)
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
import { useAuthStore, useSyncStore } from './store'

const DEBOUNCE_MS = 5000

export function useDebouncedPush() {
  const { pushOnly, isAuthenticated } = useSync()
  const { pendingChanges } = useSyncStore()
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Debounced push function
  const debouncedPush = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }

    timeoutRef.current = setTimeout(() => {
      if (pendingChanges > 0) {
        console.log(`[Sync] Debounced push: ${pendingChanges} changes`)
        void pushOnly()
      }
    }, DEBOUNCE_MS)
  }, [pendingChanges, pushOnly])

  // Trigger debounced push when pending changes increase
  useEffect(() => {
    if (isAuthenticated && pendingChanges > 0) {
      debouncedPush()
    }

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [isAuthenticated, pendingChanges, debouncedPush])
}
```

#### Implementation: Updated useSync Hook

Add `pushOnly` function for debounced pushes:

```typescript
// In src/features/sync/hooks.ts - add pushOnly
export function useSync() {
  // ... existing code ...

  const pushOnly = useCallback(async () => {
    if (!isAuthenticated || !accessToken || isSyncing) return

    try {
      setSyncing(true)
      await syncEngine.push(accessToken)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Push failed')
    } finally {
      setSyncing(false)
    }
  }, [isAuthenticated, accessToken, isSyncing])

  return {
    sync,
    pushOnly,  // NEW
    isSyncing,
    lastSyncAt,
    pendingChanges,
    error,
    isAuthenticated,
  }
}
```

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
│  [Create Workout] ──► trackChange() ──► pendingChanges++        │
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
│  [Before Close] ──────────────────────► sendBeacon (best-effort)│
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 6.2 Mutation Integration Pattern

Update all mutations to track changes:

```typescript
// Example: useCreateWorkout modification
export function useCreateWorkout() {
  const queryClient = useQueryClient()
  const { isAuthenticated } = useAuthStore()
  
  return useMutation({
    mutationFn: async (workout: Omit<Workout, "id">) => {
      const id = crypto.randomUUID()
      const updatedAt = Date.now()  // ADD: timestamp
      
      const newWorkout: Workout = { 
        ...workout, 
        id, 
        exerciseIds: workout.exercises.map(e => e.exerciseId),
        updatedAt  // ADD
      }
      
      await db.workoutSessions.add(newWorkout)
      
      // Track change for sync (if authenticated)
      if (isAuthenticated) {
        await trackChange('workouts', id, 'create', newWorkout)
      }
      
      // ... rest of mutation
      return newWorkout
    },
    // ...
  })
}
```

### 6.3 Conflict Resolution (LWW)

```typescript
// In syncEngine.applyChanges
async function applyChanges(changes: SyncChange[]): Promise<void> {
  for (const change of changes) {
    const localRecord = await getLocalRecord(change.collection, change.id)
    
    // LWW: Only apply if remote is newer
    if (!localRecord || change.updatedAt > localRecord.updatedAt) {
      if (change.deleted) {
        await deleteLocalRecord(change.collection, change.id)
      } else {
        await upsertLocalRecord(change.collection, change.id, change.data)
      }
    }
  }
}
```

### 6.4 Derived Data Recalculation

Derived data (`userStats`, `personalRecords`, `achievements`, `streaks`) is **not synced** but must be recalculated after pulling changes that affect source data.

#### When Recalculation Happens

| Trigger | What Gets Recalculated |
|---------|----------------------|
| Sync pulls new/updated workouts | `userStats`, `personalRecords`, `streaks`, workout `achievements` |
| Sync pulls deleted workouts | `userStats`, `personalRecords`, `streaks` |
| Sync pulls nutrition changes | Nutrition `streaks`, nutrition `achievements` |
| Initial sync (first login) | All derived data (full recalculation) |

#### Implementation

```typescript
// src/features/sync/syncEngine.ts

import { statsService } from '@/services/statsService'
import { achievementService } from '@/services/achievementService'
import { db } from '@/services/db'

/**
 * Recalculate derived data after sync pulls changes.
 * Uses existing services that already handle these calculations.
 */
async function recalculateDerivedData(
  affectedCollections: Set<string>
): Promise<void> {
  const affectsWorkouts = affectedCollections.has('workouts')
  const affectsNutrition = affectedCollections.has('nutrition')

  if (affectsWorkouts) {
    // 1. Recalculate userStats from scratch
    //    This is necessary because we may have received workouts
    //    from another device that change total volume/count
    await recalculateUserStats()

    // 2. Recalculate personal records
    //    New workouts may contain new PRs
    await recalculatePersonalRecords()

    // 3. Recalculate workout streaks
    await achievementService.recalculateStreaks()

    // 4. Check workout achievements (uses cached stats, O(1))
    await achievementService.checkWorkoutAchievements()
  }

  if (affectsNutrition) {
    // Recalculate nutrition streaks
    await achievementService.recalculateNutritionStreak()
    
    // Check nutrition-related achievements
    await achievementService.checkNutritionAchievements()
  }
}

/**
 * Full recalculation of userStats from all workouts.
 * Only called after sync, not during normal app usage.
 */
async function recalculateUserStats(): Promise<void> {
  let totalVolumeLbs = 0
  let totalWorkouts = 0

  await db.workoutSessions.each((workout) => {
    totalWorkouts++
    const rawVolume = workout.exercises.reduce((exTotal, ex) => {
      return exTotal + ex.sets
        .filter(s => s.isCompleted)
        .reduce((setTotal, set) => setTotal + set.weight * set.reps, 0)
    }, 0)
    const conversionFactor = workout.weightUnit === 'kg' ? 2.20462 : 1
    totalVolumeLbs += rawVolume * conversionFactor
  })

  await db.userStats.put({
    id: 'stats',
    totalWorkouts,
    totalVolumeLbs,
    lastUpdated: new Date().toISOString(),
  })
}

/**
 * Recalculate all personal records from workout history.
 * Clears existing PRs and rebuilds from scratch.
 */
async function recalculatePersonalRecords(): Promise<void> {
  // Clear existing PRs
  await db.personalRecords.clear()

  // Map to track best E1RM per exercise
  const bestByExercise = new Map<string, {
    weight: number
    reps: number
    date: string
    workoutId: string
    e1rm: number
  }>()

  await db.workoutSessions.each((workout) => {
    for (const exercise of workout.exercises) {
      for (const set of exercise.sets) {
        if (!set.isCompleted || set.weight === 0 || set.reps === 0) continue

        const e1rm = estimateOneRepMax(set.weight, set.reps)
        const existing = bestByExercise.get(exercise.exerciseId)

        if (!existing || e1rm > existing.e1rm) {
          bestByExercise.set(exercise.exerciseId, {
            weight: set.weight,
            reps: set.reps,
            date: workout.date,
            workoutId: workout.id,
            e1rm,
          })
        }
      }
    }
  })

  // Bulk insert all PRs
  const prs = Array.from(bestByExercise.entries()).map(([exerciseId, data]) => ({
    exerciseId,
    weight: data.weight,
    reps: data.reps,
    date: data.date,
    workoutId: data.workoutId,
  }))

  await db.personalRecords.bulkAdd(prs)
}

function estimateOneRepMax(weight: number, reps: number): number {
  if (reps === 0 || weight === 0) return 0
  if (reps === 1) return weight
  if (reps >= 13) return weight * (1 + reps / 30)
  return weight * (36 / (37 - reps))
}
```

#### Integration with Sync Flow

The recalculation is triggered in `applyChanges` after all pulled changes are written:

```typescript
// In syncEngine.applyChanges (updated)
async function applyChanges(changes: SyncChange[]): Promise<void> {
  const affectedCollections = new Set<string>()

  for (const change of changes) {
    const localRecord = await getLocalRecord(change.collection, change.id)
    
    // LWW: Only apply if remote is newer
    if (!localRecord || change.updatedAt > localRecord.updatedAt) {
      affectedCollections.add(change.collection)  // Track what changed
      
      if (change.deleted) {
        await deleteLocalRecord(change.collection, change.id)
      } else {
        await upsertLocalRecord(change.collection, change.id, change.data)
      }
    }
  }

  // Recalculate derived data based on what changed
  if (affectedCollections.size > 0) {
    await recalculateDerivedData(affectedCollections)
  }
}
```

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

### Phase 1: Schema Migration (3-4 hours)
- [ ] Add `updatedAt` field to all syncable types
- [ ] Create Dexie schema v3 migration
- [ ] Update all mutations to set `updatedAt`
- [ ] Add `pendingSyncChanges` table to Dexie
- [ ] Update `backupMigrations.ts` for new schema

### Phase 2: Backend Foundation (1-2 days)
- [ ] Create `functions/` directory structure
- [ ] Create D1 database: `wrangler d1 create kinetic-cloud`
- [ ] Apply migrations: `wrangler d1 execute kinetic-cloud --file=./migrations/0001_initial.sql`
- [ ] Implement `functions/api/auth/login.ts` endpoint
- [ ] Implement Google ID Token verification in `functions/lib/google.ts`
- [ ] Implement JWT utilities in `functions/lib/jwt.ts`
- [ ] Implement `functions/api/sync/push.ts` endpoint
- [ ] Implement `functions/api/sync/pull.ts` endpoint
- [ ] Add auth middleware `functions/_middleware.ts`
- [ ] Test locally with `wrangler pages dev`
- [ ] Deploy with `wrangler pages deploy dist`

### Phase 3: Frontend Auth (4-6 hours)
- [ ] Install `@react-oauth/google`
- [ ] Create auth Zustand store
- [ ] Create sync Zustand store
- [ ] Add `GoogleOAuthProvider` to app
- [ ] Create `SyncSettings` component
- [ ] Add to Settings page
- [ ] Handle token expiry/refresh

### Phase 4: Sync Engine (1-2 days)
- [ ] Create sync API client
- [ ] Implement change tracker
- [ ] Implement push logic
- [ ] Implement pull logic
- [ ] Implement LWW conflict resolution
- [ ] Wire up sync triggers (app open, network)
- [ ] Update mutations to track changes

### Phase 5: Polish & Testing (1 day)
- [ ] Add sync status indicator in header
- [ ] Add visual feedback for sync success/failure
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
| `functions/api/auth/login.ts` | POST /api/auth/login endpoint |
| `functions/api/sync/push.ts` | POST /api/sync/push endpoint |
| `functions/api/sync/pull.ts` | POST /api/sync/pull endpoint |
| `functions/_middleware.ts` | JWT auth middleware for /api/* routes |
| `functions/lib/jwt.ts` | JWT sign/verify utilities |
| `functions/lib/google.ts` | Google ID Token verification |
| `functions/lib/db.ts` | D1 query helpers |
| `functions/lib/types.ts` | Env and request types |
| `migrations/0001_initial.sql` | D1 database schema |
| `src/features/sync/api.ts` | API client for sync endpoints |
| `src/features/sync/hooks.ts` | `useSync`, `useAuth` hooks |
| `src/features/sync/store.ts` | Zustand stores for auth/sync state |
| `src/features/sync/syncEngine.ts` | Core sync push/pull logic |
| `src/features/sync/changeTracker.ts` | Track local changes |
| `src/features/sync/types.ts` | Sync-specific types |
| `src/components/settings/SyncSettings.tsx` | Sync UI |
| `src/lib/types/syncable.ts` | Base syncable interface |

### Modified Files

| Path | Changes |
|------|---------|
| `wrangler.toml` | Add D1 database binding |
| `src/services/db.ts` | Add schema v3, `pendingSyncChanges` table |
| `src/lib/types/workout.ts` | Add `updatedAt` to `Workout`, `WorkoutTemplate` |
| `src/lib/types/nutrition.ts` | Add `updatedAt` to `FoodItem`, `DailyNutrition` |
| `src/lib/types/bodyweight.ts` | Add `updatedAt` to `WeightEntry` |
| `src/lib/types/settings.ts` | Add `updatedAt` to `UserSettings` |
| `src/lib/types.ts` | Export `syncable` types |
| `src/features/workout/mutations.ts` | Add `updatedAt`, track changes |
| `src/features/nutrition/mutations.ts` | Add `updatedAt`, track changes |
| `src/features/bodyweight/mutations.ts` | Add `updatedAt`, track changes |
| `src/features/settings/mutations.ts` | Add `updatedAt`, track changes |
| `src/pages/SettingsPage.tsx` | Add `SyncSettings` component |
| `src/main.tsx` | Wrap with `GoogleOAuthProvider` |
| `src/services/backupMigrations.ts` | Handle schema v3 in backups |
| `package.json` | Add `@react-oauth/google` |
| `.env.example` | Add `VITE_GOOGLE_CLIENT_ID` |

---

## 9. Testing Strategy

### Unit Tests
- JWT generation/verification
- LWW conflict resolution logic
- Change tracker operations

### Integration Tests
- Full push/pull cycle
- Auth flow (login, logout, token expiry)
- Schema migration (v2 → v3)

### Manual Testing Scenarios

| Scenario | Steps | Expected |
|----------|-------|----------|
| Initial sync | Login → first sync | All local data pushed |
| Multi-device | Create workout on device A → sync on B | Workout appears on B |
| Offline edit | Go offline → edit → go online → sync | Changes pushed on reconnect |
| Conflict | Edit same workout on A and B offline → both sync | LWW: latest wins |
| Delete sync | Delete workout on A → sync on B | Workout marked deleted on B |

---

## 10. Rollback Plan

### If Issues Occur

1. **Frontend rollback**: Revert to pre-sync commit, sync features behind feature flag
2. **Backend rollback**: Worker has instant rollback via Cloudflare dashboard
3. **Data safety**: All sync is additive (LWW), no data loss possible
4. **Feature flag**: Add `VITE_ENABLE_SYNC=false` to disable sync UI entirely

### Environment Variables

#### Frontend (.env.local)

```bash
# Required for Google OAuth
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# Optional: Feature flag to disable sync UI entirely
VITE_ENABLE_SYNC=true
```

> **Note:** No `VITE_SYNC_API_URL` needed — Pages Functions are same-origin at `/api/*`

#### Backend (Cloudflare Secrets)

Set these via Cloudflare Dashboard or CLI:

```bash
# Via Cloudflare Dashboard:
# Pages → Settings → Environment variables → Add variable (encrypted)

# Or via CLI:
wrangler pages secret put JWT_SECRET
wrangler pages secret put GOOGLE_CLIENT_ID
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
   - Create OAuth 2.0 Client ID (Web application)
   - Add authorized origins: `http://localhost:5173`, `https://your-domain.pages.dev`
   - Copy Client ID

2. **Generate JWT secret:**
   ```bash
   openssl rand -base64 32
   ```

3. **Set local env (create `.env.local`):**
   ```bash
   VITE_GOOGLE_CLIENT_ID=123456789.apps.googleusercontent.com
   VITE_ENABLE_SYNC=true
   ```

4. **Set Cloudflare secrets:**
   ```bash
   wrangler pages secret put JWT_SECRET
   # Paste your generated secret
   
   wrangler pages secret put GOOGLE_CLIENT_ID  
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
  exercises: 'exercises',   // isCustom only
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
2. Push ALL local data to server (lastSyncTimestamp = 0)
3. Pull from server (will return empty or same data)
4. Set lastSyncTimestamp = now
```

This ensures local data is preserved and pushed to cloud on first login.

### Token Refresh Strategy

JWTs expire after 90 days. Handle refresh:

```typescript
// In src/features/sync/hooks.ts
function useTokenRefresh() {
  const { expiresAt, clearAuth } = useAuthStore()
  
  useEffect(() => {
    if (!expiresAt) return
    
    const msUntilExpiry = expiresAt - Date.now()
    const refreshBuffer = 7 * 24 * 60 * 60 * 1000 // 7 days before expiry
    
    if (msUntilExpiry < refreshBuffer) {
      // Token expiring soon - prompt re-login
      // Or: silently refresh using Google's refresh token
      toast.info('Please sign in again to continue syncing')
      clearAuth()
    }
  }, [expiresAt])
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
const customExercises = await db.exercises
  .filter(e => e.isCustom === true)
  .toArray()

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

Add users to the whitelist via D1 console or a simple script:

```bash
# Add a user to whitelist
wrangler d1 execute kinetic-cloud --command \
  "INSERT INTO whitelist (email) VALUES ('user@example.com')"

# List all whitelisted users
wrangler d1 execute kinetic-cloud --command \
  "SELECT * FROM whitelist"
```

### TypeScript Config for Functions

Create `functions/tsconfig.json` for Workers types:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "types": ["@cloudflare/workers-types"],
    "strict": true,
    "noEmit": true
  },
  "include": ["./**/*.ts"]
}
```

Install the types:
```bash
pnpm add -D @cloudflare/workers-types
```

### Local Development with D1

```bash
# Create local D1 database for dev
wrangler d1 execute kinetic-cloud --local --file=./migrations/0001_initial.sql

# Run Pages dev server with D1
wrangler pages dev dist --d1=DB=kinetic-cloud

# Or with Vite (requires building first)
pnpm build && wrangler pages dev dist --d1=DB=kinetic-cloud
```

### Backup Migrations Update

Add schema v3 handling to `backupMigrations.ts`:

```typescript
// Add to MIGRATIONS array
const v2ToV3: MigrationFn = (data) => {
  const now = Date.now()
  
  // Add updatedAt to all tables that need it
  for (const table of data.data.data) {
    if (['workoutSessions', 'workoutTemplates', 'foods', 
         'nutritionLogs', 'mealTemplates', 'bodyWeight', 'settings'].includes(table.tableName)) {
      for (const row of table.rows) {
        if (!row.updatedAt) {
          row.updatedAt = now
        }
      }
    }
  }
  
  return data
}

// Update MIGRATIONS map
const MIGRATIONS: Record<number, MigrationFn> = {
  1: v1ToV2,
  2: v2ToV3,  // NEW
}
```
