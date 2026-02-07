import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { getLastPerformance } from "@/services/workoutService"

describe("workoutService.getLastPerformance", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("returns null when no workout contains the requested exercise", async () => {
    await db.workoutSessions.put({
      id: "w1",
      name: "Push",
      date: "2026-02-06",
      weightUnit: "kg",
      exerciseIds: ["bench"],
      exercises: [{ id: "wex-1", exerciseId: "bench", sets: [{ id: "s1", reps: 5, weight: 100, isCompleted: true }] }],
    })

    await expect(getLastPerformance("squat")).resolves.toBeNull()
  })

  it("returns newest meaningful completed set history for the exercise", async () => {
    await db.workoutSessions.bulkPut([
      {
        id: "w1",
        name: "Push",
        date: "2026-02-05",
        weightUnit: "kg",
        exerciseIds: ["bench"],
        exercises: [
          {
            id: "wex-1",
            exerciseId: "bench",
            sets: [
              { id: "s1", reps: 5, weight: 90, isCompleted: true },
              { id: "s2", reps: 5, weight: 92.5, isCompleted: false },
            ],
          },
        ],
      },
      {
        id: "w2",
        name: "Push",
        date: "2026-02-07",
        weightUnit: "kg",
        exerciseIds: ["bench"],
        exercises: [
          {
            id: "wex-2",
            exerciseId: "bench",
            sets: [
              { id: "s3", reps: 3, weight: 110, isCompleted: true },
              { id: "s4", reps: 2, weight: 115, isCompleted: true },
            ],
          },
        ],
      },
    ])

    const last = await getLastPerformance("bench")

    expect(last?.workoutId).toBe("w2")
    expect(last?.date).toBe("2026-02-07")
    expect(last?.sets).toEqual([
      { weight: 110, reps: 3 },
      { weight: 115, reps: 2 },
    ])
  })

  it("falls back to non-completed sets with data when no sets are marked complete", async () => {
    await db.workoutSessions.put({
      id: "w3",
      name: "Pull",
      date: "2026-02-07",
      weightUnit: "kg",
      exerciseIds: ["row"],
      exercises: [
        {
          id: "wex-3",
          exerciseId: "row",
          sets: [
            { id: "s1", reps: 0, weight: 0, isCompleted: false },
            { id: "s2", reps: 10, weight: 60, isCompleted: false },
          ],
        },
      ],
    })

    const last = await getLastPerformance("row")
    expect(last?.sets).toEqual([{ weight: 60, reps: 10 }])
  })
})
