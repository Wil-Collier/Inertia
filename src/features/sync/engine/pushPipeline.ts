import { db } from "@/services/db"
import { pushChanges } from "@/features/sync/api"
import {
  acknowledgeProcessedPendingChanges,
  getRecordVersion,
  listPendingChanges,
  rebasePendingChangesFromAccepted,
  setRecordVersionsBulk,
} from "@/features/sync/changeTracker"
import type { PendingChange } from "@/features/sync/types"
import { MAX_PUSH_BATCH, type PushChange, type SyncCollection } from "@/features/sync/schemas"
import { toCloudRecord } from "@/features/sync/projection"
import { isRecord } from "@/features/sync/typeGuards"
import { getDeviceId } from "@/features/sync/deviceId"
import { useSyncStore } from "@/features/sync/store"
import { getLocalRecord } from "@/features/sync/engine/applyPipeline"
import { ACTIVE_SESSION_ID } from "@/lib/constants"
import { pullAllChanges } from "@/features/sync/engine/pullPipeline"
import { shouldAcknowledgePushConflict } from "@/features/sync/conflictPolicy"
import { runSequentially } from "../../../../shared/asyncUtils"

type PreparedPending = { pending: PendingChange; change: PushChange | null }
type AcceptedEntry = { collection: SyncCollection; id: string; version: number; mutationId: string }

export interface MergeCloudAndLocalResult {
  pushed: number
  localWins: number
  remoteWins: number
  mergedRecords: number
  skippedEqual: number
}

export async function pushPendingChangesInternal(accessToken: string, updateStatus: boolean): Promise<void> {
  const pending = await listPendingChanges()
  if (pending.length === 0) return

  const prepared = await buildPushChangesFromPending(pending)
  const toSend = prepared.filter((entry) => entry.change !== null)
  const chunks = chunkArray(toSend, MAX_PUSH_BATCH)

  await runSequentially(chunks, async (chunk) => {
    const changes = chunk.map((entry) => entry.change!)
    if (changes.length === 0) return

    const response = await pushChanges(accessToken, { changes })
    if (response.conflicts.length > 0 && updateStatus) {
      useSyncStore.getState().setConflicts(response.conflicts)
    }

    const acceptedVersions = response.acceptedChanges.map((item) => ({
      collection: item.collection,
      id: item.id,
      version: item.version,
    }))
    await setRecordVersionsBulk(acceptedVersions)
    await rebasePendingChangesFromAccepted(
      response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
        version: item.version,
        mutationId: item.mutationId,
      }))
    )

    const processedKeys = new Set<string>()
    response.acceptedChanges.forEach((item) => {
      processedKeys.add(`${item.collection}:${item.id}`)
    })
    response.conflicts.forEach((item) => {
      if (shouldAcknowledgePushConflict(item)) {
        processedKeys.add(`${item.collection}:${item.id}`)
      }
    })

    await acknowledgeProcessedPendingChanges(
      chunk
        .filter((entry) => processedKeys.has(`${entry.pending.collection}:${entry.pending.id}`))
        .map((entry) => ({
          collection: entry.pending.collection,
          id: entry.pending.id,
          mutationId: entry.pending.mutationId,
        }))
    )
  })
}

export async function pushFullSnapshot(
  accessToken: string,
  options: { conflictMode?: "ignore" | "error" } = {}
): Promise<void> {
  const changes = await buildFullSnapshot()
  if (changes.length === 0) return
  const conflictMode = options.conflictMode ?? "ignore"

  const chunks = chunkArray(changes, MAX_PUSH_BATCH)
  const acceptedEntries: AcceptedEntry[] = []

  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })
    if (response.conflicts.length > 0 && conflictMode === "error") {
      const conflictIds = response.conflicts
        .map((conflict) => `${conflict.collection}:${conflict.id} (${conflict.reason})`)
        .join(", ")
      throw new Error(`Full snapshot push conflicted on ${conflictIds}`)
    }

    const acceptedChunkEntries = response.acceptedChanges.map((item) => ({
      collection: item.collection,
      id: item.id,
      version: item.version,
      mutationId: item.mutationId,
    }))

    if (conflictMode === "error") {
      acceptedEntries.push(...acceptedChunkEntries)
      return
    }

    await acknowledgeAcceptedEntries(acceptedChunkEntries)
  })

  if (conflictMode === "error") {
    await acknowledgeAcceptedEntries(acceptedEntries)
  }
}

