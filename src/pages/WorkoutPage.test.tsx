import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { cleanup, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { db } from "@/services/db"
import { activeSessionService } from "@/features/workout/services/activeSessionService"
import { WorkoutPage } from "@/pages/WorkoutPage"
import { createSettings } from "@/test/factories/settingsFactory"
import { createWorkoutTemplate } from "@/test/factories/workoutFactory"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"

const workoutPageState = vi.hoisted(() => ({
  toastError: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    error: (...args: unknown[]) => workoutPageState.toastError(...args),
  },
}))

async function renderWorkoutRoute(initialPath = "/workout") {
  return await renderAppRoute({
    initialPath,
    routes: [
      { path: "/workout", component: WorkoutPage },
      { path: "/workout/active", component: () => <h1>Active Workout Page</h1> },
      { path: "/workout/history", component: () => <h1>Workout History</h1> },
      { path: "/workout/templates", component: () => <h1>Workout Templates</h1> },
    ],
  })
}

describe("WorkoutPage", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await resetTestRuntime()
    await seedTestState({
      settings: createSettings(),
    })
  })

  it("redirects to active workout when a session already exists", async () => {
    await activeSessionService.startWorkout("Existing Session")

    const { router } = await renderWorkoutRoute()

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout/active")
    })
    expect(screen.getByText("Active Workout Page")).toBeTruthy()
  })

  it("starts a blank workout with trimmed name and navigates", async () => {
    const user = userEvent.setup()
    const { router } = await renderWorkoutRoute()

    await user.click(await screen.findByText("Empty Workout"))
    await user.type(screen.getByRole("textbox"), "  Push Day  ")
    await user.click(screen.getByRole("button", { name: "Let's Go" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout/active")
    })

    const session = await db.activeSession.get("current")
    expect(session?.workout.name).toBe("Push Day")
  })

  it("uses default workout name when submitted empty via Enter", async () => {
    const user = userEvent.setup()
    const { router } = await renderWorkoutRoute()

    await user.click(await screen.findByText("Empty Workout"))
    await user.keyboard("{Enter}")

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout/active")
    })

    const session = await db.activeSession.get("current")
    expect(session).toBeTruthy()
    expect(session?.workout.name).toMatch(/Workout$/)
    expect(session?.workout.name.trim().length ?? 0).toBeGreaterThan("Workout".length)
  })

  it("surfaces an error toast when starting an empty workout fails", async () => {
    const user = userEvent.setup()
    vi.spyOn(activeSessionService, "startWorkout").mockRejectedValueOnce(new Error("failed to start"))

    const { router } = await renderWorkoutRoute()

    await user.click(await screen.findByText("Empty Workout"))
    await user.click(screen.getByRole("button", { name: "Let's Go" }))

    await waitFor(() => {
      expect(workoutPageState.toastError).toHaveBeenCalledWith("Failed to start workout. Please try again.")
    })
    expect(router.state.location.pathname).toBe("/workout")
    expect(await db.activeSession.get("current")).toBeUndefined()
  })

  it("starts template workouts with template id and navigates", async () => {
    const user = userEvent.setup()
    const template = createWorkoutTemplate({
      id: "template-1",
      name: "Leg Builder",
      exercises: [
        {
          exerciseId: "custom-back-squat",
          targetSets: 3,
          targetReps: 8,
          targetWeight: 225,
        },
      ],
    })

    await seedTestState({
      templates: [template],
    })

    await db.customExercises.put({
      id: "custom-back-squat",
      name: "Back Squat",
      muscleGroup: "legs",
      isWeighted: true,
      isTimeBased: false,
      isCustom: true,
    })

    const { router } = await renderWorkoutRoute()

    await user.click(await screen.findByText("Leg Builder"))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout/active")
    })

    const started = await db.activeSession.get("current")
    expect(started?.templateId).toBe("template-1")
    expect(started?.workout.name).toBe("Leg Builder")

  })

  it("surfaces a toast when starting a template workout fails", async () => {
    const user = userEvent.setup()
    const template = createWorkoutTemplate({
      id: "template-1",
      name: "Leg Builder",
      exercises: [
        {
          exerciseId: "custom-back-squat",
          targetSets: 3,
          targetReps: 8,
          targetWeight: 225,
        },
      ],
    })

    await seedTestState({
      templates: [template],
    })

    await db.customExercises.put({
      id: "custom-back-squat",
      name: "Back Squat",
      muscleGroup: "legs",
      isWeighted: true,
      isTimeBased: false,
      isCustom: true,
    })

    vi.spyOn(activeSessionService, "startWorkout").mockRejectedValueOnce(new Error("failed"))

    const { router } = await renderWorkoutRoute()
    await user.click(await screen.findByText("Leg Builder"))

    await waitFor(() => {
      expect(workoutPageState.toastError).toHaveBeenCalledWith(
        "Failed to start template workout. Please try again."
      )
    })
    expect(router.state.location.pathname).toBe("/workout")
    expect(await db.activeSession.get("current")).toBeUndefined()
  })
})
