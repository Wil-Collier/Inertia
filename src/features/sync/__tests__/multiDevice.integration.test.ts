/* eslint-disable no-await-in-loop */
import Dexie, { type Table } from "dexie"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { pushChanges } from "@/features/sync/api"
import { useAuthStore } from "@/features/sync/store"
import type { PushChange, PushRequest } from "@/features/sync/schemas"

type SyncCollection =
  | "workouts"
  | "activeSession"
  | "templates"
  | "foods"
  | "nutrition"
  | "mealTemplates"
  | "weight"
  | "settings"
  | "exercises"

type SyncEvent = {
  version: number
  collection: SyncCollection
  id: string
  data: Record<string, unknown> | null
  deleted: boolean
  baseVersion: number
  mutationId: string
}

class InMemorySyncServer {
  private readonly snapshots = new Map<string, { version: number; data: Record<string, unknown> | null; deleted: boolean }>()
  private readonly events: SyncEvent[] = []
  private readonly mutationIndex = new Map<string, { collection: SyncCollection; id: string; version: number; mutationId: string }>()
  private version = 0

  push(changes: PushChange[]) {
    const conflicts: Array<{ collection: SyncCollection; id: string; serverVersion: number; clientBaseVersion: number; reason: string }> = []
    const acceptedChanges: Array<{ collection: SyncCollection; id: string; version: number; mutationId: string }> = []

    for (const change of changes) {
      const mutationKey = `u1:${change.mutationId}`
      const existingMutation = this.mutationIndex.get(mutationKey)
      if (existingMutation) {
        acceptedChanges.push(existingMutation)
        continue
      }

      const snapshotKey = `${change.collection}:${change.id}`
      const existing = this.snapshots.get(snapshotKey)
      const currentVersion = existing?.version ?? 0
      if (change.baseVersion !== currentVersion) {
        conflicts.push({
          collection: change.collection,
          id: change.id,
          serverVersion: currentVersion,
          clientBaseVersion: change.baseVersion,
          reason: "VERSION_MISMATCH",
        })
        continue
      }

      const nextVersion = ++this.version
      const deleted = change.data === null
      this.events.push({
        version: nextVersion,
        collection: change.collection,
        id: change.id,
        data: change.data,
        deleted,
        baseVersion: change.baseVersion,
        mutationId: change.mutationId,
      })
      this.snapshots.set(snapshotKey, {
        version: nextVersion,
        data: change.data,
        deleted,
      })
      const accepted = {
        collection: change.collection,
        id: change.id,
        version: nextVersion,
        mutationId: change.mutationId,
      }
      this.mutationIndex.set(mutationKey, accepted)
      acceptedChanges.push(accepted)
    }

    return {
      accepted: acceptedChanges.length,
      acceptedChanges,
      conflicts,
    }
  }

  pull(cursorVersion: number, limit: number) {
    const ordered = this.events
      .filter((event) => event.version > cursorVersion)
      .toSorted((a, b) => a.version - b.version)

    const page = ordered.slice(0, limit)
    const hasMore = ordered.length > limit
    const last = page[page.length - 1]
    return {
      changes: page.map((event) => ({
        collection: event.collection,
        id: event.id,
        data: event.data,
        version: event.version,
        deleted: event.deleted,
      })),
      nextCursor: last ? { version: last.version } : null,
      hasMore,
      serverTimestampMs: Date.now(),
    }
  }

  getEventCount() {
    return this.events.length
  }
}

class RefreshSession {
  private currentToken: string
  private previousToken: string | null = null
  private previousValidUntil: number | null = null
  private readonly graceMs: number

  constructor(graceMs = 30_000) {
    this.graceMs = graceMs
    this.currentToken = `rt.${crypto.randomUUID()}`
  }

  getToken() {
    return this.currentToken
  }

  refresh(token: string, now: number) {
    const matchesCurrent = token === this.currentToken
    const matchesPrevious =
      token === this.previousToken &&
      this.previousValidUntil !== null &&
      this.previousValidUntil >= now

    if (!matchesCurrent && !matchesPrevious) {
      return { ok: false as const }
    }

    const next = `rt.${crypto.randomUUID()}`
    this.previousToken = this.currentToken
    this.previousValidUntil = now + this.graceMs
    this.currentToken = next
    return { ok: true as const, token: next }
  }
}

