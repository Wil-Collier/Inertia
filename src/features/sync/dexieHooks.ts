import Dexie, { type Transaction } from "dexie"
import { db } from "@/services/db"
import { TABLE_TO_COLLECTION, type SyncableTableName } from "@/features/sync/types"
import {
  enqueuePendingChange,
  enqueuePendingChangeInTransaction,
  getRecordVersion,
} from "@/features/sync/changeTracker"
import { jsonDeepEqual } from "@/features/sync/jsonUtils"
import { isRecord } from "@/features/sync/typeGuards"

let hooksRegistered = false
let suppressionDepth = 0

export function registerSyncDexieHooks(): void {
  if (hooksRegistered) return
  hooksRegistered = true

  Object.keys(TABLE_TO_COLLECTION).forEach((tableName) => {
    if (!isSyncableTableName(tableName)) return
    const table = db[tableName]
    if (!table) return

    table.hook("creating", (primKey, obj, transaction) => {
      if (isHooksSuppressed()) return
      if (!shouldTrackRecord(tableName, obj)) return

      const now = Date.now()
      if (isRecord(obj)) {
        obj.updatedAt = now
      }

      const id = resolveChangeId(tableName, primKey, obj)
      if (!id) return

      queuePendingChange({
        collection: TABLE_TO_COLLECTION[tableName],
        id,
        deleted: false,
        transaction,
      })
    })

    table.hook("updating", (mods, primKey, obj, transaction) => {
      if (isHooksSuppressed()) return
      if (!shouldTrackRecord(tableName, obj)) return
      if (!isRecord(mods)) return
      const modsRecord = mods
      if (shouldIgnoreUpdate(tableName, modsRecord, obj)) return

      const now = Date.now()
      const id = resolveChangeId(tableName, primKey, obj)
      if (!id) return

      queuePendingChange({
        collection: TABLE_TO_COLLECTION[tableName],
        id,
        deleted: false,
        transaction,
      })

      return { ...modsRecord, updatedAt: now }
    })

    table.hook("deleting", (primKey, obj, transaction) => {
      if (isHooksSuppressed()) return
      if (!shouldTrackRecord(tableName, obj)) return

      const id = resolveChangeId(tableName, primKey, obj)
      if (!id) return

      queuePendingChange({
        collection: TABLE_TO_COLLECTION[tableName],
        id,
        deleted: true,
        transaction,
      })
    })
  })
}

type QueuePendingArgs = {
  collection: (typeof TABLE_TO_COLLECTION)[SyncableTableName]
  id: string
  deleted: boolean
  transaction: Transaction
}

function queuePendingChange(args: QueuePendingArgs): void {
  if (transactionHasSyncStores(args.transaction)) {
    const enqueuePromise = (async () => {
      const baseVersion = await getRecordVersion(args.collection, args.id, args.transaction)
      await enqueuePendingChangeInTransaction(
        {
          collection: args.collection,
          id: args.id,
          deleted: args.deleted,
          baseVersion,
          mutationId: crypto.randomUUID(),
          enqueuedAt: Date.now(),
        },
        args.transaction
      )
    })()

    // Keep the write transaction open until pending change bookkeeping is persisted.
    void Dexie.waitFor(enqueuePromise).catch((error: unknown) => {
      console.error("[Sync] Failed to enqueue pending change in transaction", error)
    })
    return
  }

  if (import.meta.env.DEV) {
    console.warn(
      `[Sync] Non-atomic sync tracking fallback for ${args.collection}/${args.id}. Include syncPendingChanges and syncRecordVersions in the write transaction.`
    )
  }

  args.transaction.on("complete", () => {
    void (async () => {
      const baseVersion = await getRecordVersion(args.collection, args.id)
      await enqueuePendingChange({
        collection: args.collection,
        id: args.id,
        deleted: args.deleted,
        baseVersion,
        mutationId: crypto.randomUUID(),
        enqueuedAt: Date.now(),
      })
    })().catch((error) => {
      console.error("[Sync] Failed to enqueue pending change after commit", error)
    })
  })
}

function transactionHasSyncStores(transaction: Transaction): boolean {
  return (
    transaction.storeNames.includes("syncPendingChanges") &&
    transaction.storeNames.includes("syncRecordVersions")
  )
}

export async function withSyncHooksSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressionDepth += 1
  try {
    return await fn()
  } finally {
    suppressionDepth = Math.max(0, suppressionDepth - 1)
  }
}

function isHooksSuppressed(): boolean {
  return suppressionDepth > 0
}

function isSyncableTableName(value: string): value is SyncableTableName {
  return value in TABLE_TO_COLLECTION
}

function resolveChangeId(tableName: SyncableTableName, primKey: unknown, obj: unknown): string | null {
  if (typeof primKey === "string" && primKey.length > 0) return primKey
  if (typeof primKey === "number") return String(primKey)

  if (isRecord(obj)) {
    if (typeof obj.id === "string" && obj.id.length > 0) return obj.id
    if (typeof obj.date === "string" && obj.date.length > 0) return obj.date
  }

  console.warn(`[Sync] Unable to resolve id for ${tableName}`)
  return null
}

function shouldTrackRecord(tableName: SyncableTableName, obj: unknown): boolean {
  if (tableName !== "foods") return true
  return isRecord(obj)
}

function shouldIgnoreUpdate(tableName: SyncableTableName, mods: Record<string, unknown>, current?: unknown): boolean {
  const keys = Object.keys(mods)
  if (keys.length === 0) return true

  if (tableName === "foods") {
    const meaningful = keys.filter((key) => !isFoodDerivedKey(key))
    return meaningful.length === 0
  }

  if (tableName === "workoutSessions") {
    if (isDerivedWorkoutRebuildOnly(mods, current)) {
      return true
    }

    const meaningful = keys.filter((key) => !isWorkoutDerivedKey(key))
    return meaningful.length === 0
  }

  return false
}

function isFoodDerivedKey(key: string): boolean {
  return key === "usageCount" || key.startsWith("usageCount.") || key === "updatedAt"
}

function isWorkoutDerivedKey(key: string): boolean {
  return key === "id" || key === "exerciseIds" || key.startsWith("exerciseIds.") || key === "updatedAt"
}

function isDerivedWorkoutRebuildOnly(mods: Record<string, unknown>, current?: unknown): boolean {
  const keys = Object.keys(mods)
  const onlyRebuildKeys = keys.every((key) => key === "exerciseIds" || key.startsWith("exerciseIds.") || key === "exercises")
  if (!onlyRebuildKeys) return false

  if (!isRecord(current)) return false
  return jsonDeepEqual(mods.exercises, current.exercises)
}
