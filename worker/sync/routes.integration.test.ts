import { beforeEach, describe, expect, it } from "vitest"
import { sign } from "hono/jwt"
import app from "../index"

type SyncEvent = {
  version: number
  user_id: string
  user_email: string
  collection: string
  id: string
  data: string | null
  deleted: number
  base_version: number
  mutation_id: string
  device_id: string | null
  created_at: number
}

type SyncStoreRow = {
  user_id: string
  user_email: string
  collection: string
  id: string
  data: string | null
  deleted: number
  record_version: number
  updated_at: number
  mutation_id: string
  device_id: string | null
}

class FakePrepared {
  private args: unknown[] = []
  private readonly db: FakeD1
  private readonly sql: string

  constructor(db: FakeD1, sql: string) {
    this.db = db
    this.sql = sql
  }

  bind(...args: unknown[]) {
    this.args = args
    return this
  }

  async run() {
    const sql = this.sql

    if (sql.includes("INSERT INTO sync_events")) {
      const userId = this.readString(0)
      const userEmail = this.readString(1)
      const collection = this.readString(2)
      const id = this.readString(3)
      const data = this.readNullableString(4)
      const deleted = this.readNumber(5)
      const baseVersion = this.readNumber(6)
      const mutationId = this.readString(7)
      const deviceId = this.readNullableString(8)
      const createdAt = this.readNumber(9)

      const existingMutation = this.db.syncEvents.find(
        (event) => event.user_id === userId && event.mutation_id === mutationId
      )
      if (existingMutation) {
        throw new Error("UNIQUE constraint failed: idx_sync_events_user_mutation")
      }

      const currentStore = this.db.syncStore.find(
        (row) => row.user_id === userId && row.collection === collection && row.id === id
      )
      const currentVersion = currentStore?.record_version ?? 0
      if (baseVersion !== currentVersion) {
        throw new Error("UNIQUE constraint failed: idx_sync_events_user_record_base_version")
      }

      this.db.nextVersion += 1
      const version = this.db.nextVersion
      this.db.syncEvents.push({
        version,
        user_id: userId,
        user_email: userEmail,
        collection,
        id,
        data,
        deleted,
        base_version: baseVersion,
        mutation_id: mutationId,
        device_id: deviceId,
        created_at: createdAt,
      })

      if (this.db.insertWithoutLastRowId) {
        return {
          success: true,
          meta: {},
        }
      }

      return {
        success: true,
        meta: {
          last_row_id: version,
        },
      }
    }

    if (sql.includes("INSERT INTO sync_store")) {
      const userId = this.readString(0)
      const userEmail = this.readString(1)
      const collection = this.readString(2)
      const id = this.readString(3)
      const data = this.readNullableString(4)
      const deleted = this.readNumber(5)
      const recordVersion = this.readNumber(6)
      const updatedAt = this.readNumber(7)
      const mutationId = this.readString(8)
      const deviceId = this.readNullableString(9)

      const existingIndex = this.db.syncStore.findIndex(
        (row) => row.user_id === userId && row.collection === collection && row.id === id
      )

      const nextRow: SyncStoreRow = {
        user_id: userId,
        user_email: userEmail,
        collection,
        id,
        data,
        deleted,
        record_version: recordVersion,
        updated_at: updatedAt,
        mutation_id: mutationId,
        device_id: deviceId,
      }

      if (existingIndex >= 0) {
        this.db.syncStore[existingIndex] = nextRow
      } else {
        this.db.syncStore.push(nextRow)
      }

      return { success: true }
    }

    if (sql.includes("INSERT INTO audit_log")) {
      this.db.auditCount += 1
      return { success: true }
    }

    return { success: true }
  }

