import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { cleanup, screen, waitFor } from "@testing-library/react"
import { db } from "@/services/db"
import { Dashboard } from "@/pages/Dashboard"
import { createFoodItem } from "@/test/factories/nutritionFactory"
import { createSettings, createZeroCalorieGoalSettings } from "@/test/factories/settingsFactory"
import { createActiveWorkoutSession, createWorkout } from "@/test/factories/workoutFactory"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"

// WeeklyConsistency uses recharts which requires DOM measurements (getBBox, getComputedTextLength)
// unavailable in jsdom. Mocking avoids spurious layout errors unrelated to Dashboard behavior.
vi.mock("@/features/dashboard/components/WeeklyConsistency", () => ({
  WeeklyConsistency: () => <div>Weekly Consistency</div>,
}))

// WeightCard uses recharts (LineChart) which requires DOM measurement APIs unavailable in jsdom.
// Mocking prevents layout/rendering errors that would obscure the Dashboard tests.
vi.mock("@/features/dashboard/components/WeightCard", () => ({
  WeightCard: () => <div>Weight Card</div>,
}))

// AchievementBadge renders complex SVG animations and gradient effects that cause jsdom
// warnings. Dashboard tests focus on routing, data hydration, and CTA behavior — not badge rendering.
vi.mock("@/features/achievements/components/AchievementBadge", () => ({
  AchievementBadge: () => <div>Achievement Badge</div>,
}))

async function renderDashboardRoute() {
  return await renderAppRoute({
    initialPath: "/",
    routes: [
      { path: "/", component: Dashboard },
      { path: "/workout", component: () => <div>Workout Page</div> },
      { path: "/workout/active", component: () => <div>Active Workout Page</div> },
      { path: "/nutrition", component: () => <div>Nutrition Page</div> },
      { path: "/progress", component: () => <div>Progress Page</div> },
    ],
  })
}

describe("Dashboard", () => {
  // Pin today's date to a deterministic value so seeded workout/nutrition data with
  // date "2026-02-09" is always treated as "today" regardless of when the test runs.
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] })
    // Use local noon to avoid UTC-to-local-date shifting in date-fns format()
    vi.setSystemTime(new Date(2026, 1, 9, 12, 0, 0))
  })

  afterAll(() => {
    vi.useRealTimers()
  })

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

  it("renders active session banner and workout CTAs navigate to active workout", async () => {
    const user = userEvent.setup()

    await seedTestState({
      activeSession: createActiveWorkoutSession({
        workout: createWorkout({
          id: "active-session-workout",
          name: "Push Day",
          date: "2026-02-09",
          exercises: [],
          exerciseIds: [],
        }),
      }),
    })
    expect(await db.activeSession.get("current")).toBeTruthy()

    const { router } = await renderDashboardRoute()

    expect(await screen.findByText("Workout in Progress")).toBeTruthy()
    expect(await screen.findByText("Push Day")).toBeTruthy()

    await user.click(screen.getByText("Workout in Progress"))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout/active")
    })

    await router.navigate({ to: "/" })

    await user.click(screen.getByText("Continue Workout"))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout/active")
    })
  })

  it("routes quick-start CTA to /workout when no active session exists", async () => {
    const user = userEvent.setup()
    const { router } = await renderDashboardRoute()

    await user.click(screen.getByText("Start Workout"))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout")
    })
  })

  it("shows empty-state CTA when no workouts are logged today", async () => {
    const user = userEvent.setup()
    const { router } = await renderDashboardRoute()

    expect(await screen.findByText("No workouts logged yet today")).toBeTruthy()

    await user.click(screen.getByRole("link", { name: "Choose a template" }))

    await waitFor(() => {
      expect(router.state.location.pathname).toBe("/workout")
    })
  })

  it("keeps calorie progress stable when calorie goal is zero", async () => {
    await seedTestState({
      settings: createZeroCalorieGoalSettings(),
      foods: [
        createFoodItem({
          id: "food-calorie-zero",
          name: "Test Food",
          calories: 500,
          isCustom: true,
        }),
      ],
      nutritionLogs: [
        {
          date: "2026-02-09",
          entries: [
            {
              id: "entry-calorie-zero",
              foodId: "food-calorie-zero",
              quantity: 1,
              mealType: "breakfast",
              updatedAt: 1,
            },
          ],
        },
      ],
    })

    const { container } = await renderDashboardRoute()

    expect(screen.getByText("Calories Left")).toBeTruthy()

    const progressCircle = container.querySelector("circle[stroke-dasharray]")
    expect(progressCircle?.getAttribute("stroke-dasharray")).toBe("0 100")
    expect(container.textContent?.includes("NaN")).toBe(false)
  })

  it("uses /workout as quick-start when no active session and renders today's workouts", async () => {
    await seedTestState({
      workouts: [
        createWorkout({
          id: "today-workout-1",
          name: "Leg Day",
          date: "2026-02-09",
          exercises: [],
          exerciseIds: [],
          duration: 42,
        }),
      ],
    })

    await renderDashboardRoute()

    expect(await screen.findByText("Leg Day")).toBeTruthy()
    expect(screen.queryByText("No workouts logged yet today")).toBeNull()
  })

  it("hydrates nutrition totals from seeded data", async () => {
    await seedTestState({
      foods: [
        createFoodItem({
          id: "food-protein",
          name: "Protein Yogurt",
          calories: 150,
          protein: 20,
          carbs: 10,
          fat: 2,
          fiber: 0,
          sugar: 8,
          isCustom: true,
        }),
      ],
      nutritionLogs: [
        {
          date: "2026-02-09",
          entries: [
            {
              id: "entry-protein",
              foodId: "food-protein",
              quantity: 1,
              mealType: "breakfast",
              updatedAt: 1,
            },
          ],
        },
      ],
    })

    await renderDashboardRoute()

    expect(await screen.findByText("1850")).toBeTruthy()
  })

  it("persists completed workouts to Dexie and renders count", async () => {
    await seedTestState({
      workouts: [
        createWorkout({
          id: "workout-a",
          name: "Workout A",
          date: "2026-02-09",
          exercises: [],
          exerciseIds: [],
        }),
        createWorkout({
          id: "workout-b",
          name: "Workout B",
          date: "2026-02-09",
          exercises: [],
          exerciseIds: [],
        }),
      ],
    })

    await renderDashboardRoute()

    const workouts = await db.workoutSessions.where("date").equals("2026-02-09").toArray()
    expect(workouts).toHaveLength(2)
    expect(await screen.findByText("Workout A")).toBeTruthy()
    expect(await screen.findByText("Workout B")).toBeTruthy()
  })
})
