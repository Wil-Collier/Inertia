import { describe, expect, it } from "vitest"
import {
  buildWorkoutExerciseFromTemplate,
  calculateOneRepMax,
  calculateSetVolume,
  getCompletedSets,
} from "@/lib/workoutUtils"
import { createWorkoutExercise, createWorkoutSet } from "@/test/factories/workoutFactory"

describe("workoutUtils", () => {
  it("calculates one-rep max across boundary conditions", () => {
    expect(calculateOneRepMax(225, 1)).toBe(225)
    expect(calculateOneRepMax(225, 0)).toBe(0)
    expect(calculateOneRepMax(100, 13)).toBeCloseTo(143.33, 2)
    expect(calculateOneRepMax(100, 10)).toBeCloseTo(133.33, 2)
  })

  it("returns only completed sets", () => {
    const sets = [
      createWorkoutSet({ isCompleted: true }),
      createWorkoutSet({ isCompleted: false }),
      createWorkoutSet({ isCompleted: true }),
    ]

    expect(getCompletedSets(sets)).toHaveLength(2)
  })

  it("calculates set volume using completed sets only", () => {
    const exercise = createWorkoutExercise({
      sets: [
        createWorkoutSet({ weight: 100, reps: 10, isCompleted: true }),
        createWorkoutSet({ weight: 200, reps: 5, isCompleted: false }),
        createWorkoutSet({ weight: 120, reps: 8, isCompleted: true }),
      ],
    })

    expect(calculateSetVolume(exercise.sets)).toBe(1960)
  })

  it("builds template exercises with at least one set", () => {
    const built = buildWorkoutExerciseFromTemplate({
      exerciseId: "squat",
      targetSets: 0,
      targetReps: 6,
      targetWeight: 225,
    })

    expect(built.exerciseId).toBe("squat")
    expect(built.sets).toHaveLength(1)
    expect(built.sets[0]).toMatchObject({ reps: 6, weight: 225, isCompleted: false })
  })
})
