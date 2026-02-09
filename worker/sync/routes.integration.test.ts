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
      .map((event) => ({
        version: event.version,
        collection: event.collection,
        id: event.id,
        data: event.data,
        deleted: event.deleted,
      }))

    const rawRows = this.db.rawPullRows
      .filter((value) => {
        if (!isRecord(value)) return true
        const rowUserId = value.user_id
        if (typeof rowUserId !== "string" || rowUserId.length === 0) return true
        return rowUserId === userId
      })
      .filter((value) => {
        if (!isRecord(value)) return true
        const version = value.version
        return typeof version !== "number" || version > cursorVersion
      })
      .filter((value) => {
        if (!collections || collections.length === 0) return true
        if (!isRecord(value)) return true
        const collection = value.collection
        return typeof collection !== "string" || collections.includes(collection)
      })

    const sorted = [...rows, ...rawRows]
      .toSorted((a, b) => {
        const aVersion = isRecord(a) && typeof a.version === "number" ? a.version : 0
        const bVersion = isRecord(b) && typeof b.version === "number" ? b.version : 0
        return aVersion - bVersion
      })
      .slice(0, limit)

    return { results: sorted }
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
  rawPullRows: unknown[] = []
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

  seedRawPullRow(row: unknown) {
    this.rawPullRows.push(row)
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

async function requestRawSync(db: FakeD1, path: string, body: BodyInit, headers: Record<string, string>) {
  const token = await createToken()
  return await app.request(
    path,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        ...headers,
      },
      body,
    },
    createEnv(db)
  )
}

