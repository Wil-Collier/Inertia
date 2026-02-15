import type { SyncCollection } from "@/features/sync/schemas"
import { jsonDeepEqual } from "@/features/sync/jsonUtils"
import { isRecord } from "@/features/sync/typeGuards"
import { mergeNutritionEntriesLww } from "@/lib/nutritionEntryUtils"
import type { NutritionMealEntry } from "@/lib/types"

export type RemoteChangeState = {
  collection: SyncCollection
  id: string
  version: number
  deleted: boolean
  data: Record<string, unknown> | null
}

export function buildRemoteState(changes: RemoteChangeState[]): Map<string, RemoteChangeState> {
  const state = new Map<string, RemoteChangeState>()
  changes.forEach((change) => {
    const key = `${change.collection}:${change.id}`
    state.set(key, change)
  })
  return state
}

export function resolveMergeDecision(
  collection: SyncCollection,
  localData: Record<string, unknown> | null,
  remoteData: Record<string, unknown> | null
):
  | { action: "skip"; reason: "equal" | "remote-newer" }
  | { action: "push"; data: Record<string, unknown>; localWins: boolean; merged: boolean } {
  if (areJsonValuesEqual(localData, remoteData)) {
    return { action: "skip", reason: "equal" }
  }

  if (collection === "nutrition") {
    const { data: mergedData, localWins, merged } = mergeNutritionRecords(localData, remoteData)
    if (areJsonValuesEqual(mergedData, remoteData)) {
      return { action: "skip", reason: "remote-newer" }
    }
    return { action: "push", data: mergedData, localWins, merged }
  }

  const localUpdatedAt = getUpdatedAt(localData)
  const remoteUpdatedAt = getUpdatedAt(remoteData)
  if (localUpdatedAt === null && remoteUpdatedAt !== null) {
    return { action: "skip", reason: "remote-newer" }
  }
  if (localUpdatedAt !== null && remoteUpdatedAt !== null && localUpdatedAt < remoteUpdatedAt) {
    return { action: "skip", reason: "remote-newer" }
  }

  return {
    action: "push",
    data: localData ?? {},
    localWins: true,
    merged: false,
  }
}

function areJsonValuesEqual(a: unknown, b: unknown): boolean {
  return jsonDeepEqual(a, b, { sortKeys: true, stripTopLevelUpdatedAt: true })
}

function mergeNutritionRecords(
  localData: Record<string, unknown> | null,
  remoteData: Record<string, unknown> | null
): { data: Record<string, unknown>; localWins: boolean; merged: boolean } {
  const localEntries = readNutritionEntries(localData)
  const remoteEntries = readNutritionEntries(remoteData)
  const mergedEntries = mergeNutritionEntriesLww(localEntries, remoteEntries)
  const winner = compareRecordFreshness(localData, remoteData)
  const equalsLocalEntries = areJsonValuesEqual(mergedEntries, localEntries)
  const equalsRemoteEntries = areJsonValuesEqual(mergedEntries, remoteEntries)

  const updatedAt = Math.max(getUpdatedAt(localData) ?? 0, getUpdatedAt(remoteData) ?? 0)
  const remoteRecord = isRecord(remoteData) ? remoteData : {}
  const localRecord = isRecord(localData) ? localData : {}
  const baseRecord = winner === "remote"
    ? { ...localRecord, ...remoteRecord }
    : { ...remoteRecord, ...localRecord }

  return {
    data: {
      ...baseRecord,
      entries: mergedEntries,
      ...(updatedAt > 0 ? { updatedAt } : {}),
    },
    localWins: equalsLocalEntries || (!equalsRemoteEntries && winner !== "remote"),
    merged: !equalsLocalEntries && !equalsRemoteEntries,
  }
}

function readNutritionEntries(data: Record<string, unknown> | null): NutritionMealEntry[] {
  if (!isRecord(data) || !Array.isArray(data.entries)) return []
  return data.entries.filter(
    (entry): entry is NutritionMealEntry =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      typeof entry.foodId === "string" &&
      typeof entry.quantity === "number" &&
      typeof entry.mealType === "string" &&
      typeof entry.updatedAt === "number"
  )
}

function getUpdatedAt(data: Record<string, unknown> | null): number | null {
  if (!isRecord(data)) return null
  return typeof data.updatedAt === "number" ? data.updatedAt : null
}

function compareRecordFreshness(
  localData: Record<string, unknown> | null,
  remoteData: Record<string, unknown> | null
): "local" | "remote" | "tie" {
  const localUpdatedAt = getUpdatedAt(localData)
  const remoteUpdatedAt = getUpdatedAt(remoteData)
  if (localUpdatedAt === null && remoteUpdatedAt === null) return "tie"
  if (localUpdatedAt === null) return "remote"
  if (remoteUpdatedAt === null) return "local"
  if (localUpdatedAt === remoteUpdatedAt) return "tie"
  return localUpdatedAt > remoteUpdatedAt ? "local" : "remote"
}
