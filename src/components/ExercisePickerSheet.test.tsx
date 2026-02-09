import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { ExercisePickerSheet } from "@/components/ExercisePickerSheet"
import type { Exercise } from "@/lib/types"

interface ExercisesHookState {
  data: Exercise[]
  isLoading: boolean
}

interface AddExerciseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (exerciseId: string) => void
  exerciseToEdit?: Exercise | null
}

const TEST_EXERCISES: Exercise[] = [
  {
    id: "bench-press",
    name: "Bench Press",
    muscleGroup: "chest",
    isCustom: false,
    isWeighted: true,
    isTimeBased: false,
  },
  {
    id: "back-squat",
    name: "Back Squat",
    muscleGroup: "legs",
    isCustom: false,
    isWeighted: true,
    isTimeBased: false,
  },
  {
    id: "custom-plank",
    name: "Custom Plank Hold",
    muscleGroup: "core",
    isCustom: true,
    isWeighted: false,
    isTimeBased: true,
  },
]

const testState = vi.hoisted(() => ({
  exercisesHook: {
    data: [] as Exercise[],
    isLoading: false,
  } as ExercisesHookState,
  lastAddExerciseDialogProps: null as AddExerciseDialogProps | null,
}))

vi.mock("@/features/exercises/queries", () => ({
  useExercises: () => testState.exercisesHook,
}))

vi.mock("@/components/ExerciseInfoSheet", () => ({
  ExerciseInfoButton: ({ exercise }: { exercise: Exercise }) => (
    <span aria-label={`Info ${exercise.name}`} />
  ),
}))

vi.mock("@/components/AddExerciseDialog", () => ({
  AddExerciseDialog: (props: AddExerciseDialogProps) => {
    testState.lastAddExerciseDialogProps = props

    if (!props.open) return null

    return (
      <div data-testid="add-exercise-dialog">
        <p>{props.exerciseToEdit ? `Editing: ${props.exerciseToEdit.name}` : "Creating exercise"}</p>
        <button
          type="button"
          onClick={() => {
            props.onOpenChange(false)
            props.onSuccess?.(props.exerciseToEdit?.id ?? "new-custom-exercise")
          }}
        >
          Confirm Exercise Dialog
        </button>
      </div>
    )
  },
}))

interface SheetProps {
  open?: boolean
  onOpenChange?: (open: boolean) => void
  children?: ReactNode
}

interface SheetContentProps {
  children?: ReactNode
}

interface SheetHeaderProps {
  children?: ReactNode
}

interface SheetTitleProps {
  children?: ReactNode
}

vi.mock("@/components/ui/sheet", () => ({
  Sheet: ({ open, onOpenChange, children }: SheetProps) => (
    <div>
      {open ? (
        <>
          <button type="button" onClick={() => onOpenChange?.(false)}>
            Close Sheet
          </button>
          {children}
        </>
      ) : null}
    </div>
  ),
  SheetContent: ({ children }: SheetContentProps) => <div>{children}</div>,
  SheetHeader: ({ children }: SheetHeaderProps) => <div>{children}</div>,
  SheetTitle: ({ children }: SheetTitleProps) => <h2>{children}</h2>,
}))

vi.mock("@/components/ui/scroll-area", () => ({
  ScrollArea: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
}))

describe("ExercisePickerSheet", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    testState.exercisesHook = {
      data: [...TEST_EXERCISES],
      isLoading: false,
    }
    testState.lastAddExerciseDialogProps = null
  })

  it("renders loading state while exercises are being fetched", () => {
    testState.exercisesHook = {
      data: [],
      isLoading: true,
    }

    render(
      <ExercisePickerSheet
        isOpen={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    )

    expect(screen.getByText("Loading exercises...")).toBeTruthy()
  })

  it("prevents selecting already added exercises and selects available ones", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <ExercisePickerSheet
        isOpen={true}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
        addedExerciseIds={["bench-press"]}
      />
    )

    const benchButton = screen.getByRole("button", { name: "Bench Press" })
    expect(benchButton.hasAttribute("disabled")).toBe(true)
    await user.click(benchButton)
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(screen.getByRole("button", { name: "Back Squat" }))
    expect(onSelect).toHaveBeenCalledWith("back-squat")
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("applies search/filter controls and shows empty states", async () => {
    const user = userEvent.setup()

    render(
      <ExercisePickerSheet
        isOpen={true}
        onOpenChange={vi.fn()}
        onSelect={vi.fn()}
      />
    )

    await user.click(screen.getByRole("button", { name: "Custom" }))
    expect(screen.getByRole("button", { name: "Custom Plank Hold" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Bench Press" })).toBeNull()

    await user.click(screen.getByRole("button", { name: "Legs" }))
    expect(screen.getByRole("button", { name: "Back Squat" })).toBeTruthy()
    expect(screen.queryByRole("button", { name: "Custom Plank Hold" })).toBeNull()

    await user.type(screen.getByPlaceholderText("Search exercises..."), "zzz")
    expect(screen.queryByText("No exercises found")).toBeNull()

    await waitFor(() => {
      expect(screen.getByText("No exercises found")).toBeTruthy()
      expect(screen.getByText("Try a different search term or filter")).toBeTruthy()
    })
  })

  it("resets search state immediately when the sheet closes", async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()

    render(
      <ExercisePickerSheet
        isOpen={true}
        onOpenChange={onOpenChange}
        onSelect={vi.fn()}
      />
    )

    const searchInput = screen.getByPlaceholderText("Search exercises...")
    await user.type(searchInput, "bench")
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Back Squat" })).toBeNull()
    })

    await user.click(screen.getByRole("button", { name: "Close Sheet" }))

    expect(onOpenChange).toHaveBeenCalledWith(false)
    expect(searchInput instanceof HTMLInputElement).toBe(true)
    if (!(searchInput instanceof HTMLInputElement)) {
      throw new Error("Expected search input element")
    }
    expect(searchInput.value).toBe("")
    expect(screen.getByRole("button", { name: "Back Squat" })).toBeTruthy()
    expect(screen.getByRole("button", { name: "Bench Press" })).toBeTruthy()
  })

  it("supports create and edit dialog flows correctly", async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onOpenChange = vi.fn()

    render(
      <ExercisePickerSheet
        isOpen={true}
        onOpenChange={onOpenChange}
        onSelect={onSelect}
      />
    )

    await user.click(screen.getByRole("button", { name: "New" }))
    expect(screen.getByTestId("add-exercise-dialog")).toBeTruthy()
    expect(screen.getByText("Creating exercise")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Confirm Exercise Dialog" }))
    expect(onSelect).toHaveBeenCalledWith("new-custom-exercise")
    expect(onOpenChange).toHaveBeenCalledWith(false)

    await user.click(screen.getByRole("button", { name: "Edit Custom Plank Hold" }))
    expect(screen.getByText("Editing: Custom Plank Hold")).toBeTruthy()

    onSelect.mockClear()
    await user.click(screen.getByRole("button", { name: "Confirm Exercise Dialog" }))
    expect(onSelect).not.toHaveBeenCalled()
  })
})
