import { Hono } from "hono"
import type { Env } from "../env"
import { PullRequestSchema, PushRequestSchema } from "../../shared/syncSchemas"
import { logAudit } from "../lib/db"

type Variables = {
  userId: string
  userEmail: string
}

type SyncStoreRow = {
  record_version: number
}

type SyncEventRow = {
  version: number
  collection: string
  id: string
  data: string | null
  deleted: number
  mutation_id: string
}

type AcceptedChange = {
  collection: string
  id: string
  version: number
  mutationId: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function getNumber(value: unknown): number | null {
  return typeof value === "number" ? value : null
}

function getLastRowId(result: unknown): number | null {
  if (!isRecord(result) || !isRecord(result.meta)) return null
  const rowId = getNumber(result.meta.last_row_id)
  if (rowId !== null) return rowId
  return null
}

function isBaseVersionConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes("idx_sync_events_user_record_base_version") ||
    error.message.includes("sync_events.user_id, sync_events.collection, sync_events.id, sync_events.base_version")
  )
}

function isMutationIdConflictError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  return (
    error.message.includes("idx_sync_events_user_mutation") ||
    error.message.includes("sync_events.user_id, sync_events.mutation_id")
  )
}

function isSyncEventRow(value: unknown): value is SyncEventRow {
  if (!isRecord(value)) return false
  return (
    typeof value.version === "number" &&
    typeof value.collection === "string" &&
    typeof value.id === "string" &&
    (typeof value.data === "string" || value.data === null) &&
    typeof value.deleted === "number"
  )
}

async function runSequentially<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  await items.reduce((promise, item) => promise.then(() => task(item)), Promise.resolve())
}

export const syncRoutes = new Hono<{ Bindings: Env; Variables: Variables }>()

