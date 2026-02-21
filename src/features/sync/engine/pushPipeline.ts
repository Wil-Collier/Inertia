import { db } from "@/services/db"
import { pushChanges } from "@/features/sync/api"
import {
  acknowledgeProcessedPendingChanges,
  getRecordVersion,
  listPendingChanges,
  rebasePendingChangesFromAccepted,
  setRecordVersionsBulk,
} from "@/features/sync/changeTracker"
import { readAccessToken, type AccessTokenSource } from "@/features/sync/engine/accessTokenSource"
import { SYNC_COLLECTION_TABLES_WITH_VERSIONS } from "@/features/sync/engine/syncTables"
import type { PendingChange } from "@/features/sync/types"
import {
  MAX_PUSH_BATCH,
  type PushAcceptedChange,
  type PushChange,
  type PushConflict,
  type PushResponse,
  type SyncCollection,
} from "@/features/sync/schemas"
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
type PushablePreparedPending = PreparedPending & { change: PushChange }
type AcceptedEntry = { collection: SyncCollection; id: string; version: number; mutationId: string }
const MAX_OVERWRITE_ATTEMPTS = 3

export interface MergeCloudAndLocalResult {
  pushed: number
  localWins: number
  remoteWins: number
  mergedRecords: number
  skippedEqual: number
}

export async function pushPendingChangesInternal(
  accessTokenSource: AccessTokenSource,
  updateStatus: boolean,
  notifyConflictToasts = updateStatus
): Promise<void> {
  const pending = await listPendingChanges()
  if (pending.length === 0) return

  const prepared = await buildPushChangesFromPending(pending)
  const toSend = prepared.filter(isPushablePreparedPending)

  await pushChunkedEntries({
    entries: toSend,
    accessTokenSource,
    toPushChange: (entry) => entry.change,
    onChunk: async (chunk, response) => {
      if (response.conflicts.length > 0 && updateStatus) {
        useSyncStore.getState().setConflicts(response.conflicts)

        const overwriteConflicts = response.conflicts.filter((conflict) => conflict.reason === "VERSION_MISMATCH").length
        const tooLargeConflicts = response.conflicts.filter((conflict) => conflict.reason === "RECORD_TOO_LARGE").length
        const mutationIdReuseConflicts = response.conflicts.filter((conflict) => conflict.reason === "MUTATION_ID_REUSE").length
        const otherConflicts = response.conflicts.length - overwriteConflicts - tooLargeConflicts - mutationIdReuseConflicts

        if (notifyConflictToasts && overwriteConflicts > 0) {
          toast.error(
            overwriteConflicts === 1
              ? "1 change was overwritten by a newer version from another device"
              : `${overwriteConflicts} changes were overwritten by newer versions from another device`
          )
        }

        if (notifyConflictToasts && tooLargeConflicts > 0) {
          toast.error(
            tooLargeConflicts === 1
              ? "1 change was too large to sync and has been skipped"
              : `${tooLargeConflicts} changes were too large to sync and have been skipped`
          )
        }

        if (notifyConflictToasts && mutationIdReuseConflicts > 0) {
          toast.error(
            mutationIdReuseConflicts === 1
              ? "1 change was rejected due to a duplicate sync ID and has been skipped"
              : `${mutationIdReuseConflicts} changes were rejected due to duplicate sync IDs and have been skipped`
          )
        }

        if (notifyConflictToasts && otherConflicts > 0) {
          toast.error(
            otherConflicts === 1
              ? "1 change could not be synced and remains pending"
              : `${otherConflicts} changes could not be synced and remain pending`
          )
        }
      }

      const acceptedEntries = toAcceptedEntries(response.acceptedChanges)
      await persistAcceptedEntries(acceptedEntries)
      const processedKeys = buildProcessedPendingKeys(response.acceptedChanges, response.conflicts)

      const processedPendingEntries = chunk
        .filter((entry) => processedKeys.has(`${entry.pending.collection}:${entry.pending.id}`))
        .map((entry) => ({
          collection: entry.pending.collection,
          id: entry.pending.id,
          mutationId: entry.pending.mutationId,
        }))

      if (processedPendingEntries.length > 0) {
        await acknowledgeProcessedPendingChanges(processedPendingEntries)
      }
    },
  })
}

