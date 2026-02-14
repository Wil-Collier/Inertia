import { beforeEach, describe, expect, it, vi } from "vitest"
import type { MockInstance } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { recalculateDerivedData } from "@/features/sync/derivedData"
import { statsService } from "@/services/statsService"
import { achievementService } from "@/services/achievementService"

let recalculateAllSpy: MockInstance
let ensureInitializedSpy: MockInstance
let checkWorkoutAchievementsSpy: MockInstance
let checkNutritionAchievementsSpy: MockInstance
let checkTemplateAchievementsSpy: MockInstance
let updateStreaksSpy: MockInstance

describe("recalculateDerivedData", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.restoreAllMocks()
    recalculateAllSpy = vi.spyOn(statsService, "recalculateAll").mockResolvedValue({
      totalWorkouts: 0,
      totalVolumeLbs: 0,
      lastUpdated: new Date().toISOString(),
    })
    ensureInitializedSpy = vi.spyOn(achievementService, "ensureInitialized").mockResolvedValue(undefined)
    checkWorkoutAchievementsSpy = vi.spyOn(achievementService, "checkWorkoutAchievements").mockResolvedValue(undefined)
    checkNutritionAchievementsSpy = vi.spyOn(achievementService, "checkNutritionAchievements").mockResolvedValue(undefined)
    checkTemplateAchievementsSpy = vi.spyOn(achievementService, "checkTemplateAchievements").mockResolvedValue(undefined)
    updateStreaksSpy = vi.spyOn(achievementService, "updateStreaks").mockResolvedValue(undefined)
  })

  it("rebuilds personal records and stats when workouts change", async () => {
    await db.workoutSessions.bulkPut([
      {
        id: "w1",
        name: "Push",
        date: "2026-02-06",
        weightUnit: "kg",
        exerciseIds: ["bench"],
        exercises: [
          {
            id: "wex-1",
            exerciseId: "bench",
            sets: [
              { id: "s1", reps: 5, weight: 100, isCompleted: true },
              { id: "s2", reps: 0, weight: 0, isCompleted: true },
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
            sets: [{ id: "s3", reps: 3, weight: 110, isCompleted: true }],
          },
        ],
      },
    ])

    await recalculateDerivedData(new Set(["workouts"]))

    const pr = await db.personalRecords.get("bench")
    expect(pr).toMatchObject({
      exerciseId: "bench",
      workoutId: "w2",
      date: "2026-02-07",
      weight: 110,
      reps: 3,
    })
    expect(recalculateAllSpy).toHaveBeenCalledTimes(1)
  })

  it("runs nutrition achievement checks and streak updates when nutrition changes", async () => {
    await recalculateDerivedData(new Set(["nutrition"]))

    expect(recalculateAllSpy).not.toHaveBeenCalled()
    expect(ensureInitializedSpy).toHaveBeenCalledTimes(1)
    expect(checkNutritionAchievementsSpy).toHaveBeenCalledTimes(1)
    expect(updateStreaksSpy).toHaveBeenCalledTimes(1)
    expect(checkWorkoutAchievementsSpy).not.toHaveBeenCalled()
  })

  it("recalculates workout-derived data and relevant achievements when workouts/templates change", async () => {
    await recalculateDerivedData(new Set(["workouts", "templates"]))

    expect(recalculateAllSpy).toHaveBeenCalledTimes(1)
    expect(checkWorkoutAchievementsSpy).toHaveBeenCalledTimes(1)
    expect(checkTemplateAchievementsSpy).toHaveBeenCalledTimes(1)
    expect(updateStreaksSpy).toHaveBeenCalledTimes(1)
  })

  it("does nothing when affected collections do not impact derived data", async () => {
    await recalculateDerivedData(new Set())

    expect(recalculateAllSpy).not.toHaveBeenCalled()
    expect(checkWorkoutAchievementsSpy).not.toHaveBeenCalled()
    expect(checkNutritionAchievementsSpy).not.toHaveBeenCalled()
    expect(checkTemplateAchievementsSpy).not.toHaveBeenCalled()
    expect(updateStreaksSpy).not.toHaveBeenCalled()
  })
})
