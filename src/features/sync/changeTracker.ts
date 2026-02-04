import type { Transaction } from "dexie"
import { db, type MetadataRecord } from "@/services/db"
import { useSyncStore } from "@/features/sync/store"
import type { PendingChange } from "@/features/sync/types"
import type { SyncCursor } from "@/features/sync/schemas"

const PENDING_CHANGES_KEY = "sync.pendingChanges"
const PULL_CURSOR_KEY = "sync.pullCursor"
const LAST_SYNCED_AT_KEY = "sync.lastSyncedAtMs"

function parseJsonValue(value: string | number | boolean | undefined): unknown {
  if (typeof value !== "string") return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

async function readMetadataJson(key: string): Promise<unknown> {
  const record = await db.metadata.get(key)
  return parseJsonValue(record?.value)
}

async function writeMetadataJson(key: string, value: unknown): Promise<void> {
  await db.metadata.put({ key, value: JSON.stringify(value) })
}

function getMetadataTable(transaction?: Transaction) {
  return transaction ? transaction.table<MetadataRecord>("metadata") : db.metadata
}

async function updatePendingChanges(
  updater: (current: PendingChange[]) => PendingChange[],
  transaction?: Transaction
): Promise<void> {
  const table = getMetadataTable(transaction)
  const record = await table.get(PENDING_CHANGES_KEY)
  const parsed = parseJsonValue(record?.value)
  const current = Array.isArray(parsed) ? parsed.filter(isPendingChange) : []
  const next = updater(current)
  await table.put({ key: PENDING_CHANGES_KEY, value: JSON.stringify(next) })
}

function queuePendingCountRefresh() {
  queueMicrotask(() => {
    void refreshPendingCount()
  })
}

export async function refreshPendingCount(): Promise<void> {
  const pending = await getPendingChanges()
  useSyncStore.getState().setPendingCount(pending.length)
}

export async function getPendingChanges(): Promise<PendingChange[]> {
  const raw = await readMetadataJson(PENDING_CHANGES_KEY)
  if (!Array.isArray(raw)) return []
  return raw.filter(isPendingChange)
}

export async function setPendingChanges(changes: PendingChange[]): Promise<void> {
  await writeMetadataJson(PENDING_CHANGES_KEY, changes)
  queuePendingCountRefresh()
}

export async function enqueueChange(change: PendingChange): Promise<void> {
  await updatePendingChanges((current) => mergePendingChange(current, change))
  queuePendingCountRefresh()
}

export async function enqueueChangeInTransaction(change: PendingChange, transaction: Transaction): Promise<void> {
  await updatePendingChanges((current) => mergePendingChange(current, change), transaction)
  queuePendingCountRefresh()
}

export async function removePendingChanges(toRemove: PendingChange[]): Promise<void> {
  if (toRemove.length === 0) return
  await updatePendingChanges((current) => {
    return current.filter((change) => !toRemove.some((removal) => isSameChange(change, removal)))
  })
  queuePendingCountRefresh()
}

export async function clearPendingChanges(): Promise<void> {
  await writeMetadataJson(PENDING_CHANGES_KEY, [])
  queuePendingCountRefresh()
}

export async function getPullCursor(): Promise<SyncCursor | null> {
  const raw = await readMetadataJson(PULL_CURSOR_KEY)
  return isSyncCursor(raw) ? raw : null
}

export async function setPullCursor(cursor: SyncCursor | null): Promise<void> {
  if (!cursor) {
    await db.metadata.delete(PULL_CURSOR_KEY)
    return
  }
  await writeMetadataJson(PULL_CURSOR_KEY, cursor)
}

export async function getLastSyncedAtMs(): Promise<number | null> {
  const record = await db.metadata.get(LAST_SYNCED_AT_KEY)
  return typeof record?.value === "number" ? record.value : null
}

export async function setLastSyncedAtMs(timestamp: number): Promise<void> {
  await db.metadata.put({ key: LAST_SYNCED_AT_KEY, value: timestamp })
}

export async function clearSyncMetadata(): Promise<void> {
  await db.transaction("rw", db.metadata, async () => {
    await db.metadata.delete(PENDING_CHANGES_KEY)
    await db.metadata.delete(PULL_CURSOR_KEY)
    await db.metadata.delete(LAST_SYNCED_AT_KEY)
  })
  queuePendingCountRefresh()
}

function mergePendingChange(current: PendingChange[], change: PendingChange): PendingChange[] {
  const index = current.findIndex((entry) => isSameChange(entry, change))
  if (index === -1) {
    return [...current, change]
  }

  const existing = current[index]
  const merged: PendingChange = {
    ...existing,
    ...change,
    updatedAt: Math.max(existing.updatedAt, change.updatedAt),
    deleted: change.deleted ?? existing.deleted,
  }

  return [...current.slice(0, index), merged, ...current.slice(index + 1)]
}

function isSameChange(a: PendingChange, b: PendingChange): boolean {
  return a.collection === b.collection && a.id === b.id
}

function isPendingChange(value: unknown): value is PendingChange {
  if (!isRecord(value)) return false
  const record = value
  return (
    typeof record.collection === "string" &&
    typeof record.id === "string" &&
    typeof record.updatedAt === "number"
  )
}

function isSyncCursor(value: unknown): value is SyncCursor {
  if (!isRecord(value)) return false
  const record = value
  return (
    typeof record.updatedAt === "number" &&
    typeof record.collection === "string" &&
    typeof record.id === "string"
  )
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}
