import { db } from "@/services/db"
import { pushChanges } from "@/features/sync/api"
import {
  acknowledgeProcessedPendingChanges,
  clearPendingChanges,
  getRecordVersion,
  listPendingChanges,
  setRecordVersionsBulk,
} from "@/features/sync/changeTracker"
import type { PendingChange } from "@/features/sync/types"
import type { PushChange, SyncCollection } from "@/features/sync/schemas"
import { toCloudRecord } from "@/features/sync/projection"
import { getDeviceId } from "@/features/sync/deviceId"
import { useSyncStore } from "@/features/sync/store"
import { getLocalRecord } from "@/features/sync/engine/applyPipeline"
import { pullAllChanges } from "@/features/sync/engine/pullPipeline"

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

    await setRecordVersionsBulk(
      response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
        version: item.version,
      }))
    )

    const processedKeys = new Set<string>()
    response.acceptedChanges.forEach((item) => {
      processedKeys.add(`${item.collection}:${item.id}`)
    })
    response.conflicts.forEach((item) => {
      processedKeys.add(`${item.collection}:${item.id}`)
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

export async function pushFullSnapshot(accessToken: string): Promise<void> {
  const changes = await buildFullSnapshot()
  if (changes.length === 0) return

  const chunks = chunkArray(changes, MAX_PUSH_BATCH)
  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })
    await setRecordVersionsBulk(
      response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
        version: item.version,
      }))
    )
  })

  await clearPendingChanges()
}

export async function overwriteCloudWithLocal(accessToken: string): Promise<void> {
  const remote = await pullAllChanges(accessToken, { cursor: { version: 0 } })
  const remoteState = new Map<string, { collection: SyncCollection; id: string; version: number; deleted: boolean }>()
  remote.changes.forEach((change) => {
    const key = `${change.collection}:${change.id}`
    remoteState.set(key, {
      collection: change.collection,
      id: change.id,
      version: change.version,
      deleted: change.deleted,
    })
  })

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
  await runSequentially(chunks, async (chunk) => {
    const response = await pushChanges(accessToken, { changes: chunk })
    await setRecordVersionsBulk(
      response.acceptedChanges.map((item) => ({
        collection: item.collection,
        id: item.id,
        version: item.version,
      }))
    )
  })

  await clearPendingChanges()
}

async function buildPushChangesFromPending(pending: PendingChange[]): Promise<PreparedPending[]> {
  const deviceId = getDeviceId()
  return await Promise.all(
    pending.map(async (change) => {
      if (change.deleted) {
        return {
          pending: change,
          change: {
            collection: change.collection,
            id: change.id,
            data: null,
            baseVersion: change.baseVersion,
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
            baseVersion: change.baseVersion,
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
          baseVersion: change.baseVersion,
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
    templates,
    foods,
    nutrition,
    mealTemplates,
    bodyWeight,
    settings,
    exercises,
  ] = await Promise.all([
    db.workoutSessions.toArray(),
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

async function runSequentially<T>(items: T[], task: (item: T) => Promise<void>): Promise<void> {
  await items.reduce((promise, item) => promise.then(() => task(item)), Promise.resolve())
}