  async first() {
    const sql = this.sql

    if (sql.includes("FROM sync_events") && sql.includes("mutation_id = ?")) {
      const userId = this.readString(0)
      const mutationId = this.readString(1)

      if (this.db.ignoreMutationLookupOnce.has(mutationId)) {
        this.db.ignoreMutationLookupOnce.delete(mutationId)
        return null
      }

      const row = this.db.syncEvents.find(
        (event) => event.user_id === userId && event.mutation_id === mutationId
      )
      if (!row) return null

      if (sql.includes("SELECT version FROM sync_events")) {
        return { version: row.version }
      }

      return {
        version: row.version,
        collection: row.collection,
        id: row.id,
        data: row.data,
        deleted: row.deleted,
        mutation_id: row.mutation_id,
        device_id: row.device_id,
        created_at: row.created_at,
      }
    }

    if (sql.includes("FROM sync_store")) {
      const userId = this.readString(0)
      const collection = this.readString(1)
      const id = this.readString(2)
      const row = this.db.syncStore.find(
        (record) => record.user_id === userId && record.collection === collection && record.id === id
      )
      if (!row) return null
      return { record_version: row.record_version }
    }

    return null
  }

  async all() {
    const sql = this.sql
    if (!sql.includes("FROM sync_events")) {
      return { results: [] }
    }

    const userId = this.readString(0)
    const cursorVersion = this.readNumber(1)
    const hasCollectionFilter = sql.includes("collection IN (")
    let argIndex = 2

    let collections: string[] | null = null
    if (hasCollectionFilter) {
      const inClauseMatch = sql.match(/collection IN \(([^)]+)\)/)
      const count = inClauseMatch?.[1]?.split(",").length ?? 0
      collections = []
      for (let i = 0; i < count; i += 1) {
        collections.push(this.readString(argIndex + i))
      }
      argIndex += count
    }

    const limit = this.readNumber(argIndex)

    const rows = this.db.syncEvents
      .filter((event) => event.user_id === userId && event.version > cursorVersion)
      .filter((event) => (collections ? collections.includes(event.collection) : true))
      .toSorted((a, b) => a.version - b.version)
      .slice(0, limit)
      .map((event) => ({
        version: event.version,
        collection: event.collection,
        id: event.id,
        data: event.data,
        deleted: event.deleted,
      }))

    return { results: rows }
  }

  private readString(index: number): string {
    const value = this.args[index]
    if (typeof value !== "string") {
      throw new TypeError(`Expected string arg at ${index}`)
    }
    return value
  }

  private readNullableString(index: number): string | null {
    const value = this.args[index]
    if (value === null) return null
    if (typeof value !== "string") {
      throw new TypeError(`Expected nullable string arg at ${index}`)
    }
    return value
  }

  private readNumber(index: number): number {
    const value = this.args[index]
    if (typeof value !== "number") {
      throw new TypeError(`Expected number arg at ${index}`)
    }
    return value
  }
}

class FakeD1 {
  syncEvents: SyncEvent[] = []
  syncStore: SyncStoreRow[] = []
  nextVersion = 0
  auditCount = 0
  insertWithoutLastRowId = false
  ignoreMutationLookupOnce = new Set<string>()

  prepare(sql: string) {
    return new FakePrepared(this, sql)
  }

  seedStore(row: SyncStoreRow) {
    this.syncStore.push(row)
  }

  seedEvent(row: Omit<SyncEvent, "version"> & { version?: number }) {
    const version = row.version ?? this.nextVersion + 1
    this.nextVersion = Math.max(this.nextVersion, version)
    this.syncEvents.push({ ...row, version })
  }

  forceInsertRowIdFallback() {
    this.insertWithoutLastRowId = true
  }

  forceOneLookupMissForMutation(mutationId: string) {
    this.ignoreMutationLookupOnce.add(mutationId)
  }
}

function createEnv(db: FakeD1) {
  return {
    DB: db,
    JWT_SECRET: "test-secret",
    GOOGLE_CLIENT_ID: "google-client-id",
  }
}

async function createToken() {
  return await sign(
    {
      sub: "u1",
      email: "u1@example.com",
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 300,
    },
    "test-secret",
    "HS256"
  )
}

async function requestSync(db: FakeD1, path: string, body: unknown) {
  const token = await createToken()
  return await app.request(
    path,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    },
    createEnv(db)
  )
}

