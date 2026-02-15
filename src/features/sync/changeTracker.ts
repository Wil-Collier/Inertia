import type { Transaction } from "dexie"
import { db, type SyncPendingChangeRecord, type SyncRecordVersionRecord } from "@/services/db"
import { useSyncStore } from "@/features/sync/store"
import type { PendingChange } from "@/features/sync/types"
import { SYNC_COLLECTIONS, type SyncCollection, type SyncCursor } from "@/features/sync/schemas"
import { isRecord } from "@/features/sync/typeGuards"

const PULL_CURSOR_KEY = "sync.pullCursor"
const LAST_SYNCED_AT_KEY = "sync.lastSyncedAtMs"
const LOCAL_DATA_OWNER_USER_ID_KEY = "sync.localDataOwnerUserId"

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

function queuePendingCountRefresh() {
  queueMicrotask(() => {
    void refreshPendingCount()
  })
}

const pendingRefreshTransactions = new WeakSet<Transaction>()

function queuePendingCountRefreshAfterTransaction(transaction: Transaction) {
  if (pendingRefreshTransactions.has(transaction)) return
  pendingRefreshTransactions.add(transaction)

  const refresh = () => {
    void refreshPendingCount()
  }

  transaction.on("complete", refresh)
  transaction.on("abort", refresh)
  transaction.on("error", refresh)
}

function transactionHasStore(transaction: Transaction, storeName: string): boolean {
  return transaction.storeNames.includes(storeName)
}

function getPendingTable(transaction?: Transaction) {
  return transaction
    ? transaction.table<SyncPendingChangeRecord, [string, string]>("syncPendingChanges")
    : db.syncPendingChanges
}

function getVersionTable(transaction?: Transaction) {
  return transaction
    ? transaction.table<SyncRecordVersionRecord, [string, string]>("syncRecordVersions")
    : db.syncRecordVersions
}

const syncCollections = new Set<string>(SYNC_COLLECTIONS)

function toPendingChange(record: SyncPendingChangeRecord): PendingChange | null {
  if (!isSyncCollection(record.collection)) return null
  return {
    collection: record.collection,
    id: record.id,
    deleted: record.deleted,
    baseVersion: record.baseVersion,
    mutationId: record.mutationId,
    enqueuedAt: record.enqueuedAt,
  }
}

export async function refreshPendingCount(): Promise<void> {
  const count = await db.syncPendingChanges.count()
  useSyncStore.getState().setPendingCount(count)
}

export async function listPendingChanges(limit?: number): Promise<PendingChange[]> {
  const query = db.syncPendingChanges.orderBy("enqueuedAt")
  const rows = typeof limit === "number" ? await query.limit(limit).toArray() : await query.toArray()
  return rows.map(toPendingChange).filter((value): value is PendingChange => value !== null)
}

export async function enqueuePendingChange(change: PendingChange): Promise<void> {
  await upsertPendingChange(change)
  queuePendingCountRefresh()
}

async function upsertPendingChange(change: PendingChange, transaction?: Transaction): Promise<void> {
  const table = getPendingTable(transaction)
  const key: [string, string] = [change.collection, change.id]
  const existing = await table.get(key)

  const merged: SyncPendingChangeRecord = existing
    ? {
      ...existing,
      deleted: change.deleted,
      mutationId: change.mutationId,
      enqueuedAt: change.enqueuedAt,
    }
    : {
      collection: change.collection,
      id: change.id,
      deleted: change.deleted,
      baseVersion: change.baseVersion,
      mutationId: change.mutationId,
      enqueuedAt: change.enqueuedAt,
    }

  await table.put(merged)
}

export async function enqueuePendingChangeInTransaction(change: PendingChange, transaction: Transaction): Promise<void> {
  if (transactionHasStore(transaction, "syncPendingChanges")) {
    await upsertPendingChange(change, transaction)
    queuePendingCountRefreshAfterTransaction(transaction)
    return
  }

  transaction.on("complete", () => {
    void enqueuePendingChange(change)
  })
}

export async function acknowledgeProcessedPendingChanges(
  entries: Array<{ collection: SyncCollection; id: string; mutationId: string }>
): Promise<void> {
  if (entries.length === 0) return

  await db.transaction("rw", db.syncPendingChanges, async () => {
    await Promise.all(
      entries.map(async (entry) => {
        const key: [string, string] = [entry.collection, entry.id]
        const current = await db.syncPendingChanges.get(key)
        if (current?.mutationId !== entry.mutationId) return
        await db.syncPendingChanges.delete(key)
      })
    )
  })

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
  const raw = await readMetadataJson(LAST_SYNCED_AT_KEY)
  return typeof raw === "number" ? raw : null
}

export async function setLastSyncedAtMs(timestamp: number): Promise<void> {
  await writeMetadataJson(LAST_SYNCED_AT_KEY, timestamp)
}

export async function getLocalDataOwnerUserId(): Promise<string | null> {
  const record = await db.metadata.get(LOCAL_DATA_OWNER_USER_ID_KEY)
  return typeof record?.value === "string" && record.value.length > 0 ? record.value : null
}

export async function setLocalDataOwnerUserId(userId: string): Promise<void> {
  await db.metadata.put({ key: LOCAL_DATA_OWNER_USER_ID_KEY, value: userId })
}

export async function clearLocalDataOwnerUserId(): Promise<void> {
  await db.metadata.delete(LOCAL_DATA_OWNER_USER_ID_KEY)
}

export async function getRecordVersion(collection: SyncCollection, id: string, transaction?: Transaction): Promise<number> {
  const table = getVersionTable(transaction)
  const row = await table.get([collection, id])
  return row?.version ?? 0
}

export async function setRecordVersion(
  collection: SyncCollection,
  id: string,
  version: number,
  transaction?: Transaction
): Promise<void> {
  const table = getVersionTable(transaction)
  await table.put({ collection, id, version })
}

export async function setRecordVersionsBulk(
  entries: Array<{ collection: SyncCollection; id: string; version: number }>,
  transaction?: Transaction
): Promise<void> {
  if (entries.length === 0) return
  const table = getVersionTable(transaction)
  await table.bulkPut(entries)
}

export async function rebasePendingChangesFromAccepted(
  entries: Array<{ collection: SyncCollection; id: string; version: number; mutationId: string }>
): Promise<void> {
  if (entries.length === 0) return

  await db.transaction("rw", db.syncPendingChanges, async () => {
    await Promise.all(
      entries.map(async (entry) => {
        const key: [string, string] = [entry.collection, entry.id]
        const current = await db.syncPendingChanges.get(key)
        if (!current) return
        if (current.mutationId === entry.mutationId) return
        if (current.baseVersion >= entry.version) return

        await db.syncPendingChanges.put({
          ...current,
          baseVersion: entry.version,
        })
      })
    )
  })
}

export async function clearSyncMetadata(): Promise<void> {
  await db.transaction("rw", [db.metadata, db.syncPendingChanges, db.syncRecordVersions], async () => {
    await db.metadata.delete(PULL_CURSOR_KEY)
    await db.metadata.delete(LAST_SYNCED_AT_KEY)
    await db.syncPendingChanges.clear()
    await db.syncRecordVersions.clear()
  })
  queuePendingCountRefresh()
}

function isSyncCursor(value: unknown): value is SyncCursor {
  if (!isRecord(value)) return false
  return typeof value.version === "number"
}

function isSyncCollection(value: string): value is SyncCollection {
  return syncCollections.has(value)
}
