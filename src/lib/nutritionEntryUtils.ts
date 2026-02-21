import { jsonDeepEqual } from "@/features/sync/model/jsonUtils"
import type { NutritionMealEntry } from "@/lib/types"

function normalizeDeletedAt(value: number | undefined): number | undefined {
  return typeof value === "number" ? value : undefined
}

function normalizeEntry(entry: NutritionMealEntry): NutritionMealEntry {
  const deletedAt = normalizeDeletedAt(entry.deletedAt)
  if (deletedAt === undefined) {
    const { deletedAt: _deletedAt, ...rest } = entry
    return rest
  }

  return {
    ...entry,
    deletedAt,
  }
}

function canonicalEntry(entry: NutritionMealEntry): string {
  const normalized = normalizeEntry(entry)
  return JSON.stringify(normalized, Object.keys(normalized).toSorted())
}

function chooseWinningEntry(local: NutritionMealEntry, remote: NutritionMealEntry): NutritionMealEntry {
  if (local.updatedAt > remote.updatedAt) return local
  if (remote.updatedAt > local.updatedAt) return remote

  const localDeleted = isEntryDeleted(local)
  const remoteDeleted = isEntryDeleted(remote)
  if (localDeleted !== remoteDeleted) {
    return localDeleted ? local : remote
  }

  const localCanonical = canonicalEntry(local)
  const remoteCanonical = canonicalEntry(remote)
  if (localCanonical === remoteCanonical) return local
  return localCanonical > remoteCanonical ? local : remote
}

export function isEntryDeleted(entry: NutritionMealEntry): boolean {
  return typeof entry.deletedAt === "number"
}

export function getActiveEntries(entries: NutritionMealEntry[]): NutritionMealEntry[] {
  return entries.filter((entry) => !isEntryDeleted(entry))
}

export function stampEntryUpdatedAt(entry: NutritionMealEntry, now: number): NutritionMealEntry {
  const { deletedAt: _deletedAt, ...rest } = entry
  return {
    ...rest,
    updatedAt: now,
  }
}

export function toDeletedEntry(entry: NutritionMealEntry, now: number): NutritionMealEntry {
  return {
    ...entry,
    updatedAt: now,
    deletedAt: now,
  }
}

export function mergeNutritionEntriesLww(
  localEntries: NutritionMealEntry[],
  remoteEntries: NutritionMealEntry[]
): NutritionMealEntry[] {
  const merged = new Map<string, NutritionMealEntry>()

  for (const entry of remoteEntries) {
    merged.set(entry.id, normalizeEntry(entry))
  }

  for (const localEntry of localEntries) {
    const normalizedLocal = normalizeEntry(localEntry)
    const existing = merged.get(normalizedLocal.id)
    if (!existing) {
      merged.set(normalizedLocal.id, normalizedLocal)
      continue
    }

    if (jsonDeepEqual(existing, normalizedLocal)) {
      merged.set(normalizedLocal.id, normalizedLocal)
      continue
    }

    merged.set(normalizedLocal.id, chooseWinningEntry(normalizedLocal, existing))
  }

  return [...merged.values()].toSorted((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return left.updatedAt - right.updatedAt
    }
    return left.id.localeCompare(right.id)
  })
}
