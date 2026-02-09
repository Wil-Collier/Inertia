import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { cleanup, screen, waitFor } from "@testing-library/react"
import type { ReactNode } from "react"
import { db } from "@/services/db"
import { activeSessionService } from "@/features/workout/services/activeSessionService"
import { ActiveWorkout } from "@/pages/ActiveWorkout"
import { createSettings } from "@/test/factories/settingsFactory"
import {
  createActiveWorkoutSession,
  createWorkout,
  createWorkoutExercise,
  createWorkoutSet,
} from "@/test/factories/workoutFactory"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"

interface HeaderProps {
  title: string
  onBack?: () => void
  rightAction?: ReactNode
  bottomContent?: ReactNode
}

interface ExercisePickerSheetProps {
  isOpen: boolean
  onSelect: (exerciseId: string) => void
}

const activeWorkoutTestState = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastError: vi.fn(),
  unlockAudio: vi.fn(),
  playDingSound: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => activeWorkoutTestState.toastSuccess(...args),
    error: (...args: unknown[]) => activeWorkoutTestState.toastError(...args),
  },
}))

vi.mock("@/lib/audio", () => ({
  unlockAudio: (...args: unknown[]) => activeWorkoutTestState.unlockAudio(...args),
  playDingSound: (...args: unknown[]) => activeWorkoutTestState.playDingSound(...args),
}))

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, onBack, rightAction, bottomContent }: HeaderProps) => (
    <div>
      <h1>{title}</h1>
      <button type="button" onClick={onBack}>
        Back
      </button>
      {rightAction}
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
      <button type="button" onClick={() => onSelect("barbell-bench-press")}>
        Select Bench
      </button>
    ) : null,
}))

async function renderActiveWorkoutRoute() {
  return await renderAppRoute({
    initialPath: "/workout/active",
    routes: [
      { path: "/workout/active", component: ActiveWorkout },
      { path: "/workout", component: () => <h1>Workout Home</h1> },
    ],
  })
}

describe("ActiveWorkout", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await resetTestRuntime()
  })

  it("cancels immediately on back when no meaningful changes exist", async () => {
    const user = userEvent.setup()

    await seedTestState({
      settings: createSettings(),
      activeSession: createActiveWorkoutSession({
        workout: createWorkout({
          id: "workout-back-no-changes",
          name: "Session",
          date: "2026-02-09",
          exercises: [],
          exerciseIds: [],
        }),
      }),
    })

    const { router } = await renderActiveWorkoutRoute()
    await screen.findByRole("button", { name: "Back" })

    await user.click(screen.getByRole("button", { name: "Back" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout")
    })

    expect(await db.activeSession.get("current")).toBeUndefined()
    expect(screen.queryByText("Cancel Workout?")).toBeNull()
  })

  it("opens confirmation dialog and stays on page when unsaved changes exist", async () => {
    const user = userEvent.setup()

    await seedTestState({
      settings: createSettings(),
      activeSession: createActiveWorkoutSession({
        workout: createWorkout({
          id: "workout-back-has-changes",
          name: "Session",
          date: "2026-02-09",
          exercises: [
            createWorkoutExercise({
              id: "wex-1",
              exerciseId: "barbell-bench-press",
              sets: [createWorkoutSet({ id: "set-1", reps: 0, weight: 0, isCompleted: false })],
            }),
          ],
        }),
      }),
    })

    const { router } = await renderActiveWorkoutRoute()
    await screen.findByRole("button", { name: "Back" })

    await user.click(screen.getByRole("button", { name: "Back" }))

    expect(await screen.findByText("Cancel Workout?")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Keep Working" }))

    expect(screen.queryByText("Cancel Workout?")).toBeNull()
    expect(router.state.location.pathname).toBe("/workout/active")
    expect(await db.activeSession.get("current")).toBeTruthy()
  })

  it("cancels workout from confirmation dialog when discard is selected", async () => {
    const user = userEvent.setup()

    await seedTestState({
      settings: createSettings(),
      activeSession: createActiveWorkoutSession({
        workout: createWorkout({
          id: "workout-discard",
          name: "Session",
          date: "2026-02-09",
          exercises: [
            createWorkoutExercise({
              id: "wex-1",
              exerciseId: "barbell-bench-press",
              sets: [createWorkoutSet({ id: "set-1", reps: 8, weight: 135, isCompleted: true })],
            }),
          ],
        }),
      }),
    })

    const { router } = await renderActiveWorkoutRoute()
    await screen.findByRole("button", { name: "Back" })

    await user.click(screen.getByRole("button", { name: "Back" }))
    await user.click(screen.getByRole("button", { name: "Discard" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout")
    })

    expect(await db.activeSession.get("current")).toBeUndefined()
  })

  it("finishes workout and creates template when save-as-template is enabled", async () => {
    const user = userEvent.setup()

    await seedTestState({
      settings: createSettings(),
      activeSession: createActiveWorkoutSession({
        workout: createWorkout({
          id: "workout-finish-template",
          name: "Template Session",
          date: "2026-02-09",
          exercises: [
            createWorkoutExercise({
              id: "wex-1",
              exerciseId: "barbell-bench-press",
              sets: [
                createWorkoutSet({ id: "set-1", reps: 5, weight: 225, isCompleted: true }),
              ],
            }),
          ],
        }),
      }),
    })

    const { router } = await renderActiveWorkoutRoute()
    await screen.findByRole("button", { name: "Finish Workout" })

    await user.click(screen.getByRole("button", { name: "Finish Workout" }))
    await user.click(await screen.findByRole("checkbox"))
    await user.type(screen.getByPlaceholderText("Template name"), "  Power Builder  ")
    await user.click(screen.getByRole("button", { name: "Finish" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout")
    })

    const templates = await db.workoutTemplates.toArray()
    expect(templates).toHaveLength(1)
    expect(templates[0]?.name).toBe("Power Builder")
  })

  it("shows add-exercise error when adding fails", async () => {
    const user = userEvent.setup()
    const addExerciseSpy = vi
      .spyOn(activeSessionService, "addExercise")
      .mockRejectedValueOnce(new Error("add failed"))

    await seedTestState({
      settings: createSettings(),
      activeSession: createActiveWorkoutSession({
        workout: createWorkout({
          id: "workout-add-error",
          name: "Add Exercise Error",
          date: "2026-02-09",
          exercises: [],
          exerciseIds: [],
        }),
      }),
    })

    await renderActiveWorkoutRoute()
    await screen.findByRole("button", { name: "Add Exercise" })

    await user.click(screen.getByRole("button", { name: "Add Exercise" }))
    await user.click(screen.getByRole("button", { name: "Select Bench" }))

    await waitFor(() => {
      expect(addExerciseSpy).toHaveBeenCalledWith("barbell-bench-press")
      expect(activeWorkoutTestState.toastError).toHaveBeenCalledWith("Failed to add exercise")
    })
  })
})