export async function mergeCloudAndLocal(accessToken: string): Promise<MergeCloudAndLocalResult> {
  const remote = await pullAllChanges(accessToken, { cursor: { version: 0 } })
  const remoteState = buildRemoteState(remote.changes)
  const localChanges = await buildFullSnapshot()

  let localWins = 0
  let remoteWins = 0
  let mergedRecords = 0
  let skippedEqual = 0
  const changesToPush: PushChange[] = []
  localChanges.forEach((localChange) => {
    const key = `${localChange.collection}:${localChange.id}`
    const remoteChange = remoteState.get(key)
    if (!remoteChange) {
      changesToPush.push({
        ...localChange,
        baseVersion: 0,
      })
      localWins += 1
      return
    }

    if (remoteChange.deleted) {
      changesToPush.push({
        ...localChange,
        baseVersion: remoteChange.version,
      })
      localWins += 1
      return
    }

    const decision = resolveMergeDecision(localChange.collection, localChange.data, remoteChange.data)
    if (decision.action === "skip") {
      if (decision.reason === "equal") {
        skippedEqual += 1
      } else {
        remoteWins += 1
      }
      return
    }

    changesToPush.push({
      ...localChange,
      data: decision.data,
      baseVersion: remoteChange.version,
    })
    if (decision.merged) {
      mergedRecords += 1
    } else if (decision.localWins) {
      localWins += 1
    } else {
      remoteWins += 1
    }
  })

  if (changesToPush.length === 0) {
    return {
      pushed: 0,
      localWins,
      remoteWins,
      mergedRecords,
      skippedEqual,
    }
  }

  const chunks = chunkArray(changesToPush, MAX_PUSH_BATCH)
  const acceptedEntries: AcceptedEntry[] = []
  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })
    if (response.conflicts.length > 0) {
      const conflictIds = response.conflicts
        .map((conflict) => `${conflict.collection}:${conflict.id} (${conflict.reason})`)
        .join(", ")
      throw new Error(`Merge push conflicted on ${conflictIds}`)
    }

    acceptedEntries.push(
      ...response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
        version: item.version,
        mutationId: item.mutationId,
      }))
    )
  })

  await acknowledgeAcceptedEntries(acceptedEntries)
  return {
    pushed: changesToPush.length,
    localWins,
    remoteWins,
    mergedRecords,
    skippedEqual,
  }
}

export async function overwriteCloudWithLocal(accessToken: string): Promise<void> {
  const remote = await pullAllChanges(accessToken, { cursor: { version: 0 } })
  const remoteState = buildRemoteState(remote.changes)

  const localChanges = await buildFullSnapshot()
  const localKeys = new Set(localChanges.map((change) => `${change.collection}:${change.id}`))

  const deviceId = getDeviceId()
  const tombstones: PushChange[] = []
  remoteState.forEach((state, key) => {
    if (state.deleted) return
    if (localKeys.has(key)) return

    tombstones.push({
      collection: state.collection,
      id: state.id,
      data: null,
      baseVersion: state.version,
      mutationId: crypto.randomUUID(),
      deviceId,
    })
  })

  const combined = [...tombstones, ...localChanges]
  const chunks = chunkArray(combined, MAX_PUSH_BATCH)
  const allConflicts: Array<{ collection: string; id: string }> = []
  const acceptedEntries: AcceptedEntry[] = []

  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })

    // Track conflicts - "use-local" strategy should fully succeed
    if (response.conflicts.length > 0) {
      allConflicts.push(
        ...response.conflicts.map((c) => ({ collection: c.collection, id: c.id }))
      )
    }

    acceptedEntries.push(
      ...response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
        version: item.version,
        mutationId: item.mutationId,
      }))
    )
  })

  // Fail if any conflicts occurred during "use-local" overwrite
  if (allConflicts.length > 0) {
    const conflictIds = allConflicts.map((c) => `${c.collection}:${c.id}`).join(", ")
    throw new Error(`Failed to overwrite cloud with local data. Conflicts on: ${conflictIds}`)
  }

  await acknowledgeAcceptedEntries(acceptedEntries)
}

function buildRemoteState(changes: Array<{ collection: SyncCollection; id: string; version: number; deleted: boolean; data: Record<string, unknown> | null }>): Map<
  string,
  { collection: SyncCollection; id: string; version: number; deleted: boolean; data: Record<string, unknown> | null }
> {
  const state = new Map<
    string,
    { collection: SyncCollection; id: string; version: number; deleted: boolean; data: Record<string, unknown> | null }
  >()
  changes.forEach((change) => {
    const key = `${change.collection}:${change.id}`
    state.set(key, {
      collection: change.collection,
      id: change.id,
      version: change.version,
      deleted: change.deleted,
      data: change.data,
    })
  })
  return state
}

function areJsonValuesEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(normalizeJsonValue(a)) === JSON.stringify(normalizeJsonValue(b))
}

function normalizeJsonValue(value: unknown, depth = 0): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item, depth + 1))
  }
  if (!isRecord(value)) {
    return value
  }

  const normalized: Record<string, unknown> = {}
  Object.keys(value)
    .toSorted()
    .forEach((key) => {
      if (depth === 0 && key === "updatedAt") return
      normalized[key] = normalizeJsonValue(value[key], depth + 1)
    })
  return normalized
}

