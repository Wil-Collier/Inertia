import { pullChanges } from "@/features/sync/client/api"
import { getPullCursor } from "@/features/sync/tracking/changeTracker"
import { readAccessToken, type AccessTokenSource } from "@/features/sync/engine/accessTokenSource"
import { MAX_PULL_LIMIT } from "@/features/sync/model/schemas"
import type { PullChange, SyncCollection, SyncCursor } from "@/features/sync/model/schemas"

const MAX_PAGES_PER_SYNC = 1000

export interface PullPipelineResult {
  changes: PullChange[]
  cursor: SyncCursor | null
  serverTimestampMs: number
  affectedCollections: Set<SyncCollection>
}

export interface PullPage {
  changes: PullChange[]
  cursor: SyncCursor | null
  serverTimestampMs: number
  affectedCollections: Set<SyncCollection>
  hasMore: boolean
}

export interface PullProcessResult {
  cursor: SyncCursor | null
  serverTimestampMs: number
  affectedCollections: Set<SyncCollection>
  hasMore: boolean
  pagesProcessed: number
}

export async function pullAllChanges(
  accessTokenSource: AccessTokenSource,
  options: { cursor?: SyncCursor | null; maxPages?: number } = {}
): Promise<PullPipelineResult & { hasMore: boolean }> {
  const allChanges: PullChange[] = []
  const processed = await pullAndProcessChanges(accessTokenSource, {
    cursor: options.cursor,
    maxPages: options.maxPages,
    onPage: (page) => {
      allChanges.push(...page.changes)
    },
  })

  return {
    changes: allChanges,
    cursor: processed.cursor,
    serverTimestampMs: processed.serverTimestampMs,
    affectedCollections: processed.affectedCollections,
    hasMore: processed.hasMore,
  }
}

export async function pullAndProcessChanges(
  accessTokenSource: AccessTokenSource,
  options: {
    cursor?: SyncCursor | null
    maxPages?: number
    onPage?: (page: PullPage) => Promise<void> | void
  } = {}
): Promise<PullProcessResult> {
  const startCursor = options.cursor === undefined ? await getPullCursor() : options.cursor
  const maxPages = options.maxPages ?? MAX_PAGES_PER_SYNC
  if (maxPages < 1) {
    throw new Error("maxPages must be >= 1")
  }

  let currentCursor: SyncCursor | null = startCursor ?? null
  let cursorVersion = currentCursor?.version ?? 0
  let serverTimestampMs = Date.now()
  const affectedCollections = new Set<SyncCollection>()
  let hasMore = false
  let pagesProcessed = 0

  while (pagesProcessed < maxPages) {
    // eslint-disable-next-line no-await-in-loop
    const response = await pullChanges(readAccessToken(accessTokenSource), {
      cursor: { version: cursorVersion },
      limit: MAX_PULL_LIMIT,
    })

    const pageCursor = resolveCursor(currentCursor, response.changes, response.nextCursor)
    currentCursor = pageCursor
    cursorVersion = pageCursor?.version ?? 0
    serverTimestampMs = response.serverTimestampMs
    hasMore = response.hasMore
    pagesProcessed += 1

    const pageAffectedCollections = new Set<SyncCollection>()
    response.changes.forEach((change) => {
      affectedCollections.add(change.collection)
      pageAffectedCollections.add(change.collection)
    })

    if (options.onPage) {
      // eslint-disable-next-line no-await-in-loop
      await options.onPage({
        changes: response.changes,
        cursor: pageCursor,
        serverTimestampMs: response.serverTimestampMs,
        affectedCollections: pageAffectedCollections,
        hasMore: response.hasMore,
      })
    }

    if (!response.hasMore) {
      break
    }
  }

  if (hasMore && import.meta.env.DEV) {
    console.warn(`[Sync] Pull stopped after ${pagesProcessed} pages; will resume from cursor ${currentCursor?.version ?? 0}`)
  }

  return {
    cursor: currentCursor,
    serverTimestampMs,
    affectedCollections,
    hasMore,
    pagesProcessed,
  }
}

function resolveCursor(
  currentCursor: SyncCursor | null,
  changes: PullChange[],
  nextCursor: SyncCursor | null
): SyncCursor | null {
  if (nextCursor) {
    return nextCursor
  }
  if (changes.length === 0) {
    return currentCursor
  }
  const lastChange = changes[changes.length - 1]
  if (!lastChange) {
    return currentCursor
  }
  return { version: lastChange.version }
}