syncRoutes.post("/push", async (c) => {
  const body = await c.req.json()
  const parsed = PushRequestSchema.safeParse(body)
  if (!parsed.success) {
    return c.json({ error: "INVALID_REQUEST", message: "Invalid push payload" }, 400)
  }

  const userId = c.get("userId")
  const userEmail = c.get("userEmail")
  const now = Date.now()

  let accepted = 0
  const acceptedChanges: AcceptedChange[] = []
  const conflicts: Array<{
    collection: string
    id: string
    serverVersion: number
    clientBaseVersion: number
    reason: string
  }> = []

  await runSequentially(parsed.data.changes, async (change) => {
    const deleted = change.data === null
    const dataJson = change.data ? JSON.stringify(change.data) : null
    const deviceId = change.deviceId ?? null

    const existingEvent = await c.env.DB
      .prepare("SELECT version, collection, id, mutation_id FROM sync_events WHERE user_id = ? AND mutation_id = ?")
      .bind(userId, change.mutationId)
      .first<{ version: number; collection: string; id: string; mutation_id: string }>()

    if (existingEvent) {
      accepted += 1
      acceptedChanges.push({
        collection: existingEvent.collection,
        id: existingEvent.id,
        version: existingEvent.version,
        mutationId: existingEvent.mutation_id,
      })
      return
    }

    const current = await c.env.DB
      .prepare("SELECT record_version FROM sync_store WHERE user_id = ? AND collection = ? AND id = ?")
      .bind(userId, change.collection, change.id)
      .first<SyncStoreRow>()

    const currentVersion = current?.record_version ?? 0
    if (change.baseVersion !== currentVersion) {
      conflicts.push({
        collection: change.collection,
        id: change.id,
        serverVersion: currentVersion,
        clientBaseVersion: change.baseVersion,
        reason: "VERSION_MISMATCH",
      })
      return
    }

    let version: number | null = null
    try {
      const insertResult = await c.env.DB
        .prepare(`
          INSERT INTO sync_events
            (user_id, user_email, collection, id, data, deleted, base_version, mutation_id, device_id, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        .bind(
          userId,
          userEmail,
          change.collection,
          change.id,
          dataJson,
          deleted ? 1 : 0,
          change.baseVersion,
          change.mutationId,
          deviceId,
          now
        )
        .run()

      version = getLastRowId(insertResult)
      if (version === null) {
        const insertedEvent = await c.env.DB
          .prepare("SELECT version FROM sync_events WHERE user_id = ? AND mutation_id = ?")
          .bind(userId, change.mutationId)
          .first<{ version: number }>()
        version = insertedEvent?.version ?? null
      }
    } catch (error) {
      if (isMutationIdConflictError(error)) {
        const duplicateEvent = await c.env.DB
          .prepare("SELECT version, collection, id, mutation_id FROM sync_events WHERE user_id = ? AND mutation_id = ?")
          .bind(userId, change.mutationId)
          .first<{ version: number; collection: string; id: string; mutation_id: string }>()

        if (!duplicateEvent) {
          throw error
        }

        accepted += 1
        acceptedChanges.push({
          collection: duplicateEvent.collection,
          id: duplicateEvent.id,
          version: duplicateEvent.version,
          mutationId: duplicateEvent.mutation_id,
        })
        return
      }

      if (!isBaseVersionConflictError(error)) {
        throw error
      }

      const latest = await c.env.DB
        .prepare("SELECT record_version FROM sync_store WHERE user_id = ? AND collection = ? AND id = ?")
        .bind(userId, change.collection, change.id)
        .first<SyncStoreRow>()

      conflicts.push({
        collection: change.collection,
        id: change.id,
        serverVersion: latest?.record_version ?? 0,
        clientBaseVersion: change.baseVersion,
        reason: "VERSION_MISMATCH",
      })
      return
    }

    if (version === null) {
      throw new Error("Failed to resolve event version")
    }

    await c.env.DB
      .prepare(`
        INSERT INTO sync_store
          (user_id, user_email, collection, id, data, deleted, record_version, updated_at, mutation_id, device_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id, collection, id) DO UPDATE SET
          user_email = excluded.user_email,
          data = excluded.data,
          deleted = excluded.deleted,
          record_version = excluded.record_version,
          updated_at = excluded.updated_at,
          mutation_id = excluded.mutation_id,
          device_id = excluded.device_id
      `)
      .bind(
        userId,
        userEmail,
        change.collection,
        change.id,
        dataJson,
        deleted ? 1 : 0,
        version,
        now,
        change.mutationId,
        deviceId
      )
      .run()

    accepted += 1
    acceptedChanges.push({
      collection: change.collection,
      id: change.id,
      version,
      mutationId: change.mutationId,
    })
  })

  await logAudit(c.env.DB, {
    userId,
    userEmail,
    action: "push",
    details: { accepted, conflicts: conflicts.length },
  })

  return c.json({ accepted, acceptedChanges, conflicts })
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
  const cursorVersion = parsed.data.cursor?.version ?? 0
  const collections = parsed.data.collections

  const params: unknown[] = [userId, cursorVersion]
  let sql = `
    SELECT version, collection, id, data, deleted
    FROM sync_events
    WHERE user_id = ? AND version > ?
  `

  if (collections && collections.length > 0) {
    sql += ` AND collection IN (${collections.map(() => "?").join(",")})`
    params.push(...collections)
  }

  sql += " ORDER BY version ASC LIMIT ?"
  params.push(limit + 1)

  const result = await c.env.DB.prepare(sql).bind(...params).all()
  const rawResults = Array.isArray(result.results) ? result.results : []
  const rows = rawResults.filter(isSyncEventRow)

  const hasMore = rows.length > limit
  const page = hasMore ? rows.slice(0, limit) : rows

  const changes = page.map((row) => ({
    collection: row.collection,
    id: row.id,
    data: row.data ? JSON.parse(row.data) : null,
    version: row.version,
    deleted: row.deleted === 1,
  }))

  const last = page[page.length - 1]
  const nextCursor = last ? { version: last.version } : null

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
