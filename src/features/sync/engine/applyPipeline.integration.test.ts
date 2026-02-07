import { beforeEach, describe, expect, it } from "vitest"
import { applyPulledChanges } from "@/features/sync/engine/applyPipeline"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { getRecordVersion, setRecordVersion } from "@/features/sync/changeTracker"

describe("applyPulledChanges integration", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("applies pulled nutrition + foods and rebuilds food usage counts", async () => {
    await applyPulledChanges([
      {
        collection: "foods",
        id: "food-1",
        data: {
          id: "food-1",
          name: "Rice",
          calories: 130,
          protein: 2.4,
          carbs: 28,
          fat: 0.3,
          fiber: 0.4,
          sugar: 0.1,
          servingSize: "100g",
          isCustom: true,
        },
        version: 3,
        deleted: false,
      },
      {
        collection: "nutrition",
        id: "2026-02-07",
        data: {
          date: "2026-02-07",
          entries: [
            { id: "m1", foodId: "food-1", quantity: 1, mealType: "breakfast" },
            { id: "m2", foodId: "food-1", quantity: 2, mealType: "dinner" },
          ],
        },
        version: 4,
        deleted: false,
      },
    ])

    const food = await db.foods.get("food-1")
    expect(food?.usageCount).toBe(2)
    expect(await getRecordVersion("foods", "food-1")).toBe(3)
    expect(await getRecordVersion("nutrition", "2026-02-07")).toBe(4)
  })

  it("rebuilds workout exerciseIds from pulled workout payload", async () => {
    await applyPulledChanges([
      {
        collection: "workouts",
        id: "w1",
        data: {
          id: "w1",
          name: "Pull Day",
          date: "2026-02-07",
          weightUnit: "kg",
          exercises: [
            { id: "we1", exerciseId: "bench", sets: [] },
            { id: "we2", exerciseId: "row", sets: [] },
          ],
        },
        version: 10,
        deleted: false,
      },
    ])

    const workout = await db.workoutSessions.get("w1")
    expect(workout?.exerciseIds).toEqual(["bench", "row"])
    expect(await getRecordVersion("workouts", "w1")).toBe(10)
  })

  it("deletes local records and clears versions for tombstone changes", async () => {
    await db.workoutSessions.put({
      id: "w-delete",
      name: "Delete Me",
      date: "2026-02-06",
      weightUnit: "kg",
      exercises: [],
    })
    await setRecordVersion("workouts", "w-delete", 12)

    await applyPulledChanges([
      {
        collection: "workouts",
        id: "w-delete",
        data: null,
        version: 13,
        deleted: true,
      },
    ])

    expect(await db.workoutSessions.get("w-delete")).toBeUndefined()
    expect(await getRecordVersion("workouts", "w-delete")).toBe(0)
  })
})
