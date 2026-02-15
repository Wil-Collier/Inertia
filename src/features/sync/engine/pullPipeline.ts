import { pullChanges } from "@/features/sync/api"
import { getPullCursor } from "@/features/sync/changeTracker"
import { MAX_PULL_LIMIT } from "@/features/sync/schemas"
import type { PullChange, SyncCollection, SyncCursor } from "@/features/sync/schemas"

const MAX_PAGES_PER_SYNC = 1000

export interface PullPipelineResult {
  changes: PullChange[]
  cursor: SyncCursor | null
  serverTimestampMs: number
  affectedCollections: Set<SyncCollection>
}

export async function pullAllChanges(
  accessToken: string,
  options: { cursor?: SyncCursor | null } = {}
): Promise<PullPipelineResult> {
  const startCursor = options.cursor === undefined ? await getPullCursor() : options.cursor
  let cursorVersion = startCursor?.version ?? 0
  let finalCursor: SyncCursor | null = startCursor ?? null
  let cursorAdvanced = false
  let serverTimestampMs = Date.now()
  const allChanges: PullChange[] = []

  let pageCount = 0
  while (true) {
    pageCount += 1
    if (pageCount > MAX_PAGES_PER_SYNC) {
      throw new Error("Exceeded max pages during pull")
    }

    // eslint-disable-next-line no-await-in-loop
    const response = await pullChanges(accessToken, {
      cursor: { version: cursorVersion },
      limit: MAX_PULL_LIMIT,
    })

    serverTimestampMs = response.serverTimestampMs
    allChanges.push(...response.changes)

    if (response.nextCursor) {
      cursorVersion = response.nextCursor.version
      finalCursor = response.nextCursor
      cursorAdvanced = true
    }

    if (!response.hasMore) {
      break
    }
  }

  const affectedCollections = new Set<SyncCollection>()
  allChanges.forEach((change) => affectedCollections.add(change.collection))
  let fallbackCursor: SyncCursor | null = null
  if (allChanges.length > 0) {
    const lastChange = allChanges[allChanges.length - 1]
    fallbackCursor = { version: lastChange.version }
  }
  const resolvedCursor = allChanges.length === 0 ? startCursor ?? null : cursorAdvanced ? finalCursor : fallbackCursor

  return {
    changes: allChanges,
    cursor: resolvedCursor,
    serverTimestampMs,
    affectedCollections,
  }
}
