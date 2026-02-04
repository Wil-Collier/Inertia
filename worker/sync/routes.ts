import { Hono } from "hono"
import type { Env } from "../env"
import { PushRequestSchema, PullRequestSchema } from "../../shared/syncSchemas"
import { logAudit } from "../lib/db"

type Variables = {
  userId: string
  userEmail: string
}

const MAX_CLOCK_SKEW_MS = 60 * 60 * 1000

async function runSequentially<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  await items.reduce((promise, item) => promise.then(() => task(item)), Promise.resolve())
}

type SyncRow = {
  collection: string
  id: string
  data: string | null
  updated_at: number
  deleted: number
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null
}

function getChangesCount(result: unknown): number {
  if (!isRecord(result)) return 0
  const direct = getNumber(result.changes)
  if (direct !== null) return direct
  if (isRecord(result.meta)) {
    const metaChanges = getNumber(result.meta.changes)
    if (metaChanges !== null) return metaChanges
  }
  return 0
}

function isSyncRow(value: unknown): value is SyncRow {
  if (!isRecord(value)) return false
  return (
    typeof value.collection === "string" &&
    typeof value.id === "string" &&
    (typeof value.data === "string" || value.data === null) &&
    typeof value.updated_at === "number" &&
    typeof value.deleted === "number"
  )
}

const UPSERT_SQL = `
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
    data = CASE
      WHEN excluded.deleted = 1 THEN COALESCE(sync_store.data, excluded.data)
      ELSE excluded.data
    END
  WHERE
    excluded.updated_at > sync_store.updated_at
    OR (
      excluded.updated_at = sync_store.updated_at
      AND COALESCE(excluded.device_id, '') > COALESCE(sync_store.device_id, '')
    );
`

export const syncRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

syncRoutes.post("/push", async (c) => {
  const body = await c.req.json()
  const parsed = PushRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "INVALID_REQUEST", message: "Invalid push payload" }, 400)
  }

  const userId = c.get("userId")
  const userEmail = c.get("userEmail")

  let accepted = 0
  const conflicts: Array<{ collection: string; id: string; serverUpdatedAt: number; reason: string }> = []

  const stmt = c.env.DB.prepare(UPSERT_SQL)

  await runSequentially(parsed.data.changes, async (change) => {
    const serverNow = Date.now()
    const maxAllowedTimestamp = serverNow + MAX_CLOCK_SKEW_MS
    const updatedAt = change.updatedAt > maxAllowedTimestamp ? serverNow : change.updatedAt
    const deleted = change.data === null
    const dataJson = change.data ? JSON.stringify(change.data) : null
    const deviceId = change.deviceId ?? null

    const result = await stmt
      .bind(userId, userEmail, change.collection, change.id, dataJson, updatedAt, deleted ? 1 : 0, deviceId)
      .run()

    const changes = getChangesCount(result)

    if (changes === 0) {
      const existing = await c.env.DB
        .prepare("SELECT updated_at FROM sync_store WHERE user_id = ? AND collection = ? AND id = ?")
        .bind(userId, change.collection, change.id)
        .first<{ updated_at: number }>()

      conflicts.push({
        collection: change.collection,
        id: change.id,
        serverUpdatedAt: existing?.updated_at ?? updatedAt,
        reason: "SERVER_NEWER",
      })
      return
    }

    accepted += 1
  })

  await logAudit(c.env.DB, {
    userId,
    userEmail,
    action: "push",
    details: { accepted, conflicts: conflicts.length },
  })

  return c.json({ accepted, conflicts })
})

syncRoutes.post("/pull", async (c) => {
  const body = await c.req.json()
  const parsed = PullRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "INVALID_REQUEST", message: "Invalid pull payload" }, 400)
  }

  const userId = c.get("userId")
  const userEmail = c.get("userEmail")

  const limit = Math.min(parsed.data.limit ?? 500, 500)
  const cursor = parsed.data.cursor
  const collections = parsed.data.collections

  const params: unknown[] = [userId]
  let sql = "SELECT collection, id, data, updated_at, deleted FROM sync_store WHERE user_id = ?"

  if (cursor) {
    sql += " AND (updated_at > ? OR (updated_at = ? AND (collection > ? OR (collection = ? AND id > ?))))"
    params.push(cursor.updatedAt, cursor.updatedAt, cursor.collection, cursor.collection, cursor.id)
  }

  if (collections && collections.length > 0) {
    sql += ` AND collection IN (${collections.map(() => "?").join(",")})`
    params.push(...collections)
  }

  sql += " ORDER BY updated_at ASC, collection ASC, id ASC LIMIT ?"
  params.push(limit + 1)

  const result = await c.env.DB.prepare(sql).bind(...params).all()

  const rawResults = Array.isArray(result.results) ? result.results : []
  const rows = rawResults.filter(isSyncRow)

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const changes = page.map((row) => ({
    collection: row.collection,
    id: row.id,
    data: row.data ? JSON.parse(row.data) : null,
    updatedAt: row.updated_at,
    deleted: row.deleted === 1,
  }))

  const last = page[page.length - 1]
  const nextCursor = last
    ? { updatedAt: last.updated_at, collection: last.collection, id: last.id }
    : null

  await logAudit(c.env.DB, {
    userId,
    userEmail,
    action: "pull",
    details: { count: changes.length },
  })

  return c.json({
    changes,
    nextCursor,
    serverTimestampMs: Date.now(),
    hasMore,
  })
})