function readJson(response: Response): Promise<unknown> {
  return response.json()
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function readNumber(value: unknown, key: string): number {
  if (!isRecord(value)) {
    throw new TypeError(`Expected number at ${key}`)
  }
  const field = value[key]
  if (typeof field !== "number") {
    throw new TypeError(`Expected number at ${key}`)
  }
  return field
}

function readArray(value: unknown, key: string): unknown[] {
  if (!isRecord(value) || !Array.isArray(value[key])) {
    throw new TypeError(`Expected array at ${key}`)
  }
  return value[key]
}

function readObject(value: unknown, key: string): Record<string, unknown> {
  if (!isRecord(value) || !isRecord(value[key])) {
    throw new TypeError(`Expected object at ${key}`)
  }
  return value[key]
}

describe("sync routes integration", () => {
  let db: FakeD1

  beforeEach(() => {
    db = new FakeD1()
  })

  it("returns 400 for invalid push payload", async () => {
    const response = await requestSync(db, "/api/sync/push", { changes: [{ id: "missing-collection" }] })
    const body = await readJson(response)

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "INVALID_REQUEST", message: "Invalid push payload" })
  })

  it("returns 400 for invalid pull payload", async () => {
    const response = await requestSync(db, "/api/sync/pull", { cursor: { bad: true } })
    const body = await readJson(response)

    expect(response.status).toBe(400)
    expect(body).toEqual({ error: "INVALID_REQUEST", message: "Invalid pull payload" })
  })

  it("accepts valid push changes and writes sync event/store", async () => {
    const response = await requestSync(db, "/api/sync/push", {
      changes: [
        {
          collection: "foods",
          id: "food-1",
          data: { id: "food-1", name: "Rice" },
          baseVersion: 0,
          mutationId: "m1",
          deviceId: "device-a",
        },
      ],
    })

    const body = await readJson(response)
    const accepted = readNumber(body, "accepted")
    const conflicts = readArray(body, "conflicts")
    const acceptedChanges = readArray(body, "acceptedChanges")

    expect(response.status).toBe(200)
    expect(accepted).toBe(1)
    expect(conflicts).toEqual([])
    expect(acceptedChanges[0]).toMatchObject({ collection: "foods", id: "food-1", mutationId: "m1" })

    expect(db.syncEvents).toHaveLength(1)
    expect(db.syncStore).toHaveLength(1)
    expect(db.syncStore[0]).toMatchObject({
      collection: "foods",
      id: "food-1",
      record_version: 1,
      mutation_id: "m1",
      device_id: "device-a",
    })
  })

  it("returns version-mismatch conflict when baseVersion is stale", async () => {
    db.seedStore({
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-1",
      data: JSON.stringify({ id: "food-1" }),
      deleted: 0,
      record_version: 4,
      updated_at: Date.now(),
      mutation_id: "m-existing",
      device_id: null,
    })

    const response = await requestSync(db, "/api/sync/push", {
      changes: [
        {
          collection: "foods",
          id: "food-1",
          data: { id: "food-1", name: "Rice" },
          baseVersion: 2,
          mutationId: "m-stale",
        },
      ],
    })

    const body = await readJson(response)
    const accepted = readNumber(body, "accepted")
    const conflicts = readArray(body, "conflicts")

    expect(response.status).toBe(200)
    expect(accepted).toBe(0)
    expect(conflicts).toEqual([
      {
        collection: "foods",
        id: "food-1",
        serverVersion: 4,
        clientBaseVersion: 2,
        reason: "VERSION_MISMATCH",
      },
    ])
  })

  it("treats duplicate mutationId as idempotent", async () => {
    db.seedEvent({
      version: 9,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-1",
      data: JSON.stringify({ id: "food-1", name: "Rice" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m-repeat",
      device_id: "device-a",
      created_at: Date.now(),
    })

    const response = await requestSync(db, "/api/sync/push", {
      changes: [
        {
          collection: "foods",
          id: "food-1",
          data: { id: "food-1", name: "Rice" },
          baseVersion: 0,
          mutationId: "m-repeat",
        },
      ],
    })

    const body = await readJson(response)
    const accepted = readNumber(body, "accepted")
    const acceptedChanges = readArray(body, "acceptedChanges")
    expect(response.status).toBe(200)
    expect(accepted).toBe(1)
    expect(acceptedChanges).toEqual([
      {
        collection: "foods",
        id: "food-1",
        version: 9,
        mutationId: "m-repeat",
      },
    ])

    expect(db.syncEvents).toHaveLength(1)
    expect(db.syncStore[0]?.record_version).toBe(9)
  })

  it("falls back to querying inserted event version when row id metadata is missing", async () => {
    db.forceInsertRowIdFallback()

    const response = await requestSync(db, "/api/sync/push", {
      changes: [
        {
          collection: "foods",
          id: "food-9",
          data: { id: "food-9", name: "Yogurt" },
          baseVersion: 0,
          mutationId: "m-rowid-fallback",
        },
      ],
    })

    const body = await readJson(response)
    const acceptedChanges = readArray(body, "acceptedChanges")
    expect(response.status).toBe(200)
    expect(acceptedChanges[0]).toMatchObject({
      collection: "foods",
      id: "food-9",
      version: 1,
      mutationId: "m-rowid-fallback",
    })
  })

  it("treats insert-time duplicate mutation conflicts as idempotent", async () => {
    db.seedEvent({
      version: 11,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-1",
      data: JSON.stringify({ id: "food-1", name: "Rice" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m-race",
      device_id: "device-a",
      created_at: Date.now(),
    })
    db.forceOneLookupMissForMutation("m-race")

    const response = await requestSync(db, "/api/sync/push", {
      changes: [
        {
          collection: "foods",
          id: "food-1",
          data: { id: "food-1", name: "Rice" },
          baseVersion: 0,
          mutationId: "m-race",
        },
      ],
    })

    const body = await readJson(response)
    const accepted = readNumber(body, "accepted")
    const conflicts = readArray(body, "conflicts")
    const acceptedChanges = readArray(body, "acceptedChanges")

    expect(response.status).toBe(200)
    expect(accepted).toBe(1)
    expect(conflicts).toEqual([])
    expect(acceptedChanges[0]).toEqual({
      collection: "foods",
      id: "food-1",
      version: 11,
      mutationId: "m-race",
    })
  })

  it("paginates pull responses and returns next cursor", async () => {
    db.seedEvent({
      version: 1,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-1",
      data: JSON.stringify({ id: "food-1" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m1",
      device_id: null,
      created_at: Date.now(),
    })
    db.seedEvent({
      version: 2,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "nutrition",
      id: "2026-02-07",
      data: JSON.stringify({ date: "2026-02-07", entries: [] }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m2",
      device_id: null,
      created_at: Date.now(),
    })
    db.seedEvent({
      version: 3,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-2",
      data: null,
      deleted: 1,
      base_version: 1,
      mutation_id: "m3",
      device_id: null,
      created_at: Date.now(),
    })

    const response = await requestSync(db, "/api/sync/pull", {
      cursor: { version: 0 },
      limit: 2,
    })

    const body = await readJson(response)
    const hasMore = isRecord(body) ? body.hasMore : undefined
    const nextCursor = readObject(body, "nextCursor")
    const changes = readArray(body, "changes")

    expect(response.status).toBe(200)
    expect(hasMore).toBe(true)
    expect(nextCursor).toEqual({ version: 2 })
    expect(changes).toHaveLength(2)
  })

  it("filters pull by collection and maps tombstones", async () => {
    db.seedEvent({
      version: 4,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-3",
      data: null,
      deleted: 1,
      base_version: 1,
      mutation_id: "m4",
      device_id: null,
      created_at: Date.now(),
    })
    db.seedEvent({
      version: 5,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "workouts",
      id: "w1",
      data: JSON.stringify({ id: "w1" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m5",
      device_id: null,
      created_at: Date.now(),
    })

    const response = await requestSync(db, "/api/sync/pull", {
      cursor: { version: 0 },
      collections: ["foods"],
      limit: 10,
    })

    const body = await readJson(response)
    const changes = readArray(body, "changes")
    const hasMore = isRecord(body) ? body.hasMore : undefined
    const nextCursor = readObject(body, "nextCursor")
    expect(response.status).toBe(200)
    expect(changes).toEqual([
      {
        collection: "foods",
        id: "food-3",
        data: null,
        version: 4,
        deleted: true,
      },
    ])
    expect(hasMore).toBe(false)
    expect(nextCursor).toEqual({ version: 4 })
  })
})
