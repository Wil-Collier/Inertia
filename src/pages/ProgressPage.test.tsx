import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { cleanup, screen, waitFor } from "@testing-library/react"
import { ProgressPage } from "@/pages/ProgressPage"
import { createSettings } from "@/test/factories/settingsFactory"
import { createWorkout, createWorkoutExercise, createWorkoutSet } from "@/test/factories/workoutFactory"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"

vi.mock("sonner", () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
        info: vi.fn(),
    },
}))

// Mock recharts as it has issues with jsdom
vi.mock("recharts", () => ({
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div data-testid="responsive-container">{children}</div>,
    LineChart: ({ children }: { children: React.ReactNode }) => <div data-testid="line-chart">{children}</div>,
    Line: () => <div data-testid="line" />,
    XAxis: () => <div data-testid="x-axis" />,
    YAxis: () => <div data-testid="y-axis" />,
    CartesianGrid: () => <div data-testid="cartesian-grid" />,
    Tooltip: () => <div data-testid="tooltip" />,
    AreaChart: ({ children }: { children: React.ReactNode }) => <div data-testid="area-chart">{children}</div>,
    Area: () => <div data-testid="area" />,
    BarChart: ({ children }: { children: React.ReactNode }) => <div data-testid="bar-chart">{children}</div>,
    Bar: () => <div data-testid="bar" />,
}))

vi.mock("@/lib/dateUtils", () => ({
    getToday: () => "2026-02-09",
    getNinetyDaysAgo: () => "2025-11-11",
    getThirtyDaysAgo: () => "2026-01-10",
    parseDbDate: (dateStr: string) => {
        const [yStr, mStr, dStr] = dateStr.split("-")
        return new Date(Number(yStr), Number(mStr) - 1, Number(dStr))
    },
    formatDate: (date: Date) => {
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, "0")
        const day = String(date.getDate()).padStart(2, "0")
        return `${year}-${month}-${day}`
    },
    DB_DATE_FORMAT: "yyyy-MM-dd",
}))

async function renderProgressRoute() {
    return await renderAppRoute({
        initialPath: "/progress",
        routes: [{ path: "/progress", component: ProgressPage }],
    })
}

describe("ProgressPage", () => {
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

    it("displays workout count from seeded data", async () => {
        await seedTestState({
            workouts: [
                createWorkout({
                    id: "workout-1",
                    name: "Push Day",
                    date: "2026-02-08",
                    exercises: [
                        createWorkoutExercise({
                            exerciseId: "barbell-bench-press",
                            sets: [createWorkoutSet({ reps: 10, weight: 100, isCompleted: true })],
                        }),
                    ],
                }),
                createWorkout({
                    id: "workout-2",
                    name: "Pull Day",
                    date: "2026-02-07",
                    exercises: [],
                }),
            ],
        })

        await renderProgressRoute()

        await waitFor(() => {
            expect(screen.getAllByText("2").length).toBeGreaterThan(0)
        })
    })

    it("switches between tabs when clicked", async () => {
        const user = userEvent.setup()
        await renderProgressRoute()

        // Click on Body tab
        await user.click(screen.getByRole("tab", { name: "Body" }))

        // Should show body-related content (Log Weight card appears in Body tab)
        await waitFor(() => {
            expect(screen.getByText("Log Weight")).toBeTruthy()
        })

        // Click on Awards tab
        await user.click(screen.getByRole("tab", { name: "Awards" }))

        // Should show awards/achievements content
        await waitFor(() => {
            expect(screen.getByRole("tabpanel")).toBeTruthy()
        })
    })

    it("shows empty state when no workouts for volume chart", async () => {
        await renderProgressRoute()

        expect(screen.getByText("Complete some workouts to see your progress!")).toBeTruthy()
    })

    it("shows PR empty state when no personal records exist", async () => {
        const user = userEvent.setup()
        await renderProgressRoute()

        await user.click(screen.getByRole("tab", { name: "Body" }))

        await waitFor(() => {
            expect(screen.getByText("Complete some workouts to track your PRs!")).toBeTruthy()
        })
    })

})
