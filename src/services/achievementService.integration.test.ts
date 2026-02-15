import { beforeEach, describe, expect, it, vi } from "vitest"
import { achievementService } from "@/services/achievementService"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { subDays } from "date-fns"
import { formatDate } from "@/lib/dateUtils"

vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  },
}))

function dateString(offsetDays: number): string {
  return formatDate(subDays(new Date(), Math.abs(offsetDays)))
}

describe("achievementService integration", () => {
  beforeEach(async () => {
    vi.useRealTimers()
    await clearDatabase()
  })

  it("initializes achievements record with default streaks", async () => {
    await achievementService.ensureInitialized()

    const record = await db.achievements.get("achievements")
    expect(record).toBeTruthy()
    expect(record?.streaks.currentWorkoutStreak).toBe(0)
    expect(record?.unlockedAchievements).toEqual([])
  })

  it("recalculates workout and nutrition streaks from history", async () => {
    await db.workoutSessions.bulkPut([
      {
        id: "w1",
        name: "Workout",
        date: dateString(0),
        weightUnit: "kg",
        exercises: [],
      },
      {
        id: "w2",
        name: "Workout",
        date: dateString(-1),
        weightUnit: "kg",
        exercises: [],
      },
      {
        id: "w3",
        name: "Workout",
        date: dateString(-2),
        weightUnit: "kg",
        exercises: [],
      },
    ])

    await db.nutritionLogs.bulkPut([
      { date: dateString(0), entries: [{ id: "m1", foodId: "f1", quantity: 1, mealType: "breakfast", updatedAt: 1 }] },
      { date: dateString(-1), entries: [{ id: "m2", foodId: "f1", quantity: 1, mealType: "lunch", updatedAt: 1 }] },
      { date: dateString(-3), entries: [] },
    ])

    await achievementService.updateStreaks()

    const streaks = (await db.achievements.get("achievements"))?.streaks
    expect(streaks?.currentWorkoutStreak).toBe(3)
    expect(streaks?.currentNutritionStreak).toBe(2)
    expect(streaks?.longestWorkoutStreak).toBe(3)
    expect(streaks?.lastWorkoutDate).toBe(dateString(0))
  })

  it("unlocks macro tracker after seven logged nutrition days", async () => {
    await achievementService.ensureInitialized()

    const logs = Array.from({ length: 7 }).map((_, index) => ({
      date: dateString(-index),
      entries: [{ id: `entry-${index}`, foodId: "food-1", quantity: 1, mealType: "dinner" as const, updatedAt: index + 1 }],
    }))

    await db.nutritionLogs.bulkPut(logs)
    await achievementService.updateStreaks()
    await achievementService.checkNutritionAchievements()

    const unlocked = (await db.achievements.get("achievements"))?.unlockedAchievements.map((item) => item.id) ?? []
    expect(unlocked).toContain("macro-tracker")
  })

  it("unlocks workout/template/variety achievements from intended thresholds", async () => {
    await achievementService.ensureInitialized()

    await db.workoutTemplates.bulkPut([
      { id: "t1", name: "A", exercises: [] },
      { id: "t2", name: "B", exercises: [] },
      { id: "t3", name: "C", exercises: [] },
    ])

    const customExercises = [
      { id: "e-chest", name: "C", muscleGroup: "chest", isCustom: true, isWeighted: true, isTimeBased: false },
      { id: "e-back", name: "B", muscleGroup: "back", isCustom: true, isWeighted: true, isTimeBased: false },
      { id: "e-shoulders", name: "S", muscleGroup: "shoulders", isCustom: true, isWeighted: true, isTimeBased: false },
      { id: "e-arms", name: "A", muscleGroup: "arms", isCustom: true, isWeighted: true, isTimeBased: false },
      { id: "e-legs", name: "L", muscleGroup: "legs", isCustom: true, isWeighted: true, isTimeBased: false },
      { id: "e-core", name: "Core", muscleGroup: "core", isCustom: true, isWeighted: false, isTimeBased: true },
    ] as const

    await db.customExercises.bulkPut(customExercises)

    await db.workoutSessions.put({
      id: "workout-1",
      name: "Full Body",
      date: dateString(0),
      weightUnit: "kg",
      exercises: customExercises.map((exercise) => ({
        id: `we-${exercise.id}`,
        exerciseId: exercise.id,
        sets: [{ id: `set-${exercise.id}`, reps: 8, weight: 60, isCompleted: true }],
      })),
    })

    await achievementService.checkWorkoutAchievements()

    const unlocked = (await db.achievements.get("achievements"))?.unlockedAchievements.map((item) => item.id) ?? []
    expect(unlocked).toContain("first-workout")
    expect(unlocked).toContain("template-creator")
    expect(unlocked).toContain("full-body")
  })

  it("does not duplicate achievements on repeated unlock attempts", async () => {
    await achievementService.ensureInitialized()

    await achievementService.tryUnlock("first-workout", true)
    await achievementService.tryUnlock("first-workout", true)

    const unlocked = (await db.achievements.get("achievements"))?.unlockedAchievements ?? []
    expect(unlocked.filter((item) => item.id === "first-workout")).toHaveLength(1)
  })

  it("calculates streaks correctly around UTC day boundaries using DB dates", async () => {
    const today = formatDate(new Date())
    const yesterday = formatDate(subDays(new Date(), 1))
    await achievementService.recalculateStreaks([today, yesterday], [])

    const streaks = (await db.achievements.get("achievements"))?.streaks
    expect(streaks?.currentWorkoutStreak).toBe(2)
    expect(streaks?.lastWorkoutDate).toBe(today)
  })
})
