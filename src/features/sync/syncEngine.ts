import { db } from "@/services/db"
import type {
  DailyNutrition,
  Exercise,
  FoodItem,
  MealTemplate,
  UserSettings,
  WeightEntry,
  Workout,
  WorkoutTemplate,
} from "@/lib/types"
import {
  pullChanges,
  pushChanges,
  SyncApiError,
} from "@/features/sync/api"
import {
  getPendingChanges,
  removePendingChanges,
  clearPendingChanges,
  getPullCursor,
  setPullCursor,
  setLastSyncedAtMs,
  clearSyncMetadata,
} from "@/features/sync/changeTracker"
import type { PendingChange, InitialSyncStrategy } from "@/features/sync/types"
import type { PullChange, PushChange, SyncCollection, SyncCursor } from "@/features/sync/schemas"
import { MAX_PULL_LIMIT, SYNC_COLLECTIONS } from "@/features/sync/schemas"
import { toCloudRecord, fromCloudRecord } from "@/features/sync/projection"
import { withSyncHooksSuppressed } from "@/features/sync/dexieHooks"
import { rebuildLocalOnlyFields } from "@/features/sync/localRebuild"
import { recalculateDerivedData } from "@/features/sync/derivedData"
import { invalidateQueriesForCollections } from "@/features/sync/queryInvalidation"
import { getDeviceId } from "@/features/sync/deviceId"
import { useAuthStore, useSyncStore } from "@/features/sync/store"

const MAX_PUSH_BATCH = 200
const MAX_RETRIES = 3
const RETRY_DELAYS_MS = [1000, 5000, 15000]

let syncInFlight = false

export const SYNC_ENABLED = import.meta.env.VITE_ENABLE_SYNC !== "false"

type LocalRecord =
  | Workout
  | WorkoutTemplate
  | FoodItem
  | DailyNutrition
  | MealTemplate
  | WeightEntry
  | (UserSettings & { id: string })
  | Exercise

export async function syncNow(): Promise<void> {
  if (!SYNC_ENABLED) return
  const auth = useAuthStore.getState()
  if (!auth.isAuthenticated || !auth.accessToken) return
  const accessToken = auth.accessToken
  if (!navigator.onLine) {
    useSyncStore.getState().setStatus("offline")
    return
  }

  try {
    await syncWithRetry(async () => {
      if (syncInFlight) return
      syncInFlight = true

      const syncStore = useSyncStore.getState()
      syncStore.setStatus("syncing")
      syncStore.setLastError(null)
      syncStore.setConflicts([])

      try {
        const canProceed = await ensureInitialSync()
        if (!canProceed) {
          syncStore.setStatus("idle")
          return
        }

        await pushPendingChangesInternal(accessToken, true)
        const pullResult = await pullAllChanges(accessToken)

        if (pullResult.changes.length > 0) {
          await applyChanges(pullResult.changes)
          await rebuildLocalOnlyFields(pullResult.affectedCollections)
          await recalculateDerivedData()
          invalidateQueriesForCollections(pullResult.affectedCollections)
        }

        if (pullResult.cursor) {
          await setPullCursor(pullResult.cursor)
        }

        syncStore.setLastSyncedAtMs(pullResult.serverTimestampMs)
        await setLastSyncedAtMs(pullResult.serverTimestampMs)
        syncStore.setStatus("success")
      } finally {
        syncInFlight = false
      }
    })
  } catch (error) {
    handleSyncError(error)
  }
}

export async function pushPendingChanges(): Promise<void> {
  if (!SYNC_ENABLED) return
  const auth = useAuthStore.getState()
  if (!auth.isAuthenticated || !auth.accessToken) return
  const accessToken = auth.accessToken
  if (!navigator.onLine) return

  if (syncInFlight) return
  syncInFlight = true

  const syncStore = useSyncStore.getState()
  syncStore.setStatus("syncing")
  syncStore.setLastError(null)
  syncStore.setConflicts([])

  try {
    await pushPendingChangesInternal(accessToken, true)
    syncStore.setStatus("success")
  } catch (error) {
    handleSyncError(error)
  } finally {
    syncInFlight = false
  }
}

