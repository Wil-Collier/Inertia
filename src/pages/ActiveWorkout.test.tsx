import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { ActiveWorkout } from "@/pages/ActiveWorkout"
import type { ActiveWorkoutSession, Exercise, Workout, WorkoutTemplate } from "@/lib/types"

interface HeaderProps {
  title: string
  onBack?: () => void
  bottomContent?: ReactNode
}

interface ExercisePickerSheetProps {
  isOpen: boolean
  onSelect: (exerciseId: string) => void
}

const activeWorkoutState = vi.hoisted(() => ({
  navigate: vi.fn(),
  activeSession: null as ActiveWorkoutSession | null,
  isLoading: false,
  finishWorkout: vi.fn(),
  cancelWorkout: vi.fn(),
  addExercise: vi.fn(),
  removeExercise: vi.fn(),
  addSet: vi.fn(),
  updateSet: vi.fn(),
  removeSet: vi.fn(),
  toggleSetComplete: vi.fn(),
  updateExerciseNotes: vi.fn(),
  createTemplateMutateAsync: vi.fn(),
  templates: [] as WorkoutTemplate[],
  exercisesById: new Map<string, Exercise>(),
  hasChanges: false,
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  unlockAudio: vi.fn(),
  playDingSound: vi.fn(),
  timerStart: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => activeWorkoutState.navigate,
  Navigate: ({ to }: { to: string }) => <div data-testid="navigate">{to}</div>,
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => activeWorkoutState.toastSuccess(...args),
    error: (...args: unknown[]) => activeWorkoutState.toastError(...args),
  },
}))

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, onBack, bottomContent }: HeaderProps) => (
    <div>
      <h1>{title}</h1>
      <button type="button" onClick={onBack}>
        Back
      </button>
      {bottomContent}
    </div>
  ),
}))

vi.mock("@/components/workout/RestTimerBanner", () => ({
  RestTimerBanner: () => <div>Rest Timer Banner</div>,
}))

vi.mock("@/components/workout/WorkoutProgressSummary", () => ({
  WorkoutProgressSummary: () => <div>Workout Progress</div>,
}))

vi.mock("@/components/workout/WorkoutExerciseCard", () => ({
  WorkoutExerciseCard: () => <div>Workout Exercise Card</div>,
}))

vi.mock("@/components/ExercisePickerSheet", () => ({
  ExercisePickerSheet: ({ isOpen, onSelect }: ExercisePickerSheetProps) =>
    isOpen ? (
      <button type="button" onClick={() => onSelect("bench")}>
        Select Bench
      </button>
    ) : null,
}))

vi.mock("@/features/workout/hooks/useActiveSession", () => ({
  useActiveSession: () => ({
    data: activeWorkoutState.activeSession,
    isLoading: activeWorkoutState.isLoading,
  }),
  useActiveSessionActions: () => ({
    finishWorkout: activeWorkoutState.finishWorkout,
    cancelWorkout: activeWorkoutState.cancelWorkout,
    addExercise: activeWorkoutState.addExercise,
    removeExercise: activeWorkoutState.removeExercise,
    addSet: activeWorkoutState.addSet,
    updateSet: activeWorkoutState.updateSet,
    removeSet: activeWorkoutState.removeSet,
    toggleSetComplete: activeWorkoutState.toggleSetComplete,
    updateExerciseNotes: activeWorkoutState.updateExerciseNotes,
  }),
}))

vi.mock("@/features/workout/queries", () => ({
  useTemplates: () => ({ data: activeWorkoutState.templates }),
}))

vi.mock("@/features/workout/mutations", () => ({
  useCreateTemplate: () => ({ mutateAsync: activeWorkoutState.createTemplateMutateAsync }),
}))

vi.mock("@/features/exercises/queries", () => ({
  useExercisesByIds: () => ({ data: activeWorkoutState.exercisesById }),
}))

vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({
    data: {
      restTimerDuration: 90,
    },
  }),
}))

vi.mock("@/hooks/useRestTimer", () => ({
  useRestTimerControls: () => ({
    start: activeWorkoutState.timerStart,
    reset: vi.fn(),
    setDuration: vi.fn(),
  }),
}))