async function requestStreamSyncWithoutContentLength(
  db: FakeD1,
  path: string,
  bodyText: string
): Promise<Response> {
  const token = await createToken()
  const bytes = new TextEncoder().encode(bodyText)
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })
  const requestInit: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: stream,
  }
  Reflect.set(requestInit, "duplex", "half")
  const request = new Request(`http://localhost${path}`, requestInit)

  return await app.request(request, {}, createEnv(db))
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

  it("returns 413 for oversized push payload when content-length exceeds limit", async () => {
    const oversizedPush = JSON.stringify({
      changes: [
        {
          collection: "foods",
          id: "food-oversized",
          data: { note: "x".repeat(1024 * 1024) },
          baseVersion: 0,
          mutationId: "m-oversized-1",
        },
      ],
    })

    const response = await requestRawSync(db, "/api/sync/push", oversizedPush, {
      "Content-Type": "application/json",
      "Content-Length": String(oversizedPush.length),
    })
    const body = await readJson(response)

    expect(response.status).toBe(413)
    expect(body).toEqual({ error: "PAYLOAD_TOO_LARGE", message: "Push payload exceeds size limit" })
  })

  it("returns 413 for oversized push payload without content-length header", async () => {
    const oversizedPush = JSON.stringify({
      changes: [
        {
          collection: "foods",
          id: "food-oversized-stream",
          data: { note: "x".repeat(1024 * 1024) },
          baseVersion: 0,
          mutationId: "m-oversized-2",
        },
      ],
    })

    const response = await requestStreamSyncWithoutContentLength(db, "/api/sync/push", oversizedPush)
    const body = await readJson(response)

    expect(response.status).toBe(413)
    expect(body).toEqual({ error: "PAYLOAD_TOO_LARGE", message: "Push payload exceeds size limit" })
  })

  it("returns 413 for oversized pull payload", async () => {
    const oversizedPull = JSON.stringify({
      cursor: { version: 0 },
      padding: "x".repeat(70 * 1024),
    })

    const response = await requestRawSync(db, "/api/sync/pull", oversizedPull, {
      "Content-Type": "application/json",
      "Content-Length": String(oversizedPull.length),
    })
    const body = await readJson(response)

    expect(response.status).toBe(413)
    expect(body).toEqual({ error: "PAYLOAD_TOO_LARGE", message: "Pull payload exceeds size limit" })
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

  it("rejects records that exceed byte-size limits for multibyte JSON payloads", async () => {
    const oversizedData = "😀".repeat(150_000)

    const response = await requestSync(db, "/api/sync/push", {
      changes: [
        {
          collection: "foods",
          id: "food-too-large",
          data: { note: oversizedData },
          baseVersion: 0,
          mutationId: "m-too-large",
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
        id: "food-too-large",
        serverVersion: 0,
        clientBaseVersion: 0,
        reason: "RECORD_TOO_LARGE",
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

  it("continues pagination when malformed rows are present in the pull window", async () => {
    db.seedEvent({
      version: 1,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-1",
      data: JSON.stringify({ id: "food-1", name: "Rice" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m-good-1",
      device_id: null,
      created_at: Date.now(),
    })
    db.seedRawPullRow({
      user_id: "u1",
      version: 2,
      collection: "foods",
      id: "food-bad",
      data: 123,
      deleted: 0,
    })
    db.seedEvent({
      version: 3,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-3",
      data: JSON.stringify({ id: "food-3", name: "Beans" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m-good-3",
      device_id: null,
      created_at: Date.now(),
    })

    const firstResponse = await requestSync(db, "/api/sync/pull", {
      cursor: { version: 0 },
      limit: 2,
    })
    const firstBody = await readJson(firstResponse)
    const firstChanges = readArray(firstBody, "changes")
    const firstNextCursor = readObject(firstBody, "nextCursor")
    const firstHasMore = isRecord(firstBody) ? firstBody.hasMore : undefined

    expect(firstResponse.status).toBe(200)
    expect(firstHasMore).toBe(true)
    expect(firstChanges).toEqual([
      {
        collection: "foods",
        id: "food-1",
        data: { id: "food-1", name: "Rice" },
        version: 1,
        deleted: false,
      },
    ])
    expect(firstNextCursor).toEqual({ version: 2 })

    const secondResponse = await requestSync(db, "/api/sync/pull", {
      cursor: { version: 2 },
      limit: 2,
    })
    const secondBody = await readJson(secondResponse)
    const secondChanges = readArray(secondBody, "changes")
    const secondHasMore = isRecord(secondBody) ? secondBody.hasMore : undefined

    expect(secondResponse.status).toBe(200)
    expect(secondHasMore).toBe(false)
    expect(secondChanges).toEqual([
      {
        collection: "foods",
        id: "food-3",
        data: { id: "food-3", name: "Beans" },
        version: 3,
        deleted: false,
      },
    ])
  })

  it("filters out non-deleted records with corrupted JSON data from pull response", async () => {
    db.seedEvent({
      version: 1,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-valid",
      data: JSON.stringify({ id: "food-valid", name: "Valid Food" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m-valid",
      device_id: null,
      created_at: Date.now(),
    })
    // Simulate corrupted JSON via raw row
    db.seedRawPullRow({
      user_id: "u1",
      version: 2,
      collection: "foods",
      id: "food-corrupted",
      data: "{ invalid json \\x00",
      deleted: 0,
    })
    db.seedEvent({
      version: 3,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-also-valid",
      data: JSON.stringify({ id: "food-also-valid", name: "Also Valid" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m-also-valid",
      device_id: null,
      created_at: Date.now(),
    })

    const response = await requestSync(db, "/api/sync/pull", {
      cursor: { version: 0 },
      limit: 10,
    })

    const body = await readJson(response)
    const changes = readArray(body, "changes")

    expect(response.status).toBe(200)
    // Corrupted record should be filtered out, but valid ones included
    expect(changes).toHaveLength(2)
    expect(changes.map((c: unknown) => isRecord(c) ? c.id : null)).toEqual(["food-valid", "food-also-valid"])
  })

  it("includes corrupted tombstone records in pull response with null data", async () => {
    // Simulate corrupted deleted record via raw row
    db.seedRawPullRow({
      user_id: "u1",
      version: 1,
      collection: "foods",
      id: "food-deleted-corrupted",
      data: "{ corrupted but deleted \\x00",
      deleted: 1,
    })

    const response = await requestSync(db, "/api/sync/pull", {
      cursor: { version: 0 },
      limit: 10,
    })

    const body = await readJson(response)
    const changes = readArray(body, "changes")

    expect(response.status).toBe(200)
    // Tombstones with corrupted data should still be included with null data
    expect(changes).toHaveLength(1)
    expect(changes[0]).toMatchObject({
      collection: "foods",
      id: "food-deleted-corrupted",
      data: null,
      deleted: true,
    })
  })

  it("advances cursor correctly even when some records are filtered due to corruption", async () => {
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
    // Corrupted record at version 2 (should be skipped)
    db.seedRawPullRow({
      user_id: "u1",
      version: 2,
      collection: "foods",
      id: "food-corrupted",
      data: "not valid json",
      deleted: 0,
    })
    db.seedEvent({
      version: 3,
      user_id: "u1",
      user_email: "u1@example.com",
      collection: "foods",
      id: "food-3",
      data: JSON.stringify({ id: "food-3" }),
      deleted: 0,
      base_version: 0,
      mutation_id: "m3",
      device_id: null,
      created_at: Date.now(),
    })

    const response = await requestSync(db, "/api/sync/pull", {
      cursor: { version: 0 },
      limit: 10,
    })

    const body = await readJson(response)
    const nextCursor = readObject(body, "nextCursor")
    const hasMore = isRecord(body) ? body.hasMore : undefined

    expect(response.status).toBe(200)
    // Cursor should advance past the corrupted record
    expect(nextCursor).toEqual({ version: 3 })
    expect(hasMore).toBe(false)
  })
})