export async function resolveInitialSync(strategy: InitialSyncStrategy): Promise<void> {
  const auth = useAuthStore.getState()
  if (!auth.isAuthenticated || !auth.accessToken) return
  const accessToken = auth.accessToken

  const syncStore = useSyncStore.getState()
  syncStore.setStatus("syncing")
  syncStore.setLastError(null)

  try {
    if (strategy === "use-cloud") {
      await clearLocalSyncData()
      const pullResult = await pullAllChanges(accessToken)
      if (pullResult.changes.length > 0) {
        await applyChanges(pullResult.changes)
        await rebuildLocalOnlyFields(pullResult.affectedCollections)
        await recalculateDerivedData()
        invalidateQueriesForCollections(pullResult.affectedCollections)
      }
      if (pullResult.cursor) {
        await setPullCursor(pullResult.cursor)
      }
      await setLastSyncedAtMs(pullResult.serverTimestampMs)
      syncStore.setLastSyncedAtMs(pullResult.serverTimestampMs)
    }

    if (strategy === "merge") {
      await backfillUpdatedAt()
      await pushFullSnapshot(accessToken)
      const pullResult = await pullAllChanges(accessToken)
      if (pullResult.changes.length > 0) {
        await applyChanges(pullResult.changes)
        await rebuildLocalOnlyFields(pullResult.affectedCollections)
        await recalculateDerivedData()
        invalidateQueriesForCollections(pullResult.affectedCollections)
      }
      if (pullResult.cursor) {
        await setPullCursor(pullResult.cursor)
      }
      await setLastSyncedAtMs(pullResult.serverTimestampMs)
      syncStore.setLastSyncedAtMs(pullResult.serverTimestampMs)
    }

    if (strategy === "use-local") {
      await backfillUpdatedAt()
      await overwriteCloudWithLocal(accessToken)
      const pullResult = await pullAllChanges(accessToken)
      if (pullResult.changes.length > 0) {
        await applyChanges(pullResult.changes)
        await rebuildLocalOnlyFields(pullResult.affectedCollections)
        await recalculateDerivedData()
        invalidateQueriesForCollections(pullResult.affectedCollections)
      }
      if (pullResult.cursor) {
        await setPullCursor(pullResult.cursor)
      }
      await setLastSyncedAtMs(pullResult.serverTimestampMs)
      syncStore.setLastSyncedAtMs(pullResult.serverTimestampMs)
    }

    syncStore.setInitialSyncState(null)
    syncStore.setStatus("success")
  } catch (error) {
    handleSyncError(error)
  }
}

async function syncWithRetry(fn: () => Promise<void>, attempt = 0): Promise<void> {
  try {
    await fn()
  } catch (error) {
    if (attempt < MAX_RETRIES - 1) {
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]))
      await syncWithRetry(fn, attempt + 1)
      return
    }
    throw error
  }
}

async function ensureInitialSync(): Promise<boolean> {
  const existingCursor = await getPullCursor()
  if (existingCursor) return true

  const auth = useAuthStore.getState()
  if (!auth.accessToken) return false
  const accessToken = auth.accessToken

  const localHasData = await hasLocalData()
  const cloudHasData = await hasCloudData(accessToken)

  if (!localHasData && !cloudHasData) {
    return true
  }

  if (localHasData && !cloudHasData) {
    await backfillUpdatedAt()
    await pushFullSnapshot(accessToken)
    const pullResult = await pullAllChanges(accessToken)
    if (pullResult.changes.length > 0) {
      await applyChanges(pullResult.changes)
      await rebuildLocalOnlyFields(pullResult.affectedCollections)
      await recalculateDerivedData()
      invalidateQueriesForCollections(pullResult.affectedCollections)
    }
    if (pullResult.cursor) {
      await setPullCursor(pullResult.cursor)
    }
    await setLastSyncedAtMs(pullResult.serverTimestampMs)
    useSyncStore.getState().setLastSyncedAtMs(pullResult.serverTimestampMs)
    return true
  }

  if (!localHasData && cloudHasData) {
    const pullResult = await pullAllChanges(accessToken)
    if (pullResult.changes.length > 0) {
      await applyChanges(pullResult.changes)
      await rebuildLocalOnlyFields(pullResult.affectedCollections)
      await recalculateDerivedData()
      invalidateQueriesForCollections(pullResult.affectedCollections)
    }
    if (pullResult.cursor) {
      await setPullCursor(pullResult.cursor)
    }
    await setLastSyncedAtMs(pullResult.serverTimestampMs)
    useSyncStore.getState().setLastSyncedAtMs(pullResult.serverTimestampMs)
    return true
  }

  useSyncStore.getState().setInitialSyncState({ localHasData, cloudHasData })
  return false
}

