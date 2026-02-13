import { db } from "@/services/db"
import { pushChanges } from "@/features/sync/api"
import {
  acknowledgeProcessedPendingChanges,
  getRecordVersion,
  listPendingChanges,
  rebasePendingChangesFromAccepted,
  removePendingChanges,
  setRecordVersionsBulk,
} from "@/features/sync/changeTracker"
import type { PendingChange } from "@/features/sync/types"
import type { PushChange, SyncCollection } from "@/features/sync/schemas"
import { toCloudRecord } from "@/features/sync/projection"
import { getDeviceId } from "@/features/sync/deviceId"
import { useSyncStore } from "@/features/sync/store"
import { getLocalRecord } from "@/features/sync/engine/applyPipeline"
import { ACTIVE_SESSION_ID } from "@/lib/constants"
import { pullAllChanges } from "@/features/sync/engine/pullPipeline"
import { shouldAcknowledgePushConflict } from "@/features/sync/conflictPolicy"
import { runSequentially } from "../../../../shared/asyncUtils"

const MAX_PUSH_BATCH = 200

type PreparedPending = { pending: PendingChange; change: PushChange | null }

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
  const acceptedVersionEntries: Array<{ collection: SyncCollection; id: string; version: number }> = []
  const acceptedPendingKeys: Array<{ collection: SyncCollection; id: string }> = []

  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })
    if (response.conflicts.length > 0 && conflictMode === "error") {
      const conflictIds = response.conflicts
        .map((conflict) => `${conflict.collection}:${conflict.id} (${conflict.reason})`)
        .join(", ")
      throw new Error(`Full snapshot push conflicted on ${conflictIds}`)
    }

    const acceptedChunkVersions = response.acceptedChanges.map((item) => ({
      collection: item.collection,
      id: item.id,
      version: item.version,
    }))
    const acceptedChunkPendingKeys = response.acceptedChanges.map((item) => ({
      collection: item.collection,
      id: item.id,
    }))

    if (conflictMode === "error") {
      acceptedVersionEntries.push(...acceptedChunkVersions)
      acceptedPendingKeys.push(...acceptedChunkPendingKeys)
      return
    }

    await setRecordVersionsBulk(acceptedChunkVersions)
    await removePendingChanges(acceptedChunkPendingKeys)
  })

  if (conflictMode === "error") {
    await setRecordVersionsBulk(acceptedVersionEntries)
    await removePendingChanges(acceptedPendingKeys)
  }
}

export async function mergeCloudAndLocal(accessToken: string): Promise<void> {
  const remote = await pullAllChanges(accessToken, { cursor: { version: 0 } })
  const remoteState = buildRemoteState(remote.changes)
  const localChanges = await buildFullSnapshot()

  const mergeConflicts: Array<{ collection: SyncCollection; id: string }> = []
  const changesToPush: PushChange[] = []
  localChanges.forEach((localChange) => {
    const key = `${localChange.collection}:${localChange.id}`
    const remoteChange = remoteState.get(key)
    if (!remoteChange) {
      changesToPush.push({
        ...localChange,
        baseVersion: 0,
      })
      return
    }

    if (remoteChange.deleted) {
      changesToPush.push({
        ...localChange,
        baseVersion: remoteChange.version,
      })
      return
    }

    if (areJsonValuesEqual(remoteChange.data, localChange.data)) {
      return
    }

    mergeConflicts.push({ collection: localChange.collection, id: localChange.id })
  })

  if (mergeConflicts.length > 0) {
    const conflictIds = mergeConflicts.map((conflict) => `${conflict.collection}:${conflict.id}`).join(", ")
    throw new Error(`Merge requires manual resolution for ${conflictIds}`)
  }
  if (changesToPush.length === 0) return

  const chunks = chunkArray(changesToPush, MAX_PUSH_BATCH)
  const acceptedVersionEntries: Array<{ collection: SyncCollection; id: string; version: number }> = []
  const acceptedPendingKeys: Array<{ collection: SyncCollection; id: string }> = []
  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })
    if (response.conflicts.length > 0) {
      const conflictIds = response.conflicts
        .map((conflict) => `${conflict.collection}:${conflict.id} (${conflict.reason})`)
        .join(", ")
      throw new Error(`Merge push conflicted on ${conflictIds}`)
    }

    acceptedVersionEntries.push(
      ...response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
        version: item.version,
      }))
    )
    acceptedPendingKeys.push(
      ...response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
      }))
    )
  })

  await setRecordVersionsBulk(acceptedVersionEntries)
  await removePendingChanges(acceptedPendingKeys)
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

  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })

    // Track conflicts - "use-local" strategy should fully succeed
    if (response.conflicts.length > 0) {
      allConflicts.push(
        ...response.conflicts.map((c) => ({ collection: c.collection, id: c.id }))
      )
    }

    await setRecordVersionsBulk(
      response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
        version: item.version,
      }))
    )
    await removePendingChanges(
      response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
      }))
    )
  })

  // Fail if any conflicts occurred during "use-local" overwrite
  if (allConflicts.length > 0) {
    const conflictIds = allConflicts.map((c) => `${c.collection}:${c.id}`).join(", ")
    throw new Error(`Failed to overwrite cloud with local data. Conflicts on: ${conflictIds}`)
  }

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

function normalizeJsonValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item))
  }
  if (!isRecord(value)) {
    return value
  }

  const normalized: Record<string, unknown> = {}
  Object.keys(value)
    .toSorted()
    .forEach((key) => {
      normalized[key] = normalizeJsonValue(value[key])
    })
  return normalized
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
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
