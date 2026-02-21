import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { applyPulledChanges } from "@/features/sync/engine/applyPipeline"
import { acknowledgeProcessedPendingChanges, getRecordVersion } from "@/features/sync/tracking/changeTracker"
import type { PullChange } from "@/features/sync/model/schemas"

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

  it("skips invalid pulled records and advances version to prevent infinite retries", async () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})

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

    // Should resolve (not throw) — invalid records are skipped with a warning
    await applyPulledChanges([invalidChange])

    // Invalid record should NOT be persisted
    expect(await db.workoutSessions.get("w-invalid")).toBeUndefined()

    // Version IS advanced so the sync cursor moves past the bad record
    expect(await getRecordVersion("workouts", "w-invalid")).toBe(10)

    // A warning should have been logged
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("workouts:w-invalid")
    )

    warnSpy.mockRestore()
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