async function hasCloudData(accessToken: string): Promise<boolean> {
  const response = await pullChanges(accessToken, { limit: 1 })
  return response.changes.length > 0
}

async function hasLocalData(): Promise<boolean> {
  const [
    workouts,
    templates,
    foods,
    nutrition,
    mealTemplates,
    bodyWeight,
    exercises,
  ] = await Promise.all([
    db.workoutSessions.count(),
    db.workoutTemplates.count(),
    db.foods.count(),
    db.nutritionLogs.count(),
    db.mealTemplates.count(),
    db.bodyWeight.count(),
    db.customExercises.count(),
  ])

  return workouts + templates + foods + nutrition + mealTemplates + bodyWeight + exercises > 0
}

async function pushPendingChangesInternal(accessToken: string, updateStatus: boolean): Promise<void> {
  const pending = await getPendingChanges()
  if (pending.length === 0) return

  await backfillUpdatedAt()

  const deviceId = getDeviceId()
  const prepared = await buildPushChangesFromPending(pending, deviceId)

  const skipped = prepared.filter((entry) => !entry.change).map((entry) => entry.pending)
  if (skipped.length > 0) {
    await removePendingChanges(skipped)
  }

  const toSend = prepared.filter((entry) => entry.change !== null)

  const chunks = chunkArray(toSend, MAX_PUSH_BATCH)

  await runSequentially(chunks, async (chunk) => {
    const changes = chunk.map((entry) => entry.change!)
    if (changes.length === 0) return

    const response = await pushChanges(accessToken, { changes })

    if (response.conflicts.length > 0 && updateStatus) {
      useSyncStore.getState().setConflicts(response.conflicts)
    }

    const processed = chunk.map((entry) => entry.pending)
    await removePendingChanges(processed)
  })
}

type PreparedPending = { pending: PendingChange; change: PushChange | null }

async function buildPushChangesFromPending(pending: PendingChange[], deviceId: string): Promise<PreparedPending[]> {
  return await Promise.all(
    pending.map(async (change) => {
      if (change.deleted) {
        return {
          pending: change,
          change: {
            collection: change.collection,
            id: change.id,
            data: null,
            updatedAt: change.updatedAt,
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
            updatedAt: change.updatedAt,
            deviceId,
          },
        }
      }

      if (change.collection === "foods" && !isFoodItem(record)) {
        return { pending: change, change: null }
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
          updatedAt: getUpdatedAt(record) || change.updatedAt,
          deviceId,
        },
      }
    })
  )
}

async function pushFullSnapshot(accessToken: string): Promise<void> {
  const deviceId = getDeviceId()
  const changes = await buildFullSnapshot(deviceId)
  if (changes.length === 0) return

  const chunks = chunkArray(changes, MAX_PUSH_BATCH)
  await runSequentially(chunks, async (chunk) => {
    await pushChanges(accessToken, { changes: chunk })
  })

  await clearPendingChanges()
}

