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

  it("starts a valid empty workout when template id is unknown", async () => {
    const session = await activeSessionService.startWorkout("No Template", "missing-template")

    expect(session.templateId).toBe("missing-template")
    expect(session.workout.exercises).toEqual([])
    expect(session.workout.name).toBe("No Template")
  })

  it("throws when starting a workout while an active session already exists", async () => {
    await activeSessionService.startWorkout("First Session")

    await expect(activeSessionService.startWorkout("Second Session")).rejects.toThrow(
      "An active workout session already exists"
    )

    const sessions = await db.activeSession.toArray()
    expect(sessions).toHaveLength(1)
    expect(sessions[0]?.workout.name).toBe("First Session")
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

  it("adds, updates, toggles and removes sets while persisting session state", async () => {
    await activeSessionService.startWorkout("Set Flow")
    await activeSessionService.updateWorkoutName("Set Flow Updated")
    await activeSessionService.addExercise("bench")

    const initial = await db.activeSession.get("current")
    if (!initial) throw new Error("expected active session")

    const workoutExercise = initial.workout.exercises[0]
    if (!workoutExercise) throw new Error("expected workout exercise")

    await activeSessionService.updateExerciseNotes(workoutExercise.id, "Keep bar path stable")

    const firstSetId = workoutExercise.sets[0]?.id
    if (!firstSetId) throw new Error("expected initial set")

    await activeSessionService.updateSet(workoutExercise.id, firstSetId, { reps: 8, weight: 185 })
    await activeSessionService.toggleSetComplete(workoutExercise.id, firstSetId)
    await activeSessionService.addSet(workoutExercise.id)

    let session = await db.activeSession.get("current")
    if (!session) throw new Error("expected active session")

    expect(session.workout.name).toBe("Set Flow Updated")

    const exerciseAfterAdd = session.workout.exercises[0]
    if (!exerciseAfterAdd) throw new Error("expected workout exercise")

    expect(exerciseAfterAdd.notes).toBe("Keep bar path stable")
    expect(exerciseAfterAdd.sets).toHaveLength(2)
    expect(exerciseAfterAdd.sets[0]).toMatchObject({ reps: 8, weight: 185, isCompleted: true })
    expect(exerciseAfterAdd.sets[1]).toMatchObject({ reps: 8, weight: 185, isCompleted: false })

    const secondSetId = exerciseAfterAdd.sets[1]?.id
    if (!secondSetId) throw new Error("expected second set")

    await activeSessionService.removeSet(workoutExercise.id, secondSetId)
    await activeSessionService.removeExercise(workoutExercise.id)

    session = await db.activeSession.get("current")
    expect(session?.workout.exercises).toHaveLength(0)
  })

  it("clamps set reps to at least one when updating", async () => {
    await activeSessionService.startWorkout("Clamp Reps")
    await activeSessionService.addExercise("bench")

    const session = await db.activeSession.get("current")
    const workoutExercise = session?.workout.exercises[0]
    const setId = workoutExercise?.sets[0]?.id
    if (!workoutExercise || !setId) throw new Error("expected workout exercise set")

    await activeSessionService.updateSet(workoutExercise.id, setId, { reps: 0 })

    const updated = await db.activeSession.get("current")
    expect(updated?.workout.exercises[0]?.sets[0]?.reps).toBe(1)
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

  it("records exercise ids and ignores invalid sets when updating PRs", async () => {
    vi.spyOn(achievementService, "updateStreaks").mockResolvedValue()
    vi.spyOn(achievementService, "checkWorkoutAchievements").mockResolvedValue()

    await activeSessionService.startWorkout("PR Filtering")
    const session = await db.activeSession.get("current")
    if (!session) throw new Error("expected active session")

    session.workout.exercises = [
      {
        id: "wex-bench",
        exerciseId: "bench",
        sets: [
          { id: "invalid-weight", reps: 5, weight: 0, isCompleted: true },
          { id: "invalid-reps", reps: 0, weight: 225, isCompleted: true },
          { id: "valid", reps: 5, weight: 200, isCompleted: true },
        ],
      },
      {
        id: "wex-row",
        exerciseId: "row",
        sets: [{ id: "row-invalid", reps: 6, weight: 0, isCompleted: true }],
      },
    ]

    await db.activeSession.put(session)

    const completed = await activeSessionService.finishWorkout()
    await flushAsyncTasks()

    expect(completed?.exerciseIds).toEqual(["bench", "row"])
    expect(await db.personalRecords.get("bench")).toMatchObject({ weight: 200, reps: 5 })
    expect(await db.personalRecords.get("row")).toBeUndefined()
  })

  it("stores the best PR when duplicate exercise blocks exist in one workout", async () => {
    vi.spyOn(achievementService, "updateStreaks").mockResolvedValue()
    vi.spyOn(achievementService, "checkWorkoutAchievements").mockResolvedValue()

    await activeSessionService.startWorkout("Duplicate Exercise PR")
    const session = await db.activeSession.get("current")
    if (!session) throw new Error("expected active session")

    session.workout.exercises = [
      {
        id: "wex-bench-1",
        exerciseId: "bench",
        sets: [{ id: "set-high", reps: 4, weight: 245, isCompleted: true }],
      },
      {
        id: "wex-bench-2",
        exerciseId: "bench",
        sets: [{ id: "set-low", reps: 10, weight: 135, isCompleted: true }],
      },
    ]

    await db.activeSession.put(session)

    await activeSessionService.finishWorkout()
    await flushAsyncTasks()

    expect(await db.personalRecords.get("bench")).toMatchObject({ weight: 245, reps: 4 })
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

  it("deduplicates repeated reorder ids while preserving stable order", async () => {
    await activeSessionService.startWorkout("Reorder Duplicates")
    const session = await db.activeSession.get("current")
    if (!session) throw new Error("expected active session")

    session.workout.exercises = [
      { id: "e1", exerciseId: "bench", sets: [] },
      { id: "e2", exerciseId: "squat", sets: [] },
      { id: "e3", exerciseId: "row", sets: [] },
    ]
    await db.activeSession.put(session)

    await activeSessionService.reorderExercises(["e3", "e3", "e1"])

    const reordered = await db.activeSession.get("current")
    expect(reordered?.workout.exercises.map((exercise) => exercise.id)).toEqual(["e3", "e1", "e2"])
  })

  it("cancels safely even when no active session exists", async () => {
    await expect(activeSessionService.cancelWorkout()).resolves.toBeUndefined()
    await expect(activeSessionService.cancelWorkout()).resolves.toBeUndefined()
    expect(await db.activeSession.get("current")).toBeUndefined()
  })
})