vi.mock("@/hooks/useCountdownTimer", () => ({
  useCountdownTimer: () => ({
    activeSetId: null,
    formattedTime: "00:00",
    isRunning: false,
    start: vi.fn(),
    pause: vi.fn(),
    resume: vi.fn(),
  }),
}))

vi.mock("@/hooks/useWeightUnit", () => ({
  useWeightUnit: () => ({
    unitLabel: "kg",
  }),
}))

vi.mock("@/hooks/useWorkoutChanges", () => ({
  useWorkoutChanges: () => ({
    hasChanges: () => activeWorkoutState.hasChanges,
  }),
}))

vi.mock("@/lib/audio", () => ({
  unlockAudio: (...args: unknown[]) => activeWorkoutState.unlockAudio(...args),
  playDingSound: (...args: unknown[]) => activeWorkoutState.playDingSound(...args),
}))

function createWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "workout-1",
    name: "Session",
    date: "2026-02-09",
    weightUnit: "kg",
    exercises: [
      {
        id: "exercise-1",
        exerciseId: "bench",
        sets: [{ id: "set-1", reps: 5, weight: 225, isCompleted: true }],
      },
    ],
    ...overrides,
  }
}

function createActiveSession(overrides: Partial<ActiveWorkoutSession> = {}): ActiveWorkoutSession {
  return {
    workout: createWorkout(),
    startedAt: "2026-02-09T10:00:00.000Z",
    ...overrides,
  }
}

describe("ActiveWorkout", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    activeWorkoutState.activeSession = createActiveSession()
    activeWorkoutState.isLoading = false
    activeWorkoutState.finishWorkout.mockResolvedValue(createWorkout())
    activeWorkoutState.cancelWorkout.mockResolvedValue(undefined)
    activeWorkoutState.addExercise.mockResolvedValue(undefined)
    activeWorkoutState.createTemplateMutateAsync.mockResolvedValue({ id: "template-1" })
    activeWorkoutState.hasChanges = false
  })

  it("cancels immediately on back when there are no unsaved changes", async () => {
    const user = userEvent.setup()

    render(<ActiveWorkout />)

    await user.click(screen.getByRole("button", { name: "Back" }))

    await waitFor(() => {
      expect(activeWorkoutState.cancelWorkout).toHaveBeenCalledTimes(1)
      expect(activeWorkoutState.navigate).toHaveBeenCalledWith({ to: "/workout" })
    })
    expect(screen.queryByText("Cancel Workout?")).toBeNull()
  })

  it("opens cancel confirmation on back when unsaved changes exist", async () => {
    const user = userEvent.setup()
    activeWorkoutState.hasChanges = true

    render(<ActiveWorkout />)

    await user.click(screen.getByRole("button", { name: "Back" }))

    expect(await screen.findByText("Cancel Workout?")).toBeTruthy()
    expect(activeWorkoutState.cancelWorkout).not.toHaveBeenCalled()
  })

  it("finishes and creates template when save-as-template is enabled", async () => {
    const user = userEvent.setup()

    render(<ActiveWorkout />)

    await user.click(screen.getByRole("button", { name: "Finish Workout" }))
    await user.click(await screen.findByRole("checkbox"))
    await user.type(screen.getByPlaceholderText("Template name"), "  Power Builder  ")
    await user.click(screen.getByRole("button", { name: "Finish" }))

    await waitFor(() => {
      expect(activeWorkoutState.createTemplateMutateAsync).toHaveBeenCalledWith({
        name: "Power Builder",
        exercises: [
          {
            exerciseId: "bench",
            targetSets: 1,
            targetReps: 5,
            targetWeight: 225,
          },
        ],
      })
      expect(activeWorkoutState.navigate).toHaveBeenCalledWith({ to: "/workout" })
    })
  })

  it("shows an error toast when add exercise fails", async () => {
    const user = userEvent.setup()
    activeWorkoutState.addExercise.mockRejectedValueOnce(new Error("failed"))

    render(<ActiveWorkout />)

    await user.click(screen.getByRole("button", { name: "Add Exercise" }))
    await user.click(screen.getByRole("button", { name: "Select Bench" }))

    await waitFor(() => {
      expect(activeWorkoutState.toastError).toHaveBeenCalledWith("Failed to add exercise")
    })
  })
})
