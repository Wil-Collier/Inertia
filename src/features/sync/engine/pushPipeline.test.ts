import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PendingChange } from "@/features/sync/types"
import type { PullChange, PushChange } from "@/features/sync/schemas"

const listPendingChangesMock = vi.fn<() => Promise<PendingChange[]>>()
const getRecordVersionMock = vi.fn<(collection: PushChange["collection"], id: string) => Promise<number>>()
const setRecordVersionsBulkMock = vi.fn()
const rebasePendingChangesFromAcceptedMock = vi.fn()
const acknowledgeProcessedPendingChangesMock = vi.fn()
const clearPendingChangesMock = vi.fn()

const pushChangesMock = vi.fn()
const toCloudRecordMock = vi.fn()
const getDeviceIdMock = vi.fn<() => string>()
const setConflictsMock = vi.fn()
const getLocalRecordMock = vi.fn()
const pullAllChangesMock = vi.fn()

const workoutSessionsToArrayMock = vi.fn()
const activeSessionGetMock = vi.fn()
const workoutTemplatesToArrayMock = vi.fn()
const foodsToArrayMock = vi.fn()
const nutritionToArrayMock = vi.fn()
const mealTemplatesToArrayMock = vi.fn()
const bodyWeightToArrayMock = vi.fn()
const settingsGetMock = vi.fn()
const customExercisesToArrayMock = vi.fn()

vi.mock("@/features/sync/changeTracker", () => ({
  listPendingChanges: () => listPendingChangesMock(),
  getRecordVersion: (collection: PushChange["collection"], id: string) => getRecordVersionMock(collection, id),
  setRecordVersionsBulk: (...args: unknown[]) => setRecordVersionsBulkMock(...args),
  rebasePendingChangesFromAccepted: (...args: unknown[]) => rebasePendingChangesFromAcceptedMock(...args),
  acknowledgeProcessedPendingChanges: (...args: unknown[]) => acknowledgeProcessedPendingChangesMock(...args),
  clearPendingChanges: () => clearPendingChangesMock(),
}))

vi.mock("@/features/sync/api", () => ({
  pushChanges: (...args: unknown[]) => pushChangesMock(...args),
}))

vi.mock("@/features/sync/projection", () => ({
  toCloudRecord: (...args: unknown[]) => toCloudRecordMock(...args),
}))

vi.mock("@/features/sync/deviceId", () => ({
  getDeviceId: () => getDeviceIdMock(),
}))

vi.mock("@/features/sync/store", () => ({
  useSyncStore: {
    getState: () => ({
      setConflicts: (...args: unknown[]) => setConflictsMock(...args),
    }),
  },
}))

vi.mock("@/features/sync/engine/applyPipeline", () => ({
  getLocalRecord: (...args: unknown[]) => getLocalRecordMock(...args),
}))

vi.mock("@/features/sync/engine/pullPipeline", () => ({
  pullAllChanges: (...args: unknown[]) => pullAllChangesMock(...args),
}))

vi.mock("@/services/db", () => ({
  db: {
    workoutSessions: { toArray: () => workoutSessionsToArrayMock() },
    activeSession: { get: (...args: unknown[]) => activeSessionGetMock(...args) },
    workoutTemplates: { toArray: () => workoutTemplatesToArrayMock() },
    foods: { toArray: () => foodsToArrayMock() },
    nutritionLogs: { toArray: () => nutritionToArrayMock() },
    mealTemplates: { toArray: () => mealTemplatesToArrayMock() },
    bodyWeight: { toArray: () => bodyWeightToArrayMock() },
    settings: { get: (...args: unknown[]) => settingsGetMock(...args) },
    customExercises: { toArray: () => customExercisesToArrayMock() },
  },
}))

