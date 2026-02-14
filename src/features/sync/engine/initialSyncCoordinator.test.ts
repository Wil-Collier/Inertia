import { beforeEach, describe, expect, it, vi } from "vitest"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { db } from "@/services/db"
import { setLocalDataOwnerUserId, setPullCursor } from "@/features/sync/changeTracker"
import { useSyncStore } from "@/features/sync/store"
import { ensureInitialSync, resolveInitialSyncStrategy } from "@/features/sync/engine/initialSyncCoordinator"
import type { PullPipelineResult } from "@/features/sync/engine/pullPipeline"

const pullChangesMock = vi.fn()
const pullAllChangesMock = vi.fn<(accessToken: string) => Promise<PullPipelineResult>>()
const applyPulledChangesMock = vi.fn()
const pushFullSnapshotMock = vi.fn()
const mergeCloudAndLocalMock = vi.fn()
const overwriteCloudWithLocalMock = vi.fn()
const clearLocalSyncDataMock = vi.fn()

vi.mock("@/features/sync/api", () => ({
  pullChanges: (...args: unknown[]) => pullChangesMock(...args),
}))

vi.mock("@/features/sync/engine/pullPipeline", () => ({
  pullAllChanges: (...args: [string]) => pullAllChangesMock(...args),
}))

vi.mock("@/features/sync/engine/applyPipeline", () => ({
  applyPulledChanges: (...args: unknown[]) => applyPulledChangesMock(...args),
  clearLocalSyncData: (...args: unknown[]) => clearLocalSyncDataMock(...args),
}))

vi.mock("@/features/sync/engine/pushPipeline", () => ({
  pushFullSnapshot: (...args: unknown[]) => pushFullSnapshotMock(...args),
  mergeCloudAndLocal: (...args: unknown[]) => mergeCloudAndLocalMock(...args),
  overwriteCloudWithLocal: (...args: unknown[]) => overwriteCloudWithLocalMock(...args),
}))

function defaultPullResult(): PullPipelineResult {
  return {
    changes: [],
    cursor: null,
    serverTimestampMs: 123,
    affectedCollections: new Set(),
  }
}