type LocalRecordRow = {
  key: string
  collection: SyncCollection
  id: string
  data: string | null
  deleted: number
}

type PendingRow = {
  collection: SyncCollection
  id: string
  deleted: number
  baseVersion: number
  mutationId: string
  enqueuedAt: number
}

type VersionRow = {
  collection: SyncCollection
  id: string
  version: number
}

type MetaRow = { key: string; value: number }

class DeviceDb extends Dexie {
  localRecords!: Table<LocalRecordRow, string>
  pending!: Table<PendingRow, [SyncCollection, string]>
  versions!: Table<VersionRow, [SyncCollection, string]>
  meta!: Table<MetaRow, string>

  constructor(name: string) {
    super(name)
    this.version(1).stores({
      localRecords: "&key, collection, id",
      pending: "[collection+id], collection, enqueuedAt",
      versions: "[collection+id], collection, version",
      meta: "key",
    })
  }
}

class DeviceClient {
  readonly db: DeviceDb
  constructor(name: string) {
    this.db = new DeviceDb(name)
  }

  async putRecord(collection: SyncCollection, id: string, value: Record<string, unknown>) {
    const key = `${collection}:${id}`
    await this.db.localRecords.put({
      key,
      collection,
      id,
      data: JSON.stringify(value),
      deleted: 0,
    })
    await this.enqueuePending(collection, id, false)
  }

  async deleteRecord(collection: SyncCollection, id: string) {
    const key = `${collection}:${id}`
    await this.db.localRecords.put({
      key,
      collection,
      id,
      data: null,
      deleted: 1,
    })
    await this.enqueuePending(collection, id, true)
  }

  async readRecord(collection: SyncCollection, id: string): Promise<Record<string, unknown> | null> {
    const row = await this.db.localRecords.get(`${collection}:${id}`)
    if (!row || row.deleted === 1 || !row.data) return null
    return parseJsonRecord(row.data)
  }

  async sync(server: InMemorySyncServer, pageSize = 2) {
    const pending = await this.db.pending.orderBy("enqueuedAt").toArray()
    const pushPayload: PushChange[] = pending.map((row) => {
      return {
        collection: row.collection,
        id: row.id,
        data: null,
        baseVersion: row.baseVersion,
        mutationId: row.mutationId,
      } as PushChange & { _recordPromise?: Promise<LocalRecordRow | undefined> }
    })

    for (let i = 0; i < pushPayload.length; i += 1) {
      const row = pending[i]
      if (!row) continue
      if (row.deleted === 1) {
        const payload = pushPayload[i]
        if (payload) payload.data = null
        continue
      }
      const record = await this.db.localRecords.get(`${row.collection}:${row.id}`)
      const payload = pushPayload[i]
      if (!payload) continue
      payload.data = record?.data ? parseJsonRecord(record.data) : null
    }

    const pushResult = server.push(pushPayload)
    for (const accepted of pushResult.acceptedChanges) {
      await this.db.versions.put({
        collection: accepted.collection,
        id: accepted.id,
        version: accepted.version,
      })
      await this.db.pending.delete([accepted.collection, accepted.id])
    }

    for (const conflict of pushResult.conflicts) {
      await this.db.pending.delete([conflict.collection, conflict.id])
    }

    let cursorVersion = (await this.db.meta.get("cursorVersion"))?.value ?? 0
    while (true) {
      const pullResult = server.pull(cursorVersion, pageSize)
      for (const change of pullResult.changes) {
        const key = `${change.collection}:${change.id}`
        if (change.deleted) {
          await this.db.localRecords.put({
            key,
            collection: change.collection,
            id: change.id,
            data: null,
            deleted: 1,
          })
        } else {
          await this.db.localRecords.put({
            key,
            collection: change.collection,
            id: change.id,
            data: JSON.stringify(change.data),
            deleted: 0,
          })
        }
        await this.db.versions.put({
          collection: change.collection,
          id: change.id,
          version: change.version,
        })
      }

      if (pullResult.nextCursor) {
        cursorVersion = pullResult.nextCursor.version
        await this.db.meta.put({ key: "cursorVersion", value: cursorVersion })
      }

      if (!pullResult.hasMore) {
        break
      }
    }

    return pushResult
  }

