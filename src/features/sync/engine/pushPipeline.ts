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
import { MAX_PUSH_BATCH, type PushAcceptedChange, type PushChange, type PushConflict, type SyncCollection } from "@/features/sync/schemas"
import { toCloudRecord } from "@/features/sync/projection"
import { getDeviceId } from "@/features/sync/deviceId"
import { useSyncStore } from "@/features/sync/store"
import { getLocalRecord } from "@/features/sync/localRecordAccess"
import { ACTIVE_SESSION_ID } from "@/lib/constants"
import { pullAllChanges } from "@/features/sync/engine/pullPipeline"
import { shouldAcknowledgePushConflict } from "@/features/sync/conflictPolicy"
import { buildRemoteState, resolveMergeDecision, type RemoteChangeState } from "@/features/sync/engine/mergeStrategy"
import { runSequentially } from "../../../../shared/asyncUtils"
import { toast } from "sonner"

type PreparedPending = { pending: PendingChange; change: PushChange | null }
type AcceptedEntry = { collection: SyncCollection; id: string; version: number; mutationId: string }
const MAX_OVERWRITE_ATTEMPTS = 3

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
      toast.error(
        response.conflicts.length === 1
          ? "1 change was overwritten by a newer version from another device"
          : `${response.conflicts.length} changes were overwritten by newer versions from another device`
      )
    }

    const acceptedEntries = toAcceptedEntries(response.acceptedChanges)
    await persistAcceptedEntries(acceptedEntries)
    const processedKeys = buildProcessedPendingKeys(response.acceptedChanges, response.conflicts)

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
  const deviceId = getDeviceId()
  await overwriteCloudWithLocalAttempt(accessToken, deviceId, 1)
}

async function acknowledgeAcceptedEntries(entries: AcceptedEntry[]): Promise<void> {
  await persistAcceptedEntries(entries)
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
  return await db.transaction(
    "r",
    [
      db.workoutSessions,
      db.activeSession,
      db.workoutTemplates,
      db.foods,
      db.nutritionLogs,
      db.mealTemplates,
      db.bodyWeight,
      db.settings,
      db.customExercises,
      db.syncRecordVersions,
    ],
    async (transaction) => {
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
        const baseVersion = await getRecordVersion(collection, id, transaction)
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
  )
}

function buildOverwriteBatch(
  localChanges: PushChange[],
  remoteState: Map<string, RemoteChangeState>,
  deviceId: string
): PushChange[] {
  const localKeys = new Set(localChanges.map((change) => `${change.collection}:${change.id}`))
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

  const localUpdates = localChanges.map((change) => {
    const remoteEntry = remoteState.get(`${change.collection}:${change.id}`)
    return {
      ...change,
      baseVersion: remoteEntry?.version ?? 0,
    }
  })

  return [...tombstones, ...localUpdates]
}

function toAcceptedEntries(acceptedChanges: PushAcceptedChange[]): AcceptedEntry[] {
  return acceptedChanges.map((change) => ({
    collection: change.collection,
    id: change.id,
    version: change.version,
    mutationId: change.mutationId,
  }))
}

async function persistAcceptedEntries(entries: AcceptedEntry[]): Promise<void> {
  if (entries.length === 0) return
  await setRecordVersionsBulk(
    entries.map((entry) => ({
      collection: entry.collection,
      id: entry.id,
      version: entry.version,
    }))
  )
  await rebasePendingChangesFromAccepted(entries)
}

function buildProcessedPendingKeys(acceptedChanges: PushAcceptedChange[], conflicts: PushConflict[]): Set<string> {
  const processedKeys = new Set<string>()
  acceptedChanges.forEach((change) => {
    processedKeys.add(`${change.collection}:${change.id}`)
  })
  conflicts.forEach((conflict) => {
    if (shouldAcknowledgePushConflict(conflict)) {
      processedKeys.add(`${conflict.collection}:${conflict.id}`)
    }
  })
  return processedKeys
}

async function overwriteCloudWithLocalAttempt(accessToken: string, deviceId: string, attempt: number): Promise<void> {
  const remote = await pullAllChanges(accessToken, { cursor: { version: 0 } })
  const remoteState = buildRemoteState(remote.changes)
  const localChanges = await buildFullSnapshot()
  const combined = buildOverwriteBatch(localChanges, remoteState, deviceId)

  const chunks = chunkArray(combined, MAX_PUSH_BATCH)
  const allConflicts: Array<Pick<PushConflict, "collection" | "id">> = []
  const acceptedEntries: AcceptedEntry[] = []

  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })
    if (response.conflicts.length > 0) {
      allConflicts.push(
        ...response.conflicts.map((conflict) => ({
          collection: conflict.collection,
          id: conflict.id,
        }))
      )
    }
    acceptedEntries.push(...toAcceptedEntries(response.acceptedChanges))
  })

  if (allConflicts.length === 0) {
    await acknowledgeAcceptedEntries(acceptedEntries)
    return
  }

  if (attempt >= MAX_OVERWRITE_ATTEMPTS) {
    const conflictIds = allConflicts.map((conflict) => `${conflict.collection}:${conflict.id}`).join(", ")
    throw new Error(`Failed to overwrite cloud with local data after ${MAX_OVERWRITE_ATTEMPTS} attempts. Conflicts on: ${conflictIds}`)
  }

  await overwriteCloudWithLocalAttempt(accessToken, deviceId, attempt + 1)
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