export async function pushFullSnapshot(
  accessTokenSource: AccessTokenSource,
  options: { conflictMode?: "ignore" | "error" } = {}
): Promise<void> {
  const changes = await buildFullSnapshot()
  if (changes.length === 0) return
  const conflictMode = options.conflictMode ?? "ignore"

  const acceptedEntries: AcceptedEntry[] = []

  await pushChunkedEntries({
    entries: changes,
    accessTokenSource,
    toPushChange: (change) => change,
    onChunk: async (_chunk, response) => {
      if (response.conflicts.length > 0 && conflictMode === "error") {
        const conflictIds = response.conflicts
          .map((conflict) => `${conflict.collection}:${conflict.id} (${conflict.reason})`)
          .join(", ")
        throw new Error(`Full snapshot push conflicted on ${conflictIds}`)
      }

      const acceptedChunkEntries = toAcceptedEntries(response.acceptedChanges)

      if (conflictMode === "error") {
        acceptedEntries.push(...acceptedChunkEntries)
        return
      }

      await acknowledgeAcceptedEntries(acceptedChunkEntries)
    },
  })

  if (conflictMode === "error") {
    await acknowledgeAcceptedEntries(acceptedEntries)
  }
}

export async function mergeCloudAndLocal(accessTokenSource: AccessTokenSource): Promise<MergeCloudAndLocalResult> {
  const remote = await pullAllChanges(accessTokenSource, { cursor: { version: 0 } })
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
        // TODO(sync): When remote wins, write the remote record to local storage immediately
        // (with version tracking) instead of waiting for a later pull pass. This avoids
        // a stale-local window if sync is interrupted between merge decision and pull/apply.
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

  const acceptedEntries: AcceptedEntry[] = []
  await pushChunkedEntries({
    entries: changesToPush,
    accessTokenSource,
    toPushChange: (change) => change,
    onChunk: async (_chunk, response) => {
      if (response.conflicts.length > 0) {
        const conflictIds = response.conflicts
          .map((conflict) => `${conflict.collection}:${conflict.id} (${conflict.reason})`)
          .join(", ")
        throw new Error(`Merge push conflicted on ${conflictIds}`)
      }

      acceptedEntries.push(...toAcceptedEntries(response.acceptedChanges))
    },
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

export async function overwriteCloudWithLocal(accessTokenSource: AccessTokenSource): Promise<void> {
  const deviceId = getDeviceId()
  await overwriteCloudWithLocalAttempt(accessTokenSource, deviceId, 1)
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
    SYNC_COLLECTION_TABLES_WITH_VERSIONS,
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

async function overwriteCloudWithLocalAttempt(
  accessTokenSource: AccessTokenSource,
  deviceId: string,
  attempt: number
): Promise<void> {
  const remote = await pullAllChanges(accessTokenSource, { cursor: { version: 0 } })
  const remoteState = buildRemoteState(remote.changes)
  const localChanges = await buildFullSnapshot()
  const combined = buildOverwriteBatch(localChanges, remoteState, deviceId)

  const allConflicts: Array<Pick<PushConflict, "collection" | "id">> = []
  const acceptedEntries: AcceptedEntry[] = []

  await pushChunkedEntries({
    entries: combined,
    accessTokenSource,
    toPushChange: (change) => change,
    onChunk: async (_chunk, response) => {
      if (response.conflicts.length > 0) {
        allConflicts.push(
          ...response.conflicts.map((conflict) => ({
            collection: conflict.collection,
            id: conflict.id,
          }))
        )
      }
      acceptedEntries.push(...toAcceptedEntries(response.acceptedChanges))
    },
  })

  if (allConflicts.length === 0) {
    await acknowledgeAcceptedEntries(acceptedEntries)
    return
  }

  if (attempt >= MAX_OVERWRITE_ATTEMPTS) {
    const conflictIds = allConflicts.map((conflict) => `${conflict.collection}:${conflict.id}`).join(", ")
    throw new Error(`Failed to overwrite cloud with local data after ${MAX_OVERWRITE_ATTEMPTS} attempts. Conflicts on: ${conflictIds}`)
  }

  await overwriteCloudWithLocalAttempt(accessTokenSource, deviceId, attempt + 1)
}

function isPushablePreparedPending(entry: PreparedPending): entry is PushablePreparedPending {
  return entry.change !== null
}

async function pushChunkedEntries<T>(args: {
  entries: T[]
  accessTokenSource: AccessTokenSource
  toPushChange: (entry: T) => PushChange
  onChunk: (chunkEntries: T[], response: PushResponse) => Promise<void> | void
}): Promise<void> {
  const chunks = chunkArray(args.entries, MAX_PUSH_BATCH)
  await runSequentially(chunks, async (chunkEntries) => {
    if (chunkEntries.length === 0) return
    const changes = chunkEntries.map(args.toPushChange)
    const response = await pushChanges(readAccessToken(args.accessTokenSource), { changes })
    await args.onChunk(chunkEntries, response)
  })
}

function chunkArray<T>(items: T[], size: number): T[][] {
  if (items.length === 0) return []
  const chunks: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size))
  }
  return chunks
}
