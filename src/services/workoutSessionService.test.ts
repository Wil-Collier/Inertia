import { beforeEach, describe, expect, it, vi } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { workoutSessionService } from "@/services/workoutSessionService"

describe("workoutSessionService", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.restoreAllMocks()
  })

  it("saves and retrieves active session using stable singleton key", async () => {
    await workoutSessionService.saveActiveSession({
      workout: {
        id: "workout-1",
        name: "Push",
        date: "2026-02-07",
        exercises: [],
        weightUnit: "kg",
      },
      startedAt: "2026-02-07T00:00:00.000Z",
      templateId: "tpl-1",
    })

    const persisted = await db.activeSession.get("current")
    expect(persisted?.id).toBe("current")

    const read = await workoutSessionService.getActiveSession()
    expect(read).toMatchObject({
      workout: { id: "workout-1", name: "Push" },
      templateId: "tpl-1",
    })
    expect("id" in (read ?? {})).toBe(false)
  })

  it("deletes active session cleanly", async () => {
    await db.activeSession.put({
      id: "current",
      workout: { id: "w1", name: "Pull", date: "2026-02-07", exercises: [], weightUnit: "kg" },
      startedAt: "2026-02-07T00:00:00.000Z",
    })

    await workoutSessionService.deleteActiveSession()
    expect(await db.activeSession.get("current")).toBeUndefined()
  })

  it("returns undefined when storage read fails", async () => {
    vi.spyOn(db.activeSession, "get").mockRejectedValueOnce(new Error("read failed"))
    await expect(workoutSessionService.getActiveSession()).resolves.toBeUndefined()
  })
})
