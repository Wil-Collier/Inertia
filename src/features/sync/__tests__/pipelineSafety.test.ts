import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/services/db"
import { applyPulledChanges } from "@/features/sync/engine/applyPipeline"
import { acknowledgeProcessedPendingChanges, getRecordVersion } from "@/features/sync/changeTracker"
import type { PullChange } from "@/features/sync/schemas"

async function clearSyncTables() {
  await db.transaction("rw", [db.workoutSessions, db.syncPendingChanges, db.syncRecordVersions], async () => {
    await db.workoutSessions.clear()
    await db.syncPendingChanges.clear()
    await db.syncRecordVersions.clear()
  })
}

describe("sync pipeline safety", () => {
  beforeEach(async () => {
    await clearSyncTables()
  })

  it("does not advance record version when pulled payload fails validation", async () => {
    const invalidChange: PullChange = {
      collection: "workouts",
      id: "w-invalid",
      data: {
        // Missing required workout fields on purpose.
        foo: "bar",
      },
      version: 10,
      deleted: false,
    }

    await expect(applyPulledChanges([invalidChange])).rejects.toThrow(
      "Invalid pulled record for workouts:w-invalid"
    )

    expect(await db.workoutSessions.get("w-invalid")).toBeUndefined()
    expect(await getRecordVersion("workouts", "w-invalid")).toBe(0)
  })

  it("only clears pending change rows when mutation id matches", async () => {
    await db.syncPendingChanges.put({
      collection: "workouts",
      id: "w1",
      deleted: false,
      baseVersion: 0,
      mutationId: "newer-mutation",
      enqueuedAt: Date.now(),
    })

    await acknowledgeProcessedPendingChanges([
      {
        collection: "workouts",
        id: "w1",
        mutationId: "older-mutation",
      },
    ])

    expect(await db.syncPendingChanges.get(["workouts", "w1"])).toMatchObject({
      mutationId: "newer-mutation",
    })

    await acknowledgeProcessedPendingChanges([
      {
        collection: "workouts",
        id: "w1",
        mutationId: "newer-mutation",
      },
    ])

    expect(await db.syncPendingChanges.get(["workouts", "w1"])).toBeUndefined()
  })
})
