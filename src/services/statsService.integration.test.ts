import { beforeEach, describe, expect, it } from "vitest"
import { statsService } from "@/services/statsService"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createWorkout, createWorkoutExercise, createWorkoutSet } from "@/test/factories/workoutFactory"

describe("statsService integration", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("initializes empty stats when no workouts exist", async () => {
    const stats = await statsService.getStats()

    expect(stats.totalWorkouts).toBe(0)
    expect(stats.totalVolumeLbs).toBe(0)

    const persisted = await db.userStats.get("stats")
    expect(persisted).toBeTruthy()
  })

  it("rebuilds stats from workout history when stats record is missing", async () => {
    const workout = createWorkout({
      weightUnit: "kg",
      exercises: [
        createWorkoutExercise({
          sets: [createWorkoutSet({ weight: 100, reps: 5, isCompleted: true })],
        }),
      ],
    })

    await db.workoutSessions.put(workout)
    const stats = await statsService.getStats()

    expect(stats.totalWorkouts).toBe(1)
    expect(stats.totalVolumeLbs).toBeCloseTo(1102.31, 2)
  })

  it("adds, updates and removes workouts without dropping below zero", async () => {
    const initial = createWorkout({
      id: "w1",
      weightUnit: "lbs",
      exercises: [
        createWorkoutExercise({
          sets: [createWorkoutSet({ weight: 100, reps: 5, isCompleted: true })],
        }),
      ],
    })

    await db.workoutSessions.put(initial)
    await statsService.addWorkout(initial)

    const updated = {
      ...initial,
      exercises: [
        createWorkoutExercise({
          sets: [createWorkoutSet({ weight: 120, reps: 5, isCompleted: true })],
        }),
      ],
    }

    await statsService.updateWorkout(initial, updated)
    let stats = await statsService.getStats()
    expect(stats.totalWorkouts).toBe(1)
    expect(stats.totalVolumeLbs).toBe(600)

    await statsService.removeWorkout(updated)
    stats = await statsService.getStats()
    expect(stats.totalWorkouts).toBe(0)
    expect(stats.totalVolumeLbs).toBe(0)

    await statsService.removeWorkout(updated)
    stats = await statsService.getStats()
    expect(stats.totalWorkouts).toBe(0)
    expect(stats.totalVolumeLbs).toBe(0)
  })

  it("recalculates all stats from persisted workouts", async () => {
    await db.workoutSessions.bulkPut([
      createWorkout({
        id: "w1",
        exercises: [createWorkoutExercise({ sets: [createWorkoutSet({ weight: 100, reps: 10, isCompleted: true })] })],
      }),
      createWorkout({
        id: "w2",
        exercises: [createWorkoutExercise({ sets: [createWorkoutSet({ weight: 200, reps: 5, isCompleted: true })] })],
      }),
    ])

    const stats = await statsService.recalculateAll()

    expect(stats.totalWorkouts).toBe(2)
    expect(stats.totalVolumeLbs).toBe(2000)
  })
})
