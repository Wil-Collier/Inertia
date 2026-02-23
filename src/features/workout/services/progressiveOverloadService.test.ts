import { beforeEach, describe, expect, it } from "vitest"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import {
  getLastUsedWeightForExercise,
  getTemplateExerciseRecommendedWeight,
} from "@/features/workout/services/progressiveOverloadService"

describe("progressiveOverloadService", () => {
  beforeEach(async () => {
    await clearDatabase()
  })

  it("recommends a weight increase after straight-set success", async () => {
    await db.workoutSessions.put({
      id: "w-success",
      name: "Squat Day",
      date: "2026-02-20",
      weightUnit: "lbs",
      exerciseIds: ["squat"],
      exercises: [
        {
          id: "wex-1",
          exerciseId: "squat",
          sets: [
            { id: "set-1", reps: 8, weight: 100, isCompleted: true },
            { id: "set-2", reps: 9, weight: 100, isCompleted: true },
            { id: "set-3", reps: 9, weight: 100, isCompleted: true },
          ],
        },
      ],
    })

    const recommended = await getTemplateExerciseRecommendedWeight({
      exerciseId: "squat",
      targetSets: 3,
      targetReps: 8,
      targetWeightUnit: "lbs",
    })

    expect(recommended).toBe(105)
  })

  it("holds weight when straight-set target was not fully met", async () => {
    await db.workoutSessions.put({
      id: "w-hold",
      name: "Squat Day",
      date: "2026-02-20",
      weightUnit: "lbs",
      exerciseIds: ["squat"],
      exercises: [
        {
          id: "wex-1",
          exerciseId: "squat",
          sets: [
            { id: "set-1", reps: 8, weight: 100, isCompleted: true },
            { id: "set-2", reps: 7, weight: 100, isCompleted: true },
            { id: "set-3", reps: 7, weight: 90, isCompleted: true },
          ],
        },
      ],
    })

    const recommended = await getTemplateExerciseRecommendedWeight({
      exerciseId: "squat",
      targetSets: 3,
      targetReps: 8,
      targetWeightUnit: "lbs",
    })

    expect(recommended).toBe(100)
  })

  it("holds weight on inconsistent loading even if reps are met", async () => {
    await db.workoutSessions.put({
      id: "w-inconsistent",
      name: "Squat Day",
      date: "2026-02-20",
      weightUnit: "lbs",
      exerciseIds: ["squat"],
      exercises: [
        {
          id: "wex-1",
          exerciseId: "squat",
          sets: [
            { id: "set-1", reps: 8, weight: 95, isCompleted: true },
            { id: "set-2", reps: 8, weight: 100, isCompleted: true },
            { id: "set-3", reps: 8, weight: 90, isCompleted: true },
          ],
        },
      ],
    })

    const recommended = await getTemplateExerciseRecommendedWeight({
      exerciseId: "squat",
      targetSets: 3,
      targetReps: 8,
      targetWeightUnit: "lbs",
    })

    expect(recommended).toBe(100)
  })

  it("returns zero when no history exists for an exercise", async () => {
    const lastUsedWeight = await getLastUsedWeightForExercise({
      exerciseId: "squat",
      targetWeightUnit: "lbs",
    })
    const recommendedWeight = await getTemplateExerciseRecommendedWeight({
      exerciseId: "squat",
      targetSets: 3,
      targetReps: 8,
      targetWeightUnit: "lbs",
    })

    expect(lastUsedWeight).toBe(0)
    expect(recommendedWeight).toBe(0)
  })

  it("converts history unit before recommending next load", async () => {
    await db.workoutSessions.put({
      id: "w-kg",
      name: "Squat Day",
      date: "2026-02-20",
      weightUnit: "kg",
      exerciseIds: ["squat"],
      exercises: [
        {
          id: "wex-1",
          exerciseId: "squat",
          sets: [
            { id: "set-1", reps: 8, weight: 100, isCompleted: true },
            { id: "set-2", reps: 8, weight: 100, isCompleted: true },
            { id: "set-3", reps: 8, weight: 100, isCompleted: true },
          ],
        },
      ],
    })

    const lastUsedLbs = await getLastUsedWeightForExercise({
      exerciseId: "squat",
      targetWeightUnit: "lbs",
    })
    const recommendedLbs = await getTemplateExerciseRecommendedWeight({
      exerciseId: "squat",
      targetSets: 3,
      targetReps: 8,
      targetWeightUnit: "lbs",
    })

    expect(lastUsedLbs).toBe(220)
    expect(recommendedLbs).toBe(225)
  })
})