async function overwriteCloudWithLocal(accessToken: string): Promise<void> {
  const deviceId = getDeviceId()

  const remoteChanges = await pullAllChanges(accessToken, { cursor: null })
  const remoteKeys = new Set(remoteChanges.changes.map((change) => `${change.collection}:${change.id}`))

  const localChanges = await buildFullSnapshot(deviceId, Date.now())
  const localKeys = new Set(localChanges.map((change) => `${change.collection}:${change.id}`))

  const tombstones: PushChange[] = []
  for (const key of remoteKeys) {
    if (localKeys.has(key)) continue
    const [collection, id] = key.split(":")
    if (!collection || !id || !isSyncCollection(collection)) {
      continue
    }
    tombstones.push({
      collection,
      id,
      data: null,
      updatedAt: Date.now(),
      deviceId,
    })
  }

  const combined = [...tombstones, ...localChanges]

  const chunks = chunkArray(combined, MAX_PUSH_BATCH)
  await runSequentially(chunks, async (chunk) => {
    await pushChanges(accessToken, { changes: chunk })
  })

  await clearPendingChanges()
}

async function buildFullSnapshot(deviceId: string, overrideUpdatedAt?: number): Promise<PushChange[]> {
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

  const changes: PushChange[] = []
  const pushRecord = (collection: SyncCollection, id: string, record: unknown) => {
    const data = toCloudRecord(collection, record)
    if (!data) return
    const recordUpdatedAt = isRecord(record) && typeof record.updatedAt === "number" ? record.updatedAt : undefined
    const updatedAt = overrideUpdatedAt ?? recordUpdatedAt ?? Date.now()
    changes.push({ collection, id, data, updatedAt, deviceId })
  }

  workouts.forEach((workout) => pushRecord("workouts", workout.id, workout))
  templates.forEach((template) => pushRecord("templates", template.id, template))
  foods.forEach((food) => pushRecord("foods", food.id, food))
  nutrition.forEach((log) => pushRecord("nutrition", log.date, log))
  mealTemplates.forEach((template) => pushRecord("mealTemplates", template.id, template))
  bodyWeight.forEach((entry) => pushRecord("weight", entry.id, entry))
  exercises.forEach((exercise) => pushRecord("exercises", exercise.id, exercise))
  if (settings) {
    pushRecord("settings", "settings", settings)
  }

  return changes
}

async function pullAllChanges(
  accessToken: string,
  options: { cursor?: SyncCursor | null } = {}
): Promise<{
  changes: PullChange[]
  cursor: SyncCursor | null
  serverTimestampMs: number
  affectedCollections: Set<SyncCollection>
}> {
  const startCursor = options.cursor === undefined ? await getPullCursor() : options.cursor
  let cursor = startCursor
  const allChanges: PullChange[] = []
  let serverTimestampMs = Date.now()

  const fetchPage = async (currentCursor: SyncCursor | null): Promise<void> => {
    const response = await pullChanges(accessToken, {
      cursor: currentCursor ?? undefined,
      limit: MAX_PULL_LIMIT,
    })

    serverTimestampMs = response.serverTimestampMs
    allChanges.push(...response.changes)

    if (response.hasMore) {
      await fetchPage(response.nextCursor)
      return
    }

    cursor = response.nextCursor
  }

  await fetchPage(cursor ?? null)

  const affectedCollections = new Set<SyncCollection>()
  allChanges.forEach((change) => affectedCollections.add(change.collection))

  const finalCursor = allChanges.length === 0 ? startCursor ?? null : cursor ?? null

  return {
    changes: allChanges,
    cursor: finalCursor,
    serverTimestampMs,
    affectedCollections,
  }
}

async function applyChanges(changes: PullChange[]): Promise<void> {
  if (changes.length === 0) return

  await withSyncHooksSuppressed(async () => {
    await db.transaction(
      "rw",
      [
        db.workoutSessions,
        db.workoutTemplates,
        db.foods,
        db.nutritionLogs,
        db.mealTemplates,
        db.bodyWeight,
        db.settings,
        db.customExercises,
      ],
      async () => {
        await runSequentially(changes, async (change) => {
          if (change.collection === "nutrition") {
            await applyNutritionChange(change)
            return
          }

          const localRecord = await getLocalRecord(change.collection, change.id)
          const localUpdatedAt = getUpdatedAt(localRecord)
          const isNewer = change.updatedAt > localUpdatedAt

          if (!localRecord || isNewer) {
            if (change.deleted) {
              await deleteLocalRecord(change.collection, change.id)
            } else if (change.data) {
              const local = fromCloudRecord(change.collection, change.data)
              await upsertLocalRecord(change.collection, change.id, local)
            }
          }
        })
      }
    )
  })
}

