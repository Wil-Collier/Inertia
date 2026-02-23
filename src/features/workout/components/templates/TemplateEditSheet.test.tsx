import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TemplateEditSheet } from "@/features/workout/components/templates/TemplateEditSheet"
import type { Exercise, WorkoutTemplate } from "@/lib/types"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"

function createTemplate(): WorkoutTemplate {
  return {
    id: "template-1",
    name: "Push Day",
    exercises: [{ exerciseId: "bench", targetSets: 3, targetReps: 8 }],
  }
}

function createExerciseMap(): Map<string, Exercise> {
  return new Map([
    [
      "bench",
      {
        id: "bench",
        name: "Bench Press",
        muscleGroup: "chest",
        isCustom: true,
        isWeighted: true,
        isTimeBased: false,
      },
    ],
  ])
}

describe("TemplateEditSheet", () => {
  it("renders sets and reps controls without a weight input", () => {
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    render(
      <TemplateEditSheet
        template={createTemplate()}
        exercisesById={createExerciseMap()}
        editName="Push Day"
        onEditNameChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
        onClose={vi.fn()}
        onAddExercise={vi.fn().mockResolvedValue(undefined)}
        onRemoveExercise={vi.fn().mockResolvedValue(undefined)}
        onUpdateTargets={vi.fn().mockResolvedValue(undefined)}
        isSaving={false}
      />,
      { wrapper }
    )

    expect(screen.queryByText("Weight")).toBeNull()
    expect(screen.queryByPlaceholderText("-")).not.toBeNull()
  })

  it("updates only sets and reps targets", () => {
    const onUpdateTargets = vi.fn().mockResolvedValue(undefined)
    const queryClient = createTestQueryClient()
    const wrapper = createQueryWrapper(queryClient)

    render(
      <TemplateEditSheet
        template={createTemplate()}
        exercisesById={createExerciseMap()}
        editName="Push Day"
        onEditNameChange={vi.fn()}
        onSave={vi.fn().mockResolvedValue(true)}
        onClose={vi.fn()}
        onAddExercise={vi.fn().mockResolvedValue(undefined)}
        onRemoveExercise={vi.fn().mockResolvedValue(undefined)}
        onUpdateTargets={onUpdateTargets}
        isSaving={false}
      />,
      { wrapper }
    )

    const numericInputs = screen.getAllByRole("spinbutton")
    fireEvent.change(numericInputs[0], { target: { value: "4" } })
    fireEvent.change(numericInputs[1], { target: { value: "10" } })

    expect(onUpdateTargets).toHaveBeenCalledWith("bench", "targetSets", 4)
    expect(onUpdateTargets).toHaveBeenCalledWith("bench", "targetReps", 10)
  })
})
