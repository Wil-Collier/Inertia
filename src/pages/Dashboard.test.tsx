import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { Dashboard } from "@/pages/Dashboard"
import type { ActiveWorkoutSession, NutritionTotals, UserSettings, Workout } from "@/lib/types"

interface LinkProps {
  to: string
  className?: string
  children?: ReactNode
}

const dashboardState = vi.hoisted(() => ({
  activeSession: null as ActiveWorkoutSession | null,
  dailyNutrition: {
    log: null,
    entriesWithFood: [],
    totals: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
    },
  } as {
    log: null
    entriesWithFood: []
    totals: NutritionTotals
  },
  todayWorkouts: [] as Workout[],
  isWorkoutsLoading: false,
  workoutDates: [] as string[],
  nutritionDates: [] as string[],
  settings: {
    nutritionGoals: {
      calories: 2200,
      protein: 180,
      carbs: 250,
      fat: 70,
      fiber: 30,
      sugar: 50,
    },
  } as Pick<UserSettings, "nutritionGoals">,
  achievementsData: null as { unlockedAchievements: Array<{ id: string; unlockedAt: string }> } | null,
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, className, children }: LinkProps) => (
    <a href={to} data-to={to} className={className}>
      {children}
    </a>
  ),
}))

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title }: { title: string }) => <h1>{title}</h1>,
}))

vi.mock("@/components/dashboard/WeeklyConsistency", () => ({
  WeeklyConsistency: () => <div>Weekly Consistency</div>,
}))

vi.mock("@/components/dashboard/WeightCard", () => ({
  WeightCard: () => <div>Weight Card</div>,
}))

vi.mock("@/components/AchievementBadge", () => ({
  AchievementBadge: () => <div>Achievement Badge</div>,
}))

vi.mock("@/features/workout/hooks/useActiveSession", () => ({
  useActiveSession: () => ({ data: dashboardState.activeSession }),
}))

vi.mock("@/features/nutrition/queries", () => ({
  useDailyNutrition: () => ({ data: dashboardState.dailyNutrition }),
  useNutritionDates: () => ({ data: dashboardState.nutritionDates }),
}))

vi.mock("@/features/workout/queries", () => ({
  useWorkoutsByDate: () => ({
    data: dashboardState.todayWorkouts,
    isLoading: dashboardState.isWorkoutsLoading,
  }),
  useWorkoutDates: () => ({ data: dashboardState.workoutDates }),
}))

vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({ data: dashboardState.settings }),
}))

vi.mock("@/features/achievements/queries", () => ({
  useAchievements: () => ({ data: dashboardState.achievementsData }),
}))

vi.mock("@/lib/dateUtils", () => ({
  getToday: () => "2026-02-09",
}))

function createWorkout(overrides: Partial<Workout> = {}): Workout {
  return {
    id: "workout-1",
    name: "Push Day",
    date: "2026-02-09",
    weightUnit: "kg",
    exercises: [],
    ...overrides,
  }
}

function createActiveSession(): ActiveWorkoutSession {
  return {
    workout: createWorkout(),
    startedAt: "2026-02-09T10:00:00.000Z",
  }
}

describe("Dashboard", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    dashboardState.activeSession = null
    dashboardState.dailyNutrition = {
      log: null,
      entriesWithFood: [],
      totals: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
      },
    }
    dashboardState.todayWorkouts = []
    dashboardState.isWorkoutsLoading = false
    dashboardState.workoutDates = []
    dashboardState.nutritionDates = []
    dashboardState.settings = {
      nutritionGoals: {
        calories: 2200,
        protein: 180,
        carbs: 250,
        fat: 70,
        fiber: 30,
        sugar: 50,
      },
    }
    dashboardState.achievementsData = null
  })

  it("renders active session banner and points workout CTAs to /workout/active", () => {
    dashboardState.activeSession = createActiveSession()

    render(<Dashboard />)

    expect(screen.getByText("Workout in Progress")).toBeTruthy()
    expect(screen.getByText("Continue Workout")).toBeTruthy()

    const activeLinks = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("data-to") === "/workout/active")
    expect(activeLinks.length).toBeGreaterThan(0)
  })

  it("shows empty-state CTA when no workouts are logged today", () => {
    render(<Dashboard />)

    expect(screen.getByText("No workouts logged yet today")).toBeTruthy()
    const emptyStateLink = screen.getByRole("link", { name: "Choose a template" })
    expect(emptyStateLink.getAttribute("data-to")).toBe("/workout")
  })

  it("keeps calorie progress stable when calorie goal is zero", () => {
    dashboardState.settings = {
      nutritionGoals: {
        calories: 0,
        protein: 180,
        carbs: 250,
        fat: 70,
        fiber: 30,
        sugar: 50,
      },
    }
    dashboardState.dailyNutrition = {
      log: null,
      entriesWithFood: [],
      totals: {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
      },
    }

    const { container } = render(<Dashboard />)

    expect(screen.getByText("Calories Left")).toBeTruthy()
    const progressCircle = container.querySelector("circle[stroke-dasharray]")
    expect(progressCircle?.getAttribute("stroke-dasharray")).toBe("0 100")
  })
})
