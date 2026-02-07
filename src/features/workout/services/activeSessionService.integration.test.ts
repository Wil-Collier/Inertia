import { beforeEach, describe, expect, it, vi } from "vitest"
import { activeSessionService } from "@/features/workout/services/activeSessionService"
import { db } from "@/services/db"
import { clearDatabase, flushAsyncTasks } from "@/test/helpers/dbTestUtils"
import { achievementService } from "@/services/achievementService"

describe("activeSessionService integration", () => {
  beforeEach(async () => {
    await clearDatabase()
    vi.restoreAllMocks()
  })

  it("starts a workout using current weight-unit setting", async () => {
    await db.settings.put({
      id: "settings",
      theme: "system",
      restTimerDuration: 90,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "lbs", distance: "mi" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    })

    const session = await activeSessionService.startWorkout("Bench Day")

    expect(session.workout.weightUnit).toBe("lbs")
    expect((await db.activeSession.get("current"))?.workout.weightUnit).toBe("lbs")
  })

  it("builds template exercises and enforces at least one set", async () => {
    await db.workoutTemplates.put({
      id: "template-1",
      name: "Template",
      exercises: [{ exerciseId: "squat", targetSets: 0, targetReps: 5, targetWeight: 225 }],
    })

    const session = await activeSessionService.startWorkout("From Template", "template-1")

    expect(session.workout.exercises).toHaveLength(1)
    expect(session.workout.exercises[0]?.sets).toHaveLength(1)
    expect(session.workout.exercises[0]?.sets[0]).toMatchObject({ reps: 5, weight: 225, isCompleted: false })
  })

  it("finishes active workout by moving it to history and clearing active session", async () => {
    vi.spyOn(achievementService, "updateStreaks").mockResolvedValue()
    vi.spyOn(achievementService, "checkWorkoutAchievements").mockResolvedValue()

    await db.settings.put({
      id: "settings",
      theme: "system",
      restTimerDuration: 90,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "lbs", distance: "mi" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    })

    await activeSessionService.startWorkout("Session")
    const session = await db.activeSession.get("current")
    if (!session) throw new Error("expected active session")

    session.workout.exercises = [
      {
        id: "wex-1",
        exerciseId: "bench",
        sets: [
          { id: "set-1", reps: 5, weight: 225, isCompleted: true },
          { id: "set-2", reps: 5, weight: 235, isCompleted: true },
        ],
      },
    ]

    await db.activeSession.put(session)

    const completed = await activeSessionService.finishWorkout()
    await flushAsyncTasks()

    expect(completed).toBeTruthy()
    expect(await db.activeSession.get("current")).toBeUndefined()

    const persisted = await db.workoutSessions.get(completed?.id ?? "")
    expect(persisted?.exerciseIds).toEqual(["bench"])
    expect(await db.personalRecords.get("bench")).toMatchObject({ weight: 235, reps: 5 })

    const stats = await db.userStats.get("stats")
    expect(stats?.totalWorkouts).toBe(1)
    expect(stats?.totalVolumeLbs).toBe(2300)
  })

  it("returns null when finish is requested without an active session", async () => {
    await expect(activeSessionService.finishWorkout()).resolves.toBeNull()
  })

  it("reorders exercises and preserves unmentioned exercises", async () => {
    await activeSessionService.startWorkout("Reorder")
    const session = await db.activeSession.get("current")
    if (!session) throw new Error("expected active session")

    session.workout.exercises = [
      { id: "e1", exerciseId: "bench", sets: [] },
      { id: "e2", exerciseId: "squat", sets: [] },
      { id: "e3", exerciseId: "row", sets: [] },
    ]
    await db.activeSession.put(session)

    await activeSessionService.reorderExercises(["e3", "e1"])

    const reordered = await db.activeSession.get("current")
    expect(reordered?.workout.exercises.map((exercise) => exercise.id)).toEqual(["e3", "e1", "e2"])
  })
})