describe("initialSyncCoordinator", () => {
  beforeEach(async () => {
    await clearDatabase()
    pullChangesMock.mockReset()
    pullAllChangesMock.mockReset().mockResolvedValue(defaultPullResult())
    applyPulledChangesMock.mockReset().mockResolvedValue(new Set())
    pushFullSnapshotMock.mockReset().mockResolvedValue(undefined)
    mergeCloudAndLocalMock.mockReset().mockResolvedValue(undefined)
    overwriteCloudWithLocalMock.mockReset().mockResolvedValue(undefined)
    clearLocalSyncDataMock.mockReset().mockResolvedValue(undefined)
    useSyncStore.setState({
      status: "idle",
      lastSyncedAtMs: null,
      lastError: null,
      pendingCount: 0,
      conflicts: [],
      initialSyncState: null,
    })
  })

  it("returns true immediately when pull cursor already exists", async () => {
    await setPullCursor({ version: 7 })
    await setLocalDataOwnerUserId("user-1")

    const canProceed = await ensureInitialSync("token", "user-1")

    expect(canProceed).toBe(true)
    expect(pullChangesMock).not.toHaveBeenCalled()
  })

  it("does not trust an existing cursor from another user", async () => {
    await setPullCursor({ version: 7 })
    await setLocalDataOwnerUserId("other-user")
    await db.workoutSessions.put({ id: "w1", name: "Local", date: "2026-02-08", weightUnit: "kg", exercises: [] })
    pullChangesMock.mockResolvedValue({
      changes: [],
      nextCursor: null,
      serverTimestampMs: 1,
      hasMore: false,
    })

    const canProceed = await ensureInitialSync("token", "user-1")

    expect(canProceed).toBe(false)
    expect(pullChangesMock).toHaveBeenCalledTimes(1)
  })

  it("requires user decision when local and cloud both have data", async () => {
    await db.workoutSessions.put({ id: "w1", name: "Local", date: "2026-02-08", weightUnit: "kg", exercises: [] })
    pullChangesMock.mockResolvedValue({
      changes: [{ collection: "workouts", id: "c1", data: { id: "c1" }, version: 1, deleted: false }],
      nextCursor: { version: 1 },
      serverTimestampMs: 1,
      hasMore: false,
    })

    const canProceed = await ensureInitialSync("token", "user-1")

    expect(canProceed).toBe(false)
    expect(useSyncStore.getState().initialSyncState).toEqual({ localHasData: true, cloudHasData: true })
  })

  it("auto-merges when local and cloud both have data for the same owner", async () => {
    await db.workoutSessions.put({ id: "w1", name: "Local", date: "2026-02-08", weightUnit: "kg", exercises: [] })
    await setLocalDataOwnerUserId("user-1")
    pullChangesMock.mockResolvedValue({
      changes: [{ collection: "workouts", id: "c1", data: { id: "c1" }, version: 1, deleted: false }],
      nextCursor: { version: 1 },
      serverTimestampMs: 1,
      hasMore: false,
    })
    mergeCloudAndLocalMock.mockResolvedValue({
      pushed: 1,
      localWins: 1,
      remoteWins: 0,
      mergedRecords: 0,
      skippedEqual: 0,
    })

    const canProceed = await ensureInitialSync("token", "user-1")

    expect(canProceed).toBe(true)
    expect(mergeCloudAndLocalMock).toHaveBeenCalledWith("token")
    expect(useSyncStore.getState().initialSyncState).toBeNull()
  })

  it("blocks auto-push when local owner differs from authenticated user", async () => {
    await db.workoutSessions.put({ id: "w1", name: "Local", date: "2026-02-08", weightUnit: "kg", exercises: [] })
    await setLocalDataOwnerUserId("different-user")

    pullChangesMock.mockResolvedValue({
      changes: [],
      nextCursor: null,
      serverTimestampMs: 1,
      hasMore: false,
    })

    const canProceed = await ensureInitialSync("token", "user-1")

    expect(canProceed).toBe(false)
    expect(pushFullSnapshotMock).not.toHaveBeenCalled()
    expect(useSyncStore.getState().initialSyncState).toEqual({ localHasData: true, cloudHasData: false })
  })

  it("auto-pushes local snapshot when cloud is empty and owner matches", async () => {
    await db.workoutSessions.put({ id: "w1", name: "Local", date: "2026-02-08", weightUnit: "kg", exercises: [] })
    await setLocalDataOwnerUserId("user-1")
    pullChangesMock.mockResolvedValue({
      changes: [],
      nextCursor: null,
      serverTimestampMs: 1,
      hasMore: false,
    })

    const canProceed = await ensureInitialSync("token", "user-1")

    expect(canProceed).toBe(true)
    expect(pushFullSnapshotMock).toHaveBeenCalledWith("token")
    expect(pullAllChangesMock).toHaveBeenCalledWith("token")
    expect(applyPulledChangesMock).toHaveBeenCalled()
  })

  it("pulls cloud snapshot when local is empty", async () => {
    pullChangesMock.mockResolvedValue({
      changes: [{ collection: "foods", id: "food-1", data: { id: "food-1" }, version: 1, deleted: false }],
      nextCursor: { version: 1 },
      serverTimestampMs: 1,
      hasMore: false,
    })

    const canProceed = await ensureInitialSync("token", "user-1")

    expect(canProceed).toBe(true)
    expect(pushFullSnapshotMock).not.toHaveBeenCalled()
    expect(pullAllChangesMock).toHaveBeenCalledWith("token")
  })

  it("applies each explicit initial-sync resolution strategy", async () => {
    useSyncStore.getState().setInitialSyncState({ localHasData: true, cloudHasData: true })

    await resolveInitialSyncStrategy("token", "user-1", "use-cloud")
    expect(clearLocalSyncDataMock).toHaveBeenCalled()

    await resolveInitialSyncStrategy("token", "user-1", "merge")
    expect(mergeCloudAndLocalMock).toHaveBeenCalledWith("token")

    await resolveInitialSyncStrategy("token", "user-1", "use-local")
    expect(overwriteCloudWithLocalMock).toHaveBeenCalledWith("token")

    expect(useSyncStore.getState().initialSyncState).toBeNull()
  })

  it("bubbles merge conflicts so callers can surface manual conflict resolution", async () => {
    useSyncStore.getState().setInitialSyncState({ localHasData: true, cloudHasData: true })
    mergeCloudAndLocalMock.mockRejectedValueOnce(new Error("Merge requires manual resolution for settings:settings"))

    await expect(resolveInitialSyncStrategy("token", "user-1", "merge")).rejects.toThrow(
      "Merge requires manual resolution for settings:settings"
    )
    expect(useSyncStore.getState().initialSyncState).toEqual({ localHasData: true, cloudHasData: true })
  })
})