async function applyNutritionChange(change: PullChange): Promise<void> {
  if (change.deleted) {
    await deleteLocalRecord("nutrition", change.id)
    return
  }

  if (!change.data) return

  const localRecord = await db.nutritionLogs.get(change.id)
  const remote = fromCloudRecord("nutrition", change.data)
  if (!isDailyNutrition(remote)) return
  const merged = mergeDailyNutrition(localRecord ?? null, remote)
  await db.nutritionLogs.put(merged)
}

function mergeDailyNutrition(local: DailyNutrition | null, remote: DailyNutrition): DailyNutrition {
  if (!local) return remote

  const byId = new Map(local.entries.map((entry) => [entry.id, entry]))
  for (const entry of remote.entries) {
    byId.set(entry.id, entry)
  }

  return {
    ...remote,
    entries: Array.from(byId.values()),
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0),
  }
}

async function getLocalRecord(collection: SyncCollection, id: string): Promise<LocalRecord | null> {
  switch (collection) {
    case "workouts":
      return (await db.workoutSessions.get(id)) ?? null
    case "templates":
      return (await db.workoutTemplates.get(id)) ?? null
    case "foods":
      return (await db.foods.get(id)) ?? null
    case "nutrition":
      return (await db.nutritionLogs.get(id)) ?? null
    case "mealTemplates":
      return (await db.mealTemplates.get(id)) ?? null
    case "weight":
      return (await db.bodyWeight.get(id)) ?? null
    case "settings":
      return (await db.settings.get("settings")) ?? null
    case "exercises":
      return (await db.customExercises.get(id)) ?? null
    default:
      return null
  }
}

async function upsertLocalRecord(collection: SyncCollection, id: string, record: unknown): Promise<void> {
  switch (collection) {
    case "workouts":
      if (!isWorkout(record)) return
      await db.workoutSessions.put(record)
      return
    case "templates":
      if (!isWorkoutTemplate(record)) return
      await db.workoutTemplates.put(record)
      return
    case "foods":
      if (!isFoodItem(record)) return
      await db.foods.put(record)
      return
    case "nutrition":
      if (!isDailyNutrition(record)) return
      await db.nutritionLogs.put(record)
      return
    case "mealTemplates":
      if (!isMealTemplate(record)) return
      await db.mealTemplates.put(record)
      return
    case "weight":
      if (!isWeightEntry(record)) return
      await db.bodyWeight.put(record)
      return
    case "settings":
      if (!isUserSettings(record)) return
      await db.settings.put({ id, ...record })
      return
    case "exercises":
      if (!isExercise(record)) return
      await db.customExercises.put(record)
      return
    default:
      return
  }
}

async function deleteLocalRecord(collection: SyncCollection, id: string): Promise<void> {
  switch (collection) {
    case "workouts":
      await db.workoutSessions.delete(id)
      return
    case "templates":
      await db.workoutTemplates.delete(id)
      return
    case "foods":
      await db.foods.delete(id)
      return
    case "nutrition":
      await db.nutritionLogs.delete(id)
      return
    case "mealTemplates":
      await db.mealTemplates.delete(id)
      return
    case "weight":
      await db.bodyWeight.delete(id)
      return
    case "settings":
      await db.settings.delete(id)
      return
    case "exercises":
      await db.customExercises.delete(id)
      return
    default:
      return
  }
}

