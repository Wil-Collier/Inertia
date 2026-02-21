import { renderHook } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { useWorkoutChanges } from "@/features/workout/hooks/useWorkoutChanges"
import type { Workout, WorkoutTemplate } from "@/lib/types"

function buildWorkout(): Workout {
  return {
    id: "w1",
    name: "Push",
    date: "2026-02-07",
    weightUnit: "kg",
    exercises: [
      {
        id: "wex-1",
        exerciseId: "bench",
        notes: undefined,
        sets: [{ id: "set-1", reps: 5, weight: 100, isCompleted: false }],
      },
    ],
  }
}

function buildTemplate(): WorkoutTemplate {
  return {
    id: "tpl-1",
    name: "Push Template",
    exercises: [{ exerciseId: "bench", targetSets: 1, targetReps: 5, targetWeight: 100 }],
  }
}

describe("useWorkoutChanges", () => {
  it("returns false when there is no active workout", () => {
    const { result } = renderHook(() =>
      useWorkoutChanges({
        workout: undefined,
        templateId: undefined,
        templates: [],
        completedSets: 0,
      })
    )

    expect(result.current.hasChanges()).toBe(false)
  })

  it("returns true for user-entered notes or completed sets", () => {
    const withNotes = buildWorkout()
    withNotes.exercises[0].notes = "keep shoulder blades tight"

    const notesResult = renderHook(() =>
      useWorkoutChanges({
        workout: withNotes,
        templateId: undefined,
        templates: [],
        completedSets: 0,
      })
    )
    expect(notesResult.result.current.hasChanges()).toBe(true)

    const completedResult = renderHook(() =>
      useWorkoutChanges({
        workout: buildWorkout(),
        templateId: undefined,
        templates: [],
        completedSets: 1,
      })
    )
    expect(completedResult.result.current.hasChanges()).toBe(true)
  })

  it("detects added exercises when workout did not start from a template", () => {
    const { result } = renderHook(() =>
      useWorkoutChanges({
        workout: buildWorkout(),
        templateId: undefined,
        templates: [],
        completedSets: 0,
      })
    )

    expect(result.current.hasChanges()).toBe(true)
  })

  it("returns false when workout still matches its template defaults", () => {
    const { result } = renderHook(() =>
      useWorkoutChanges({
        workout: buildWorkout(),
        templateId: "tpl-1",
        templates: [buildTemplate()],
        completedSets: 0,
      })
    )

    expect(result.current.hasChanges()).toBe(false)
  })

  it("returns true when template-based workout changes exercise order or set targets", () => {
    const swappedExerciseWorkout = buildWorkout()
    swappedExerciseWorkout.exercises[0].exerciseId = "incline-bench"

    const swappedResult = renderHook(() =>
      useWorkoutChanges({
        workout: swappedExerciseWorkout,
        templateId: "tpl-1",
        templates: [buildTemplate()],
        completedSets: 0,
      })
    )
    expect(swappedResult.result.current.hasChanges()).toBe(true)

    const editedSetWorkout = buildWorkout()
    editedSetWorkout.exercises[0].sets[0].reps = 8
    const editedResult = renderHook(() =>
      useWorkoutChanges({
        workout: editedSetWorkout,
        templateId: "tpl-1",
        templates: [buildTemplate()],
        completedSets: 0,
      })
    )
    expect(editedResult.result.current.hasChanges()).toBe(true)
  })
})