function makeAcceptedFromChanges(changes: PushChange[]) {
  return changes.map((change, index) => ({
    collection: change.collection,
    id: change.id,
    version: index + 1,
    mutationId: change.mutationId,
  }))
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isPushChangeLike(value: unknown): value is PushChange {
  if (!isRecord(value)) return false
  return (
    typeof value.collection === "string" &&
    typeof value.id === "string" &&
    "data" in value &&
    typeof value.baseVersion === "number" &&
    typeof value.mutationId === "string" &&
    typeof value.deviceId === "string"
  )
}

function readPushedChanges(value: unknown): PushChange[] {
  if (!isRecord(value) || !Array.isArray(value.changes)) {
    throw new TypeError("Expected push payload with changes array")
  }
  if (!value.changes.every(isPushChangeLike)) {
    throw new TypeError("Unexpected change payload shape")
  }
  return value.changes
}

async function loadPushPipeline() {
  return await import("@/features/sync/engine/pushPipeline")
}

describe("pushPipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    listPendingChangesMock.mockResolvedValue([])
    getRecordVersionMock.mockResolvedValue(0)
    setRecordVersionsBulkMock.mockResolvedValue(undefined)
    rebasePendingChangesFromAcceptedMock.mockResolvedValue(undefined)
    acknowledgeProcessedPendingChangesMock.mockResolvedValue(undefined)
    clearPendingChangesMock.mockResolvedValue(undefined)
    pushChangesMock.mockResolvedValue({ acceptedChanges: [], conflicts: [] })
    toCloudRecordMock.mockReturnValue({ payload: true })
    getDeviceIdMock.mockReturnValue("device-1")
    setConflictsMock.mockReturnValue(undefined)
    getLocalRecordMock.mockResolvedValue({ id: "local" })
    pullAllChangesMock.mockResolvedValue({ changes: [] as PullChange[] })

    workoutSessionsToArrayMock.mockResolvedValue([])
    activeSessionGetMock.mockResolvedValue(undefined)
    workoutTemplatesToArrayMock.mockResolvedValue([])
    foodsToArrayMock.mockResolvedValue([])
    nutritionToArrayMock.mockResolvedValue([])
    mealTemplatesToArrayMock.mockResolvedValue([])
    bodyWeightToArrayMock.mockResolvedValue([])
    settingsGetMock.mockResolvedValue(undefined)
    customExercisesToArrayMock.mockResolvedValue([])
  })

  it("returns early when there are no pending changes", async () => {
    const { pushPendingChangesInternal } = await loadPushPipeline()

    await pushPendingChangesInternal("token", true)

    expect(pushChangesMock).not.toHaveBeenCalled()
    expect(setRecordVersionsBulkMock).not.toHaveBeenCalled()
    expect(acknowledgeProcessedPendingChangesMock).not.toHaveBeenCalled()
  })

  it("creates tombstones for deleted or missing local records and acknowledges accepted + conflicts", async () => {
    listPendingChangesMock.mockResolvedValue([
      {
        collection: "foods",
        id: "food-deleted",
        deleted: true,
        baseVersion: 2,
        mutationId: "m-delete",
        enqueuedAt: 1,
      },
      {
        collection: "foods",
        id: "food-missing",
        deleted: false,
        baseVersion: 3,
        mutationId: "m-missing",
        enqueuedAt: 2,
      },
    ])

    getLocalRecordMock.mockResolvedValueOnce(null)

    pushChangesMock.mockResolvedValueOnce({
      acceptedChanges: [
        {
          collection: "foods",
          id: "food-deleted",
          version: 10,
          mutationId: "m-delete",
        },
      ],
      conflicts: [
        {
          collection: "foods",
          id: "food-missing",
          serverVersion: 6,
          clientBaseVersion: 3,
          reason: "VERSION_MISMATCH",
        },
      ],
    })

    const { pushPendingChangesInternal } = await loadPushPipeline()
    await pushPendingChangesInternal("token", true)

    const payload = pushChangesMock.mock.calls[0]?.[1]
    expect(payload.changes).toEqual([
      {
        collection: "foods",
        id: "food-deleted",
        data: null,
        baseVersion: 2,
        mutationId: "m-delete",
        deviceId: "device-1",
      },
      {
        collection: "foods",
        id: "food-missing",
        data: null,
        baseVersion: 3,
        mutationId: "m-missing",
        deviceId: "device-1",
      },
    ])

    expect(setConflictsMock).toHaveBeenCalledWith([
      {
        collection: "foods",
        id: "food-missing",
        serverVersion: 6,
        clientBaseVersion: 3,
        reason: "VERSION_MISMATCH",
      },
    ])

    expect(setRecordVersionsBulkMock).toHaveBeenCalledWith([
      { collection: "foods", id: "food-deleted", version: 10 },
    ])

    expect(acknowledgeProcessedPendingChangesMock).toHaveBeenCalledWith([
      { collection: "foods", id: "food-deleted", mutationId: "m-delete" },
      { collection: "foods", id: "food-missing", mutationId: "m-missing" },
    ])
  })

  it("skips pending records when cloud projection returns null", async () => {
    listPendingChangesMock.mockResolvedValue([
      {
        collection: "foods",
        id: "food-1",
        deleted: false,
        baseVersion: 0,
        mutationId: "m1",
        enqueuedAt: 1,
      },
    ])
    getLocalRecordMock.mockResolvedValueOnce({ id: "food-1", name: "Local" })
    toCloudRecordMock.mockReturnValueOnce(null)

    const { pushPendingChangesInternal } = await loadPushPipeline()
    await pushPendingChangesInternal("token", true)

    expect(pushChangesMock).not.toHaveBeenCalled()
    expect(acknowledgeProcessedPendingChangesMock).not.toHaveBeenCalled()
  })

  it("chunks push requests into batches of 200", async () => {
    const pending = Array.from({ length: 401 }, (_, i) => ({
      collection: "foods" as const,
      id: `food-${i}`,
      deleted: false,
      baseVersion: 0,
      mutationId: `m-${i}`,
      enqueuedAt: i,
    }))

    listPendingChangesMock.mockResolvedValue(pending)
    getLocalRecordMock.mockImplementation(async (_collection, id) => ({ id }))
    toCloudRecordMock.mockImplementation((_collection, record) => record)
    pushChangesMock.mockImplementation(async (_token, payload: { changes: PushChange[] }) => ({
      acceptedChanges: makeAcceptedFromChanges(payload.changes),
      conflicts: [],
    }))

    const { pushPendingChangesInternal } = await loadPushPipeline()
    await pushPendingChangesInternal("token", true)

    expect(pushChangesMock).toHaveBeenCalledTimes(3)
    expect(pushChangesMock.mock.calls[0]?.[1].changes).toHaveLength(200)
    expect(pushChangesMock.mock.calls[1]?.[1].changes).toHaveLength(200)
    expect(pushChangesMock.mock.calls[2]?.[1].changes).toHaveLength(1)
  })

  it("rebases newer pending mutation base versions after accepted push", async () => {
    listPendingChangesMock.mockResolvedValue([
      {
        collection: "foods",
        id: "food-1",
        deleted: false,
        baseVersion: 0,
        mutationId: "m-older",
        enqueuedAt: 1,
      },
    ])

    pushChangesMock.mockResolvedValueOnce({
      acceptedChanges: [
        {
          collection: "foods",
          id: "food-1",
          version: 4,
          mutationId: "m-older",
        },
      ],
      conflicts: [],
    })

    const { pushPendingChangesInternal } = await loadPushPipeline()
    await pushPendingChangesInternal("token", true)

    expect(rebasePendingChangesFromAcceptedMock).toHaveBeenCalledWith([
      {
        collection: "foods",
        id: "food-1",
        version: 4,
        mutationId: "m-older",
      },
    ])
  })

  it("does not update conflict store when updateStatus is false", async () => {
    listPendingChangesMock.mockResolvedValue([
      {
        collection: "foods",
        id: "food-1",
        deleted: false,
        baseVersion: 0,
        mutationId: "m1",
        enqueuedAt: 1,
      },
    ])

    pushChangesMock.mockResolvedValueOnce({
      acceptedChanges: [],
      conflicts: [
        {
          collection: "foods",
          id: "food-1",
          serverVersion: 2,
          clientBaseVersion: 0,
          reason: "VERSION_MISMATCH",
        },
      ],
    })

    const { pushPendingChangesInternal } = await loadPushPipeline()
    await pushPendingChangesInternal("token", false)

    expect(setConflictsMock).not.toHaveBeenCalled()
  })

  it("pushes a full snapshot and clears pending changes", async () => {
    workoutSessionsToArrayMock.mockResolvedValue([{ id: "workout-1" }])
    activeSessionGetMock.mockResolvedValue({ id: "current", workout: { id: "w-current" } })
    workoutTemplatesToArrayMock.mockResolvedValue([{ id: "template-1" }])
    foodsToArrayMock.mockResolvedValue([{ id: "food-1" }])
    nutritionToArrayMock.mockResolvedValue([{ date: "2026-02-09" }])
    mealTemplatesToArrayMock.mockResolvedValue([{ id: "meal-template-1" }])
    bodyWeightToArrayMock.mockResolvedValue([{ id: "weight-1" }])
    settingsGetMock.mockResolvedValue({ id: "settings", theme: "system" })
    customExercisesToArrayMock.mockResolvedValue([{ id: "exercise-1" }])

    toCloudRecordMock.mockImplementation((_collection, record) => record)
    getRecordVersionMock.mockResolvedValue(4)
    pushChangesMock.mockImplementation(async (_token, payload: { changes: PushChange[] }) => ({
      acceptedChanges: makeAcceptedFromChanges(payload.changes),
      conflicts: [],
    }))

    const { pushFullSnapshot } = await loadPushPipeline()
    await pushFullSnapshot("token")

    expect(pushChangesMock).toHaveBeenCalledTimes(1)
    expect(pushChangesMock.mock.calls[0]?.[1].changes.length).toBeGreaterThan(0)
    expect(clearPendingChangesMock).toHaveBeenCalledTimes(1)
  })

  it("overwrites cloud with local and sends tombstones for remote-only records", async () => {
    foodsToArrayMock.mockResolvedValue([{ id: "food-local" }])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "foods",
          id: "food-local",
          data: { id: "food-local" },
          version: 3,
          deleted: false,
        },
        {
          collection: "foods",
          id: "food-remote-only",
          data: { id: "food-remote-only" },
          version: 5,
          deleted: false,
        },
        {
          collection: "foods",
          id: "food-deleted-remote",
          data: null,
          version: 7,
          deleted: true,
        },
      ],
      cursor: { version: 7 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["foods"]),
    })

    pushChangesMock.mockImplementation(async (_token, payload: { changes: PushChange[] }) => ({
      acceptedChanges: makeAcceptedFromChanges(payload.changes),
      conflicts: [],
    }))

    const { overwriteCloudWithLocal } = await loadPushPipeline()
    await overwriteCloudWithLocal("token")

    const pushedChanges = readPushedChanges(pushChangesMock.mock.calls[0]?.[1])
    expect(
      pushedChanges.some(
        (change) =>
          change.collection === "foods" &&
          change.id === "food-remote-only" &&
          change.data === null &&
          change.baseVersion === 5 &&
          change.deviceId === "device-1"
      )
    ).toBe(true)
    expect(clearPendingChangesMock).toHaveBeenCalledTimes(1)
  })
})