async function backfillUpdatedAt(): Promise<void> {
  const now = Date.now()

  await withSyncHooksSuppressed(async () => {
    await db.transaction(
      "rw",
      [
        db.workoutSessions,
        db.workoutTemplates,
        db.foods,
        db.nutritionLogs,
        db.mealTemplates,
        db.bodyWeight,
        db.settings,
        db.customExercises,
      ],
      async () => {
        await db.workoutSessions.toCollection().modify((workout: { updatedAt?: number }) => {
          workout.updatedAt ??= now
        })
        await db.workoutTemplates.toCollection().modify((template: { updatedAt?: number }) => {
          template.updatedAt ??= now
        })
        await db.foods.toCollection().modify((food: { updatedAt?: number }) => {
          food.updatedAt ??= now
        })
        await db.nutritionLogs.toCollection().modify((log: { updatedAt?: number }) => {
          log.updatedAt ??= now
        })
        await db.mealTemplates.toCollection().modify((template: { updatedAt?: number }) => {
          template.updatedAt ??= now
        })
        await db.bodyWeight.toCollection().modify((entry: { updatedAt?: number }) => {
          entry.updatedAt ??= now
        })
        await db.settings.toCollection().modify((settings: { updatedAt?: number }) => {
          settings.updatedAt ??= now
        })
        await db.customExercises.toCollection().modify((exercise: { updatedAt?: number }) => {
          exercise.updatedAt ??= now
        })
      }
    )
  })
}

async function clearLocalSyncData(): Promise<void> {
  await withSyncHooksSuppressed(async () => {
    await db.transaction(
      "rw",
      [
        db.workoutSessions,
        db.workoutTemplates,
        db.foods,
        db.nutritionLogs,
        db.mealTemplates,
        db.bodyWeight,
        db.settings,
        db.customExercises,
      ],
      async () => {
        await db.workoutSessions.clear()
        await db.workoutTemplates.clear()
        await db.foods.clear()
        await db.nutritionLogs.clear()
        await db.mealTemplates.clear()
        await db.bodyWeight.clear()
        await db.customExercises.clear()
        await db.settings.delete("settings")
      }
    )
  })

  await clearSyncMetadata()
}

const syncCollectionSet = new Set<string>(SYNC_COLLECTIONS)

function isSyncCollection(value: string): value is SyncCollection {
  return syncCollectionSet.has(value)
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function hasString(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "string"
}

function hasNumber(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "number"
}

function hasBoolean(record: Record<string, unknown>, key: string): boolean {
  return typeof record[key] === "boolean"
}

function isWorkout(record: unknown): record is Workout {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "date") || !hasString(record, "name")) return false
  if (!Array.isArray(record.exercises)) return false
  return record.weightUnit === "kg" || record.weightUnit === "lbs"
}

function isWorkoutTemplate(record: unknown): record is WorkoutTemplate {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "name")) return false
  return Array.isArray(record.exercises)
}

function isFoodItem(record: unknown): record is FoodItem {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "name")) return false
  if (!hasNumber(record, "calories")) return false
  return hasBoolean(record, "isCustom")
}

function isDailyNutrition(record: unknown): record is DailyNutrition {
  if (!isRecord(record)) return false
  if (!hasString(record, "date")) return false
  return Array.isArray(record.entries)
}

function isMealTemplate(record: unknown): record is MealTemplate {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "name")) return false
  return Array.isArray(record.entries)
}

function isWeightEntry(record: unknown): record is WeightEntry {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "date")) return false
  return hasNumber(record, "weight")
}

function isUserSettings(record: unknown): record is UserSettings {
  if (!isRecord(record)) return false
  if (!hasString(record, "theme")) return false
  if (!hasNumber(record, "restTimerDuration")) return false
  return isRecord(record.unitPreferences) && isRecord(record.nutritionGoals) && hasBoolean(record, "areNotificationsEnabled")
}

function isExercise(record: unknown): record is Exercise {
  if (!isRecord(record)) return false
  if (!hasString(record, "id") || !hasString(record, "name")) return false
  if (!hasBoolean(record, "isCustom") || !hasBoolean(record, "isWeighted") || !hasBoolean(record, "isTimeBased")) return false
  return hasString(record, "muscleGroup")
}

function getUpdatedAt(record: LocalRecord | null | undefined): number {
  return record?.updatedAt ?? 0
}

function handleSyncError(error: unknown): void {
  const syncStore = useSyncStore.getState()
  if (error instanceof SyncApiError) {
    syncStore.setLastError(error.message)
  } else if (error instanceof Error) {
    syncStore.setLastError(error.message)
  } else {
    syncStore.setLastError("Sync failed")
  }
  syncStore.setStatus("error")
}
