import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { pushPendingChangesInternal } from "@/features/sync/engine/pushPipeline"
import { setRecordVersion } from "@/features/sync/changeTracker"
import type { PushChange } from "@/features/sync/schemas"

const pushChangesMock = vi.fn()

vi.mock("@/features/sync/api", () => ({
  pushChanges: (...args: unknown[]) => pushChangesMock(...args),
}))

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function isPushChange(value: unknown): value is PushChange {
  if (!isRecord(value)) return false
  return (
    typeof value.collection === "string" &&
    typeof value.id === "string" &&
    "data" in value &&
    typeof value.baseVersion === "number" &&
    typeof value.mutationId === "string"
  )
}

function readPushedChanges(value: unknown): PushChange[] {
  if (!isRecord(value) || !Array.isArray(value.changes)) return []
  if (!value.changes.every(isPushChange)) return []
  return value.changes
}

describe("pushPipeline integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    pushChangesMock.mockReset()
  })

  it("pushes nutrition pending changes with known synced version instead of stale baseVersion zero", async () => {
    await db.transaction("rw", [db.nutritionLogs, db.syncPendingChanges, db.syncRecordVersions], async () => {
      await db.nutritionLogs.put({
        date: "2026-02-10",
        entries: [],
      })

      await setRecordVersion("nutrition", "2026-02-10", 20)

      await db.syncPendingChanges.put({
        collection: "nutrition",
        id: "2026-02-10",
        deleted: false,
        baseVersion: 0,
        mutationId: "m-nutrition",
        enqueuedAt: Date.now(),
      })
    })

    pushChangesMock.mockImplementation(async (_token: string, payload: { changes: PushChange[] }) => {
      const [change] = payload.changes
      if (!change || change.baseVersion !== 20) {
        return {
          acceptedChanges: [],
          conflicts: [
            {
              collection: "nutrition",
              id: "2026-02-10",
              serverVersion: 20,
              clientBaseVersion: change?.baseVersion ?? -1,
              reason: "VERSION_MISMATCH",
            },
          ],
        }
      }

      return {
        acceptedChanges: [
          {
            collection: "nutrition",
            id: "2026-02-10",
            version: 21,
            mutationId: change.mutationId,
          },
        ],
        conflicts: [],
      }
    })

    await pushPendingChangesInternal("token", false)

    const pushedChanges = readPushedChanges(pushChangesMock.mock.calls[0]?.[1])
    expect(pushChangesMock).toHaveBeenCalledTimes(1)
    expect(pushedChanges[0]).toMatchObject({
      collection: "nutrition",
      id: "2026-02-10",
      baseVersion: 20,
    })
    expect(await db.syncPendingChanges.get(["nutrition", "2026-02-10"])).toBeUndefined()
  })
})
