import { beforeEach, describe, expect, it } from "vitest"
import {
  acknowledgeProcessedPendingChanges,
  clearSyncMetadata,
  enqueuePendingChange,
  getLastSyncedAtMs,
  getPullCursor,
  getRecordVersion,
  listPendingChanges,
  setLastSyncedAtMs,
  setPullCursor,
  setRecordVersion,
} from "@/features/sync/changeTracker"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"

describe("changeTracker integration", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("upserts pending changes and preserves original baseVersion", async () => {
    await enqueuePendingChange({
      collection: "foods",
      id: "food-1",
      deleted: false,
      baseVersion: 2,
      mutationId: "m1",
      enqueuedAt: 100,
    })

    await enqueuePendingChange({
      collection: "foods",
      id: "food-1",
      deleted: true,
      baseVersion: 99,
      mutationId: "m2",
      enqueuedAt: 200,
    })

    const rows = await listPendingChanges()
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      collection: "foods",
      id: "food-1",
      deleted: true,
      baseVersion: 2,
      mutationId: "m2",
      enqueuedAt: 200,
    })
  })

  it("acknowledges only matching mutation IDs", async () => {
    await db.syncPendingChanges.put({
      collection: "workouts",
      id: "w1",
      deleted: false,
      baseVersion: 0,
      mutationId: "newer",
      enqueuedAt: 1,
    })

    await acknowledgeProcessedPendingChanges([
      { collection: "workouts", id: "w1", mutationId: "older" },
    ])

    expect(await db.syncPendingChanges.get(["workouts", "w1"])).toBeTruthy()

    await acknowledgeProcessedPendingChanges([
      { collection: "workouts", id: "w1", mutationId: "newer" },
    ])

    expect(await db.syncPendingChanges.get(["workouts", "w1"])).toBeUndefined()
  })

  it("persists cursor and last-synced metadata", async () => {
    await setPullCursor({ version: 22 })
    await setLastSyncedAtMs(123_456)

    expect(await getPullCursor()).toEqual({ version: 22 })
    expect(await getLastSyncedAtMs()).toBe(123_456)

    await clearSyncMetadata()

    expect(await getPullCursor()).toBeNull()
    expect(await getLastSyncedAtMs()).toBeNull()
  })

  it("reads and writes record versions", async () => {
    expect(await getRecordVersion("nutrition", "2026-02-07")).toBe(0)

    await setRecordVersion("nutrition", "2026-02-07", 11)
    expect(await getRecordVersion("nutrition", "2026-02-07")).toBe(11)
  })
})