function resolveMergeDecision(
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

function mergeNutritionRecords(
  localData: Record<string, unknown> | null,
  remoteData: Record<string, unknown> | null
): { data: Record<string, unknown>; localWins: boolean; merged: boolean } {
  const localEntries = readNutritionEntries(localData)
  const remoteEntries = readNutritionEntries(remoteData)
  const winner = compareRecordFreshness(localData, remoteData)
  const preferLocalOnConflict = winner !== "remote"
  const mergedEntries = [...remoteEntries]
  const indexById = new Map(
    remoteEntries.map((entry, index) => [typeof entry.id === "string" ? entry.id : `idx:${index}`, index])
  )
  let addedLocalEntries = 0
  let replacedWithLocal = 0

  localEntries.forEach((entry, index) => {
    const entryId = typeof entry.id === "string" ? entry.id : `local:${index}`
    const existingIndex = indexById.get(entryId)
    if (existingIndex === undefined) {
      indexById.set(entryId, mergedEntries.length)
      mergedEntries.push(entry)
      addedLocalEntries += 1
      return
    }

    if (!preferLocalOnConflict) {
      return
    }

    if (!areJsonValuesEqual(mergedEntries[existingIndex], entry)) {
      replacedWithLocal += 1
      mergedEntries[existingIndex] = entry
    }
  })

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
    localWins: addedLocalEntries + replacedWithLocal > 0 && winner !== "remote",
    merged: addedLocalEntries > 0 && remoteEntries.length > 0,
  }
}

function readNutritionEntries(data: Record<string, unknown> | null): Array<Record<string, unknown>> {
  if (!isRecord(data) || !Array.isArray(data.entries)) return []
  return data.entries.filter((entry): entry is Record<string, unknown> => isRecord(entry))
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

async function acknowledgeAcceptedEntries(entries: AcceptedEntry[]): Promise<void> {
  if (entries.length === 0) return
  await setRecordVersionsBulk(
    entries.map((entry) => ({
      collection: entry.collection,
      id: entry.id,
      version: entry.version,
    }))
  )
  await rebasePendingChangesFromAccepted(entries)
  await acknowledgeProcessedPendingChanges(
    entries.map((entry) => ({
      collection: entry.collection,
      id: entry.id,
      mutationId: entry.mutationId,
    }))
  )
}

async function buildPushChangesFromPending(pending: PendingChange[]): Promise<PreparedPending[]> {
  const deviceId = getDeviceId()
  return await Promise.all(
    pending.map(async (change) => {
      const knownVersion = await getRecordVersion(change.collection, change.id)
      const baseVersion = Math.max(change.baseVersion, knownVersion)

      if (change.deleted) {
        return {
          pending: change,
          change: {
            collection: change.collection,
            id: change.id,
            data: null,
            baseVersion,
            mutationId: change.mutationId,
            deviceId,
          },
        }
      }

      const record = await getLocalRecord(change.collection, change.id)
      if (!record) {
        return {
          pending: change,
          change: {
            collection: change.collection,
            id: change.id,
            data: null,
            baseVersion,
            mutationId: change.mutationId,
            deviceId,
          },
        }
      }

      const data = toCloudRecord(change.collection, record)
      if (!data) {
        return { pending: change, change: null }
      }

      return {
        pending: change,
        change: {
          collection: change.collection,
          id: change.id,
          data,
          baseVersion,
          mutationId: change.mutationId,
          deviceId,
        },
      }
    })
  )
}

async function buildFullSnapshot(): Promise<PushChange[]> {
  const [
    workouts,
    activeSession,
    templates,
    foods,
    nutrition,
    mealTemplates,
    bodyWeight,
    settings,
    exercises,
  ] = await Promise.all([
    db.workoutSessions.toArray(),
    db.activeSession.get(ACTIVE_SESSION_ID),
    db.workoutTemplates.toArray(),
    db.foods.toArray(),
    db.nutritionLogs.toArray(),
    db.mealTemplates.toArray(),
    db.bodyWeight.toArray(),
    db.settings.get("settings"),
    db.customExercises.toArray(),
  ])

  const deviceId = getDeviceId()
  const changes: PushChange[] = []

  const pushRecord = async (collection: SyncCollection, id: string, record: unknown) => {
    const data = toCloudRecord(collection, record)
    if (!data) return
    const baseVersion = await getRecordVersion(collection, id)
    changes.push({
      collection,
      id,
      data,
      baseVersion,
      mutationId: crypto.randomUUID(),
      deviceId,
    })
  }

  await Promise.all([
    ...workouts.map((workout) => pushRecord("workouts", workout.id, workout)),
    ...(activeSession ? [pushRecord("activeSession", ACTIVE_SESSION_ID, activeSession)] : []),
    ...templates.map((template) => pushRecord("templates", template.id, template)),
    ...foods.map((food) => pushRecord("foods", food.id, food)),
    ...nutrition.map((log) => pushRecord("nutrition", log.date, log)),
    ...mealTemplates.map((template) => pushRecord("mealTemplates", template.id, template)),
    ...bodyWeight.map((entry) => pushRecord("weight", entry.id, entry)),
    ...exercises.map((exercise) => pushRecord("exercises", exercise.id, exercise)),
    ...(settings ? [pushRecord("settings", "settings", settings)] : []),
  ])

  return changes
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
