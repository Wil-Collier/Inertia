import { beforeEach, describe, expect, it, vi } from "vitest"
import type { PendingChange } from "@/features/sync/types"
import type { PullChange, PushChange } from "@/features/sync/schemas"

const listPendingChangesMock = vi.fn<() => Promise<PendingChange[]>>()
const getRecordVersionMock = vi.fn<(collection: PushChange["collection"], id: string) => Promise<number>>()
const setRecordVersionsBulkMock = vi.fn()
const rebasePendingChangesFromAcceptedMock = vi.fn()
const acknowledgeProcessedPendingChangesMock = vi.fn()

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

vi.mock("@/features/sync/localRecordAccess", () => ({
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

  it("pushes known synced version instead of stale pending baseVersion zero", async () => {
    listPendingChangesMock.mockResolvedValue([
      {
        collection: "nutrition",
        id: "2026-02-10",
        deleted: false,
        baseVersion: 0,
        mutationId: "m-nutrition",
        enqueuedAt: 1,
      },
    ])

    getLocalRecordMock.mockResolvedValueOnce({ date: "2026-02-10", entries: [] })
    toCloudRecordMock.mockReturnValueOnce({ date: "2026-02-10", entries: [] })
    getRecordVersionMock.mockImplementation(async (collection, id) => {
      if (collection === "nutrition" && id === "2026-02-10") {
        return 20
      }
      return 0
    })
    pushChangesMock.mockResolvedValueOnce({
      acceptedChanges: [],
      conflicts: [],
    })

    const { pushPendingChangesInternal } = await loadPushPipeline()
    await pushPendingChangesInternal("token", true)

    expect(pushChangesMock).toHaveBeenCalledTimes(1)
    expect(pushChangesMock.mock.calls[0]?.[1].changes).toEqual([
      {
        collection: "nutrition",
        id: "2026-02-10",
        data: { date: "2026-02-10", entries: [] },
        baseVersion: 20,
        mutationId: "m-nutrition",
        deviceId: "device-1",
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

  it("acknowledges pending changes even when conflict reason is unknown to policy", async () => {
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
          reason: "UNKNOWN_REASON",
        },
      ],
    })

    const { pushPendingChangesInternal } = await loadPushPipeline()
    await pushPendingChangesInternal("token", true)

    expect(acknowledgeProcessedPendingChangesMock).toHaveBeenCalledWith([
      { collection: "foods", id: "food-1", mutationId: "m1" },
    ])
  })

  it("pushes a full snapshot and acknowledges accepted changes safely", async () => {
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
    expect(acknowledgeProcessedPendingChangesMock).toHaveBeenCalledTimes(1)
  })

  it("fails full snapshot when conflictMode is error and server returns conflicts", async () => {
    foodsToArrayMock.mockResolvedValue([{ id: "food-1" }])
    toCloudRecordMock.mockImplementation((_collection, record) => record)
    getRecordVersionMock.mockResolvedValue(0)
    pushChangesMock.mockResolvedValueOnce({
      acceptedChanges: [],
      conflicts: [
        {
          collection: "foods",
          id: "food-1",
          serverVersion: 4,
          clientBaseVersion: 0,
          reason: "VERSION_MISMATCH",
        },
      ],
    })

    const { pushFullSnapshot } = await loadPushPipeline()
    await expect(pushFullSnapshot("token", { conflictMode: "error" })).rejects.toThrow(
      "Full snapshot push conflicted on foods:food-1 (VERSION_MISMATCH)"
    )
    expect(setRecordVersionsBulkMock).not.toHaveBeenCalled()
    expect(acknowledgeProcessedPendingChangesMock).not.toHaveBeenCalled()
  })

  it("merges without conflict by skipping unchanged records and using remote versions for revives", async () => {
    foodsToArrayMock.mockResolvedValue([{ id: "food-same" }, { id: "food-new" }, { id: "food-revive" }])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "foods",
          id: "food-same",
          data: { id: "food-same" },
          version: 4,
          deleted: false,
        },
        {
          collection: "foods",
          id: "food-revive",
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

    const { mergeCloudAndLocal } = await loadPushPipeline()
    await mergeCloudAndLocal("token")

    const pushedChanges = readPushedChanges(pushChangesMock.mock.calls[0]?.[1])
    expect(pushedChanges).toHaveLength(2)
    expect(pushedChanges.find((change) => change.id === "food-same")).toBeUndefined()
    expect(pushedChanges.find((change) => change.id === "food-new")?.baseVersion).toBe(0)
    expect(pushedChanges.find((change) => change.id === "food-revive")?.baseVersion).toBe(7)
  })

  it("auto-resolves same-record merge differences with local preference when remote is not newer", async () => {
    foodsToArrayMock.mockResolvedValue([{ id: "food-1", name: "local" }])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "foods",
          id: "food-1",
          data: { id: "food-1", name: "cloud" },
          version: 5,
          deleted: false,
        },
      ],
      cursor: { version: 5 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["foods"]),
    })

    pushChangesMock.mockResolvedValueOnce({
      acceptedChanges: [
        {
          collection: "foods",
          id: "food-1",
          version: 6,
          mutationId: "merge-m1",
        },
      ],
      conflicts: [],
    })

    const { mergeCloudAndLocal } = await loadPushPipeline()
    const summary = await mergeCloudAndLocal("token")
    expect(summary).toMatchObject({
      pushed: 1,
      localWins: 1,
      remoteWins: 0,
      mergedRecords: 0,
    })
    expect(pushChangesMock).toHaveBeenCalledTimes(1)
  })

  it("treats updatedAt-only drift as equal during merge", async () => {
    foodsToArrayMock.mockResolvedValue([{ id: "food-1", name: "same", updatedAt: 200 }])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "foods",
          id: "food-1",
          data: { id: "food-1", name: "same", updatedAt: 100 },
          version: 5,
          deleted: false,
        },
      ],
      cursor: { version: 5 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["foods"]),
    })

    const { mergeCloudAndLocal } = await loadPushPipeline()
    const summary = await mergeCloudAndLocal("token")

    expect(summary).toMatchObject({
      pushed: 0,
      skippedEqual: 1,
    })
    expect(pushChangesMock).not.toHaveBeenCalled()
  })

  it("keeps remote nutrition entry when remote record is newer", async () => {
    nutritionToArrayMock.mockResolvedValue([
      {
        date: "2026-02-12",
        updatedAt: 100,
        entries: [
          {
            id: "entry-1",
            foodId: "food-1",
            quantity: 1,
            mealType: "breakfast",
            updatedAt: 100,
          },
        ],
      },
    ])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "nutrition",
          id: "2026-02-12",
          data: {
            date: "2026-02-12",
            updatedAt: 200,
            entries: [
              {
                id: "entry-1",
                foodId: "food-1",
                quantity: 2,
                mealType: "breakfast",
                updatedAt: 200,
              },
            ],
          },
          version: 7,
          deleted: false,
        },
      ],
      cursor: { version: 7 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["nutrition"]),
    })

    const { mergeCloudAndLocal } = await loadPushPipeline()
    const summary = await mergeCloudAndLocal("token")

    expect(summary.pushed).toBe(0)
    expect(summary.remoteWins).toBe(1)
    expect(pushChangesMock).not.toHaveBeenCalled()
  })

  it("does not resurrect local-only nutrition entries when remote includes tombstone", async () => {
    nutritionToArrayMock.mockResolvedValue([
      {
        date: "2026-02-12",
        updatedAt: 100,
        entries: [
          {
            id: "entry-1",
            foodId: "food-1",
            quantity: 1,
            mealType: "breakfast",
            updatedAt: 100,
          },
          {
            id: "entry-local-stale",
            foodId: "food-2",
            quantity: 1,
            mealType: "lunch",
            updatedAt: 120,
          },
        ],
      },
    ])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "nutrition",
          id: "2026-02-12",
          data: {
            date: "2026-02-12",
            updatedAt: 200,
            entries: [
              {
                id: "entry-1",
                foodId: "food-1",
                quantity: 2,
                mealType: "breakfast",
                updatedAt: 200,
              },
              {
                id: "entry-local-stale",
                foodId: "food-2",
                quantity: 1,
                mealType: "lunch",
                updatedAt: 200,
                deletedAt: 200,
              },
            ],
          },
          version: 7,
          deleted: false,
        },
      ],
      cursor: { version: 7 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["nutrition"]),
    })

    const { mergeCloudAndLocal } = await loadPushPipeline()
    const summary = await mergeCloudAndLocal("token")

    expect(summary).toMatchObject({
      pushed: 0,
      remoteWins: 1,
    })
    expect(pushChangesMock).not.toHaveBeenCalled()
  })

  it("resolves concurrent nutrition edit-edit by newer entry updatedAt", async () => {
    nutritionToArrayMock.mockResolvedValue([
      {
        date: "2026-02-12",
        updatedAt: 300,
        entries: [
          {
            id: "entry-1",
            foodId: "food-1",
            quantity: 3,
            mealType: "breakfast",
            updatedAt: 300,
          },
        ],
      },
    ])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "nutrition",
          id: "2026-02-12",
          data: {
            date: "2026-02-12",
            updatedAt: 250,
            entries: [
              {
                id: "entry-1",
                foodId: "food-1",
                quantity: 2,
                mealType: "breakfast",
                updatedAt: 250,
              },
            ],
          },
          version: 7,
          deleted: false,
        },
      ],
      cursor: { version: 7 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["nutrition"]),
    })

    pushChangesMock.mockImplementation(async (_token, payload: { changes: PushChange[] }) => ({
      acceptedChanges: makeAcceptedFromChanges(payload.changes),
      conflicts: [],
    }))

    const { mergeCloudAndLocal } = await loadPushPipeline()
    const summary = await mergeCloudAndLocal("token")

    expect(summary).toMatchObject({
      pushed: 1,
      localWins: 1,
    })
    const pushedChanges = readPushedChanges(pushChangesMock.mock.calls[0]?.[1])
    expect(pushedChanges[0]?.data).toMatchObject({
      entries: [
        {
          id: "entry-1",
          quantity: 3,
          updatedAt: 300,
        },
      ],
    })
  })

  it("resolves concurrent nutrition delete-edit by newer tombstone", async () => {
    nutritionToArrayMock.mockResolvedValue([
      {
        date: "2026-02-12",
        updatedAt: 200,
        entries: [
          {
            id: "entry-1",
            foodId: "food-1",
            quantity: 3,
            mealType: "breakfast",
            updatedAt: 200,
          },
        ],
      },
    ])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "nutrition",
          id: "2026-02-12",
          data: {
            date: "2026-02-12",
            updatedAt: 300,
            entries: [
              {
                id: "entry-1",
                foodId: "food-1",
                quantity: 3,
                mealType: "breakfast",
                updatedAt: 300,
                deletedAt: 300,
              },
            ],
          },
          version: 7,
          deleted: false,
        },
      ],
      cursor: { version: 7 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["nutrition"]),
    })

    const { mergeCloudAndLocal } = await loadPushPipeline()
    const summary = await mergeCloudAndLocal("token")

    expect(summary).toMatchObject({
      pushed: 0,
      remoteWins: 1,
    })
    expect(pushChangesMock).not.toHaveBeenCalled()
  })

  it("uses delete-wins tie-break when nutrition entry updatedAt ties", async () => {
    nutritionToArrayMock.mockResolvedValue([
      {
        date: "2026-02-12",
        updatedAt: 300,
        entries: [
          {
            id: "entry-1",
            foodId: "food-1",
            quantity: 3,
            mealType: "breakfast",
            updatedAt: 300,
          },
        ],
      },
    ])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "nutrition",
          id: "2026-02-12",
          data: {
            date: "2026-02-12",
            updatedAt: 300,
            entries: [
              {
                id: "entry-1",
                foodId: "food-1",
                quantity: 3,
                mealType: "breakfast",
                updatedAt: 300,
                deletedAt: 300,
              },
            ],
          },
          version: 7,
          deleted: false,
        },
      ],
      cursor: { version: 7 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["nutrition"]),
    })

    const { mergeCloudAndLocal } = await loadPushPipeline()
    const summary = await mergeCloudAndLocal("token")

    expect(summary).toMatchObject({
      pushed: 0,
      remoteWins: 1,
    })
    expect(pushChangesMock).not.toHaveBeenCalled()
  })

  it("sorts merged nutrition entries deterministically by updatedAt then id", async () => {
    nutritionToArrayMock.mockResolvedValue([
      {
        date: "2026-02-12",
        updatedAt: 500,
        entries: [
          {
            id: "entry-b",
            foodId: "food-2",
            quantity: 1,
            mealType: "lunch",
            updatedAt: 100,
          },
          {
            id: "entry-a",
            foodId: "food-1",
            quantity: 1,
            mealType: "breakfast",
            updatedAt: 100,
          },
          {
            id: "entry-c",
            foodId: "food-3",
            quantity: 1,
            mealType: "dinner",
            updatedAt: 300,
          },
        ],
      },
    ])
    toCloudRecordMock.mockImplementation((_collection, record) => record)

    pullAllChangesMock.mockResolvedValueOnce({
      changes: [
        {
          collection: "nutrition",
          id: "2026-02-12",
          data: {
            date: "2026-02-12",
            updatedAt: 400,
            entries: [
              {
                id: "entry-a",
                foodId: "food-1",
                quantity: 2,
                mealType: "breakfast",
                updatedAt: 200,
              },
            ],
          },
          version: 7,
          deleted: false,
        },
      ],
      cursor: { version: 7 },
      serverTimestampMs: Date.now(),
      affectedCollections: new Set(["nutrition"]),
    })

    pushChangesMock.mockImplementation(async (_token, payload: { changes: PushChange[] }) => ({
      acceptedChanges: makeAcceptedFromChanges(payload.changes),
      conflicts: [],
    }))

    const { mergeCloudAndLocal } = await loadPushPipeline()
    const summary = await mergeCloudAndLocal("token")
    expect(summary.pushed).toBe(1)

    const pushedChanges = readPushedChanges(pushChangesMock.mock.calls[0]?.[1])
    const data = pushedChanges[0]?.data
    const entries = isRecord(data) && Array.isArray(data.entries)
      ? data.entries.filter(
        (entry): entry is { id: string } => isRecord(entry) && typeof entry.id === "string"
      )
      : []
    expect(entries.map((entry) => entry.id)).toEqual(["entry-b", "entry-a", "entry-c"])
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
  })
})