  async close() {
    this.db.close()
    await Dexie.delete(this.db.name)
  }

  private async enqueuePending(collection: SyncCollection, id: string, deleted: boolean) {
    const existing = await this.db.pending.get([collection, id])
    const version = await this.db.versions.get([collection, id])

    await this.db.pending.put({
      collection,
      id,
      deleted: deleted ? 1 : 0,
      baseVersion: existing?.baseVersion ?? version?.version ?? 0,
      mutationId: crypto.randomUUID(),
      enqueuedAt: Date.now(),
    })
  }
}

describe("multi-device sync integration", () => {
  let server: InMemorySyncServer
  let deviceA: DeviceClient
  let deviceB: DeviceClient

  beforeEach(() => {
    server = new InMemorySyncServer()
    deviceA = new DeviceClient(`deviceA-${crypto.randomUUID()}`)
    deviceB = new DeviceClient(`deviceB-${crypto.randomUUID()}`)
    useAuthStore.setState({
      accessToken: "old-token",
      userId: "u1",
      email: "test@example.com",
      expiresAtMs: Date.now() + 1_000_000,
      isAuthenticated: true,
    })
  })

  afterEach(async () => {
    await deviceA.close()
    await deviceB.close()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("resolves concurrent same-record edits with version mismatch conflict", async () => {
    await deviceA.putRecord("workouts", "w1", { name: "Initial" })
    await deviceA.sync(server)
    await deviceB.sync(server)

    await deviceA.putRecord("workouts", "w1", { name: "Device A value" })
    await deviceB.putRecord("workouts", "w1", { name: "Device B value" })

    const resultA = await deviceA.sync(server)
    const resultB = await deviceB.sync(server)

    expect(resultA.conflicts).toHaveLength(0)
    expect(resultB.conflicts).toHaveLength(1)
    expect(resultB.conflicts[0]?.serverVersion).toBeGreaterThan(resultB.conflicts[0]?.clientBaseVersion ?? -1)
    expect(await deviceB.readRecord("workouts", "w1")).toEqual({ name: "Device A value" })
  })

  it("treats idempotent replay as accepted without duplicating events", () => {
    const change: PushChange = {
      collection: "foods",
      id: "f1",
      data: { name: "Chicken", calories: 100, isCustom: true },
      baseVersion: 0,
      mutationId: "mutation-1",
      deviceId: "device-1",
    }

    const first = server.push([change])
    const second = server.push([change])

    expect(first.acceptedChanges).toHaveLength(1)
    expect(second.acceptedChanges).toHaveLength(1)
    expect(second.acceptedChanges[0]?.version).toBe(first.acceptedChanges[0]?.version)
    expect(server.getEventCount()).toBe(1)
  })

  it("pulls all pages in version order with iterative pagination", async () => {
    for (let i = 0; i < 7; i += 1) {
      server.push([
        {
          collection: "nutrition",
          id: `n${i}`,
          data: { value: i },
          baseVersion: 0,
          mutationId: `m-${i}`,
          deviceId: "device-seed",
        },
      ])
    }

    await deviceA.sync(server, 2)
    const versions = await deviceA.db.versions.orderBy("version").toArray()
    expect(versions).toHaveLength(7)
    expect(versions.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7])
  })

  it("propagates tombstone deletes across devices", async () => {
    await deviceA.putRecord("templates", "t1", { name: "Template 1" })
    await deviceA.sync(server)
    await deviceB.sync(server)
    expect(await deviceB.readRecord("templates", "t1")).toEqual({ name: "Template 1" })

    await deviceA.deleteRecord("templates", "t1")
    await deviceA.sync(server)
    await deviceB.sync(server)
    expect(await deviceB.readRecord("templates", "t1")).toBeNull()
  })

  it("syncs active session state across devices", async () => {
    await deviceA.putRecord("activeSession", "current", {
      workout: {
        id: "w-active",
        name: "In Progress",
        date: "2026-01-01",
        exercises: [],
        weightUnit: "kg",
      },
      startedAt: "2026-01-01T10:00:00.000Z",
    })

    await deviceA.sync(server)
    await deviceB.sync(server)

    expect(await deviceB.readRecord("activeSession", "current")).toEqual({
      workout: {
        id: "w-active",
        name: "In Progress",
        date: "2026-01-01",
        exercises: [],
        weightUnit: "kg",
      },
      startedAt: "2026-01-01T10:00:00.000Z",
    })
  })

  it("converges queued offline changes on reconnect", async () => {
    await deviceA.putRecord("foods", "f-offline", { name: "Rice", calories: 130, isCustom: true })
    await deviceA.putRecord("foods", "f-offline", { name: "Rice (updated)", calories: 140, isCustom: true })

    await deviceA.sync(server)
    await deviceB.sync(server)

    expect(await deviceB.readRecord("foods", "f-offline")).toEqual({
      name: "Rice (updated)",
      calories: 140,
      isCustom: true,
    })
  })

  it("refreshes access token on 401 and retries once", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (url === "/api/sync/push") {
        const auth = init?.headers ? new Headers(init.headers).get("Authorization") : null
        if (auth === "Bearer old-token") {
          return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "expired" }), { status: 401 })
        }
        return new Response(
          JSON.stringify({
            accepted: 1,
            acceptedChanges: [
              { collection: "workouts", id: "w1", version: 1, mutationId: "m1" },
            ],
            conflicts: [],
          }),
          { status: 200 }
        )
      }

      if (url === "/api/auth/refresh") {
        return new Response(
          JSON.stringify({
            accessToken: "new-token",
            userId: "u1",
            email: "u1@example.com",
            expiresAtMs: Date.now() + 60_000,
          }),
          { status: 200 }
        )
      }

      return new Response(JSON.stringify({ error: "NOT_FOUND", message: "Not found" }), { status: 404 })
    })

    vi.stubGlobal("fetch", fetchMock)

    const payload: PushRequest = {
      changes: [
        {
          collection: "workouts",
          id: "w1",
          data: { name: "W1" },
          baseVersion: 0,
          mutationId: "m1",
          deviceId: "d1",
        },
      ],
    }

    const response = await pushChanges("old-token", payload)
    expect(response.accepted).toBe(1)
    expect(useAuthStore.getState().accessToken).toBe("new-token")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("keeps auth state when retry fails with non-401 error", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url
      if (url === "/api/sync/push") {
        const auth = init?.headers ? new Headers(init.headers).get("Authorization") : null
        if (auth === "Bearer old-token") {
          return new Response(JSON.stringify({ error: "UNAUTHORIZED", message: "expired" }), { status: 401 })
        }
        return new Response(JSON.stringify({ error: "SERVER_ERROR", message: "temporary failure" }), { status: 500 })
      }

      if (url === "/api/auth/refresh") {
        return new Response(
          JSON.stringify({
            accessToken: "new-token",
            userId: "u1",
            email: "u1@example.com",
            expiresAtMs: Date.now() + 60_000,
          }),
          { status: 200 }
        )
      }

      return new Response(JSON.stringify({ error: "NOT_FOUND", message: "Not found" }), { status: 404 })
    })

    vi.stubGlobal("fetch", fetchMock)

    const payload: PushRequest = {
      changes: [
        {
          collection: "workouts",
          id: "w1",
          data: { name: "W1" },
          baseVersion: 0,
          mutationId: "m1",
          deviceId: "d1",
        },
      ],
    }

    await expect(pushChanges("old-token", payload)).rejects.toThrow("temporary failure")
    expect(useAuthStore.getState().isAuthenticated).toBe(true)
    expect(useAuthStore.getState().accessToken).toBe("new-token")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("allows refresh rotation race via previous-token grace window", () => {
    const session = new RefreshSession(30_000)
    const oldToken = session.getToken()
    const first = session.refresh(oldToken, 10_000)
    const second = session.refresh(oldToken, 10_010)

    expect(first.ok).toBe(true)
    expect(second.ok).toBe(true)
    if (!first.ok || !second.ok) return
    expect(first.token).not.toBe(second.token)
  })
})

function parseJsonRecord(value: string): Record<string, unknown> {
  const parsed: unknown = JSON.parse(value)
  if (isRecord(parsed)) {
    return parsed
  }
  return {}
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
