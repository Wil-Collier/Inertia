import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { format } from "date-fns"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { WorkoutPage } from "@/pages/WorkoutPage"
import type { Exercise, WorkoutTemplate } from "@/lib/types"

interface LinkProps {
  children?: ReactNode
}

interface NavigateProps {
  to: string
}

const workoutPageState = vi.hoisted(() => ({
  navigate: vi.fn(),
  startWorkout: vi.fn(),
  activeSession: null as unknown,
  templates: [] as WorkoutTemplate[],
  workoutDates: [] as string[],
  workouts: [] as Array<{ id: string; name: string; date: string; duration?: number }>,
  exercisesById: new Map<string, Exercise>(),
  toastError: vi.fn(),
}))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => workoutPageState.navigate,
  Link: ({ children }: LinkProps) => <div>{children}</div>,
  Navigate: ({ to }: NavigateProps) => <div data-testid="navigate">{to}</div>,
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => workoutPageState.toastError(...args),
  },
}))

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, rightAction }: { title: string; rightAction?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {rightAction}
    </div>
  ),
}))

vi.mock("@/features/workout/hooks/useActiveSession", () => ({
  useActiveSession: () => ({ data: workoutPageState.activeSession }),
  useActiveSessionActions: () => ({ startWorkout: workoutPageState.startWorkout }),
}))

vi.mock("@/features/workout/queries", () => ({
  useTemplates: () => ({ data: workoutPageState.templates }),
  useWorkoutDates: () => ({ data: workoutPageState.workoutDates }),
  useWorkoutStats: () => ({ data: { workouts: workoutPageState.workouts } }),
}))

vi.mock("@/features/exercises/queries", () => ({
  useExercisesByIds: () => ({ data: workoutPageState.exercisesById }),
}))

describe("WorkoutPage", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    workoutPageState.activeSession = null
    workoutPageState.templates = []
    workoutPageState.workoutDates = []
    workoutPageState.workouts = []
    workoutPageState.exercisesById = new Map()
  })

  it("redirects to active workout when a session already exists", () => {
    workoutPageState.activeSession = { id: "active-session" }

    render(<WorkoutPage />)

    expect(screen.getByTestId("navigate").textContent).toBe("/workout/active")
  })

  it("starts a blank workout with trimmed name and navigates", async () => {
    const user = userEvent.setup()
    workoutPageState.startWorkout.mockResolvedValue(undefined)

    render(<WorkoutPage />)

    await user.click(screen.getByText("Empty Workout"))
    await user.type(screen.getByRole("textbox"), "  Push Day  ")
    await user.click(screen.getByRole("button", { name: "Let's Go" }))

    await waitFor(() => {
      expect(workoutPageState.startWorkout).toHaveBeenCalledWith({ name: "Push Day" })
      expect(workoutPageState.navigate).toHaveBeenCalledWith({ to: "/workout/active" })
    })
  })

  it("uses default workout name when submitted empty via Enter", async () => {
    const user = userEvent.setup()
    workoutPageState.startWorkout.mockResolvedValue(undefined)

    render(<WorkoutPage />)

    await user.click(screen.getByText("Empty Workout"))
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(workoutPageState.startWorkout).toHaveBeenCalledWith({
        name: `${format(new Date(), "MMMM d")} Workout`,
      })
    })
  })

  it("starts template workouts with template id and surfaces start failures", async () => {
    const user = userEvent.setup()
    workoutPageState.templates = [
      {
        id: "template-1",
        name: "Leg Builder",
        exercises: [{ exerciseId: "back-squat", targetSets: 3, targetReps: 8, targetWeight: 225 }],
      },
    ]
    workoutPageState.exercisesById = new Map([
      [
        "back-squat",
        {
          id: "back-squat",
          name: "Back Squat",
          muscleGroup: "legs",
          isCustom: false,
          isWeighted: true,
          isTimeBased: false,
        },
      ],
    ])
    workoutPageState.startWorkout.mockResolvedValue(undefined)

    render(<WorkoutPage />)

    await user.click(screen.getByText("Leg Builder"))
    await waitFor(() => {
      expect(workoutPageState.startWorkout).toHaveBeenCalledWith({
        name: "Leg Builder",
        templateId: "template-1",
      })
      expect(workoutPageState.navigate).toHaveBeenCalledWith({ to: "/workout/active" })
    })

    workoutPageState.startWorkout.mockRejectedValueOnce(new Error("failed"))
    await user.click(screen.getByText("Leg Builder"))
    await waitFor(() => {
      expect(workoutPageState.toastError).toHaveBeenCalledWith("Failed to start template workout. Please try again.")
    })
  })
})
