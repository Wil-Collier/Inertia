import { db } from "@/services/db"
import { applyPulledChanges, clearLocalSyncData } from "@/features/sync/engine/applyPipeline"
import { pullAllChanges } from "@/features/sync/engine/pullPipeline"
import {
  mergeCloudAndLocal,
  overwriteCloudWithLocal,
  pushFullSnapshot,
  type MergeCloudAndLocalResult,
} from "@/features/sync/engine/pushPipeline"
import {
  clearSyncMetadata,
  getLocalDataOwnerUserId,
  getPullCursor,
  setLastSyncedAtMs,
  setLocalDataOwnerUserId,
  setPullCursor,
} from "@/features/sync/changeTracker"
import type { InitialSyncStrategy } from "@/features/sync/types"
import { useSyncStore } from "@/features/sync/store"
import { pullChanges } from "@/features/sync/api"

export async function ensureInitialSync(accessToken: string, userId: string): Promise<boolean> {
  const existingCursor = await getPullCursor()
  if (existingCursor) {
    const localDataOwnerUserId = await getLocalDataOwnerUserId()
    if (localDataOwnerUserId === userId) {
      return true
    }

    await clearSyncMetadata()
  }

  const localHasData = await hasLocalData()
  const cloudHasData = await hasCloudData(accessToken)

  if (!localHasData && !cloudHasData) {
    return true
  }

  if (localHasData && !cloudHasData) {
    const localDataOwnerUserId = await getLocalDataOwnerUserId()
    if (localDataOwnerUserId !== userId) {
      useSyncStore.getState().setInitialSyncState({ localHasData, cloudHasData })
      return false
    }

    await pushFullSnapshot(accessToken)
    await pullApplyAndPersist(accessToken, userId)
    return true
  }

  if (!localHasData && cloudHasData) {
    await pullApplyAndPersist(accessToken, userId)
    return true
  }

  const localDataOwnerUserId = await getLocalDataOwnerUserId()
  if (localDataOwnerUserId === userId) {
    const summary = await mergeCloudAndLocal(accessToken)
    persistMergeSummary(summary)
    await pullApplyAndPersist(accessToken, userId)
    return true
  }

  useSyncStore.getState().setInitialSyncState({ localHasData, cloudHasData })
  return false
}

export async function resolveInitialSyncStrategy(
  accessToken: string,
  userId: string,
  strategy: InitialSyncStrategy
): Promise<void> {
  if (strategy === "use-cloud") {
    await clearLocalSyncData()
    await clearSyncMetadata()
    await pullApplyAndPersist(accessToken, userId)
  } else if (strategy === "merge") {
    const summary = await mergeCloudAndLocal(accessToken)
    persistMergeSummary(summary)
    await pullApplyAndPersist(accessToken, userId)
  } else if (strategy === "use-local") {
    await overwriteCloudWithLocal(accessToken)
    await pullApplyAndPersist(accessToken, userId)
  }

  useSyncStore.getState().setInitialSyncState(null)
}

function persistMergeSummary(summary: MergeCloudAndLocalResult | null | undefined): void {
  if (!summary) return
  useSyncStore.getState().setLastAutoMergeSummary({
    resolvedAtMs: Date.now(),
    ...summary,
  })
}

async function pullApplyAndPersist(accessToken: string, userId: string): Promise<void> {
  const pullResult = await pullAllChanges(accessToken)
  await applyPulledChanges(pullResult.changes)
  if (pullResult.cursor) {
    await setPullCursor(pullResult.cursor)
  }
  await setLastSyncedAtMs(pullResult.serverTimestampMs)
  await setLocalDataOwnerUserId(userId)
  useSyncStore.getState().setLastSyncedAtMs(pullResult.serverTimestampMs)
}

async function hasCloudData(accessToken: string): Promise<boolean> {
  const response = await pullChanges(accessToken, { limit: 1, cursor: { version: 0 } })
  return response.changes.length > 0
}

async function hasLocalData(): Promise<boolean> {
  const [
    workouts,
    activeSession,
    templates,
    foods,
    nutrition,
    mealTemplates,
    bodyWeight,
    exercises,
    settings,
  ] = await Promise.all([
    db.workoutSessions.count(),
    db.activeSession.count(),
    db.workoutTemplates.count(),
    db.foods.count(),
    db.nutritionLogs.count(),
    db.mealTemplates.count(),
    db.bodyWeight.count(),
    db.customExercises.count(),
    db.settings.get("settings"),
  ])

  return workouts + activeSession + templates + foods + nutrition + mealTemplates + bodyWeight + exercises > 0 || !!settings
}
