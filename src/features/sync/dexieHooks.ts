import { db } from "@/services/db"
import { TABLE_TO_COLLECTION, type SyncableTableName } from "@/features/sync/types"
import { enqueueChangeInTransaction } from "@/features/sync/changeTracker"

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
      if (areHooksSuppressed()) return
      if (!shouldTrackRecord(tableName, obj)) return

      const now = Date.now()
      if (isRecord(obj)) {
        obj.updatedAt = now
      }

      const id = resolveChangeId(tableName, primKey, obj)
      if (!id) return

      return enqueueChangeInTransaction(
        {
          collection: TABLE_TO_COLLECTION[tableName],
          id,
          updatedAt: now,
          deleted: false,
        },
        transaction
      )
    })

    table.hook("updating", (mods, primKey, obj, transaction) => {
      if (areHooksSuppressed()) return
      if (!shouldTrackRecord(tableName, obj)) return
      if (!isRecord(mods)) return
      const modsRecord = mods
      if (shouldIgnoreUpdate(tableName, modsRecord)) return

      const now = Date.now()
      const id = resolveChangeId(tableName, primKey, obj)
      if (!id) return

      const updatedMods = { ...modsRecord, updatedAt: now }

      return enqueueChangeInTransaction(
        {
          collection: TABLE_TO_COLLECTION[tableName],
          id,
          updatedAt: now,
          deleted: false,
        },
        transaction
      ).then(() => updatedMods)
    })

    table.hook("deleting", (primKey, obj, transaction) => {
      if (areHooksSuppressed()) return
      if (!shouldTrackRecord(tableName, obj)) return

      const now = Date.now()
      const id = resolveChangeId(tableName, primKey, obj)
      if (!id) return

      return enqueueChangeInTransaction(
        {
          collection: TABLE_TO_COLLECTION[tableName],
          id,
          updatedAt: now,
          deleted: true,
        },
        transaction
      )
    })
  })
}

export async function withSyncHooksSuppressed<T>(fn: () => Promise<T>): Promise<T> {
  suppressionDepth += 1
  try {
    return await fn()
  } finally {
    suppressionDepth = Math.max(0, suppressionDepth - 1)
  }
}

export function areHooksSuppressed(): boolean {
  return suppressionDepth > 0
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
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
  if (!isRecord(obj)) return false
  return obj.isCustom === true
}

function shouldIgnoreUpdate(tableName: SyncableTableName, mods: Record<string, unknown>): boolean {
  const keys = Object.keys(mods)
  if (keys.length === 0) return true

  if (tableName === "foods") {
    const meaningful = keys.filter((key) => key !== "usageCount" && key !== "updatedAt")
    return meaningful.length === 0
  }

  if (tableName === "workoutSessions") {
    const meaningful = keys.filter((key) => key !== "exerciseIds" && key !== "updatedAt")
    return meaningful.length === 0
  }

  return false
}
