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

async function loadPushPipeline() {
    return await import("@/features/sync/engine/pushPipeline")
}

describe("pushPipeline partial failure handling", () => {
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

    it("acknowledges accepted mutations for each successful batch in pushFullSnapshot", async () => {
        // Create enough records to span multiple batches (200 per batch)
        const count = 250
        workoutSessionsToArrayMock.mockResolvedValue(
            Array.from({ length: count }, (_, i) => ({ id: `workout-${i}` }))
        )
        toCloudRecordMock.mockImplementation((_collection, record) => record)
        getRecordVersionMock.mockResolvedValue(0)
        pushChangesMock.mockImplementation(async (_token, payload: { changes: PushChange[] }) => ({
            acceptedChanges: makeAcceptedFromChanges(payload.changes),
            conflicts: [],
        }))

        const { pushFullSnapshot } = await loadPushPipeline()
        await pushFullSnapshot("token")

        // Should have made 2 push calls (200 + 50)
        expect(pushChangesMock).toHaveBeenCalledTimes(2)

        // Should acknowledge accepted mutations for each batch immediately.
        expect(acknowledgeProcessedPendingChangesMock).toHaveBeenCalledTimes(2)
    })

    it("throws error when overwriteCloudWithLocal encounters conflicts", async () => {
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
            ],
            cursor: { version: 3 },
            serverTimestampMs: Date.now(),
            affectedCollections: new Set(["foods"]),
        })

        // Simulate a conflict - another device updated while we were pushing
        pushChangesMock.mockResolvedValueOnce({
            acceptedChanges: [],
            conflicts: [
                {
                    collection: "foods",
                    id: "food-local",
                    serverVersion: 4,
                    clientBaseVersion: 3,
                    reason: "VERSION_MISMATCH",
                },
            ],
        })

        const { overwriteCloudWithLocal } = await loadPushPipeline()

        await expect(overwriteCloudWithLocal("token")).rejects.toThrow(
            "Failed to overwrite cloud with local data. Conflicts on: foods:food-local"
        )
    })

    it("succeeds in overwriteCloudWithLocal when there are no conflicts", async () => {
        foodsToArrayMock.mockResolvedValue([{ id: "food-local" }])
        toCloudRecordMock.mockImplementation((_collection, record) => record)

        pullAllChangesMock.mockResolvedValueOnce({
            changes: [
                {
                    collection: "foods",
                    id: "food-remote-only",
                    data: { id: "food-remote-only" },
                    version: 5,
                    deleted: false,
                },
            ],
            cursor: { version: 5 },
            serverTimestampMs: Date.now(),
            affectedCollections: new Set(["foods"]),
        })

        pushChangesMock.mockImplementation(async (_token, payload: { changes: PushChange[] }) => ({
            acceptedChanges: makeAcceptedFromChanges(payload.changes),
            conflicts: [],
        }))

        const { overwriteCloudWithLocal } = await loadPushPipeline()
        await expect(overwriteCloudWithLocal("token")).resolves.toBeUndefined()
    })

    it("includes proper tombstones for remote-only records in overwriteCloudWithLocal", async () => {
        foodsToArrayMock.mockResolvedValue([{ id: "food-local" }])
        toCloudRecordMock.mockImplementation((_collection, record) => record)

        pullAllChangesMock.mockResolvedValueOnce({
            changes: [
                {
                    collection: "foods",
                    id: "food-local",
                    data: { id: "food-local" },
                    version: 1,
                    deleted: false,
                },
                {
                    collection: "foods",
                    id: "food-remote-only",
                    data: { id: "food-remote-only" },
                    version: 2,
                    deleted: false,
                },
            ],
            cursor: { version: 2 },
            serverTimestampMs: Date.now(),
            affectedCollections: new Set(["foods"]),
        })

        const capturedChanges: PushChange[] = []
        pushChangesMock.mockImplementation(async (_token, payload: { changes: PushChange[] }) => {
            capturedChanges.push(...payload.changes)
            return {
                acceptedChanges: makeAcceptedFromChanges(payload.changes),
                conflicts: [],
            }
        })

        const { overwriteCloudWithLocal } = await loadPushPipeline()
        await overwriteCloudWithLocal("token")

        // Should have tombstone for remote-only record
        const tombstone = capturedChanges.find(
            (c) => c.collection === "foods" && c.id === "food-remote-only"
        )
        expect(tombstone).toBeDefined()
        expect(tombstone?.data).toBeNull()
        expect(tombstone?.baseVersion).toBe(2)

        // Should have update for local record
        const localUpdate = capturedChanges.find(
            (c) => c.collection === "foods" && c.id === "food-local"
        )
        expect(localUpdate).toBeDefined()
        expect(localUpdate?.data).not.toBeNull()
    })
})
