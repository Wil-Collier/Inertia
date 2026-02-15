import type { D1Database } from "@cloudflare/workers-types"

const MS_PER_DAY = 24 * 60 * 60 * 1000
const DEFAULT_RETENTION_DAYS = 30
const DEFAULT_DELETE_BATCH_SIZE = 2000

interface CompactionOptions {
  retentionDays?: number
  deleteBatchSize?: number
}

export async function compactSyncEvents(
  db: D1Like,
  options: CompactionOptions = {}
): Promise<number> {
  const retentionDays = options.retentionDays ?? DEFAULT_RETENTION_DAYS
  const deleteBatchSize = options.deleteBatchSize ?? DEFAULT_DELETE_BATCH_SIZE
  const cutoffMs = Date.now() - retentionDays * MS_PER_DAY

  const deleteStatement = db.prepare(
    `
      DELETE FROM sync_events
      WHERE version IN (
        SELECT e.version
        FROM sync_events e
        INNER JOIN (
          SELECT user_id, collection, id, MAX(version) AS max_version
          FROM sync_events
          GROUP BY user_id, collection, id
        ) latest
          ON latest.user_id = e.user_id
         AND latest.collection = e.collection
         AND latest.id = e.id
        WHERE e.version < latest.max_version
          AND e.created_at < ?
        LIMIT ?
      )
    `
  )

  const result = await deleteStatement.bind(cutoffMs, deleteBatchSize).run()
  const changes = Number(result.meta.changes ?? 0)
  return Number.isFinite(changes) ? changes : 0
}
type D1Like = Pick<D1Database, "prepare">
