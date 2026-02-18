import { afterEach, beforeEach, describe, expect, it } from "vitest"
import userEvent from "@testing-library/user-event"
import { cleanup, screen, waitFor } from "@testing-library/react"
import { WorkoutHistory } from "@/pages/WorkoutHistory"
import { createSettings } from "@/test/factories/settingsFactory"
import { createWorkout, createWorkoutExercise, createWorkoutSet } from "@/test/factories/workoutFactory"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"
import { db } from "@/services/db"

async function renderHistoryRoute() {
    return await renderAppRoute({
        initialPath: "/workout/history",
        routes: [
            { path: "/workout/history", component: WorkoutHistory },
            { path: "/workout", component: () => <div>Workout Page</div> },
        ],
    })
}

describe("WorkoutHistory", () => {
    afterEach(() => {
        cleanup()
    })

    beforeEach(async () => {
        await resetTestRuntime()
        await seedTestState({
            settings: createSettings(),
        })
    })

    it("renders history page with empty state when no workouts", async () => {
        await renderHistoryRoute()

        expect(await screen.findByRole("heading", { name: "History" })).toBeTruthy()
        // Wait for loading to complete and empty state to appear
        await waitFor(() => {
            expect(screen.getByText("No workouts yet")).toBeTruthy()
        })
        expect(screen.getByText("Complete a workout to see it here")).toBeTruthy()
    })

    it("displays workouts grouped by month", async () => {
        await seedTestState({
            workouts: [
                createWorkout({
                    id: "workout-feb-1",
                    name: "Push Day",
                    date: "2026-02-08",
                    exercises: [],
                }),
                createWorkout({
                    id: "workout-feb-2",
                    name: "Pull Day",
                    date: "2026-02-05",
                    exercises: [],
                }),
                createWorkout({
                    id: "workout-jan",
                    name: "Leg Day",
                    date: "2026-01-15",
                    exercises: [],
                }),
            ],
        })

        await renderHistoryRoute()

        // Wait for workout data to load - await by finding the month headers
        await waitFor(() => {
            expect(screen.getByText("February 2026")).toBeTruthy()
        })
        expect(screen.getByText("January 2026")).toBeTruthy()

        // Should show workout names
        expect(screen.getByText("Push Day")).toBeTruthy()
        expect(screen.getByText("Pull Day")).toBeTruthy()
        expect(screen.getByText("Leg Day")).toBeTruthy()
    })

    it("sorts workouts by date (newest first)", async () => {
        await seedTestState({
            workouts: [
                createWorkout({
                    id: "workout-old",
                    name: "Old Workout",
                    date: "2026-01-01",
                    exercises: [],
                }),
                createWorkout({
                    id: "workout-new",
                    name: "New Workout",
                    date: "2026-02-09",
                    exercises: [],
                }),
            ],
        })

        await renderHistoryRoute()

        const workoutCards = await screen.findAllByText(/Workout/i)
        // The New Workout should appear before Old Workout in the DOM
        const newIndex = workoutCards.findIndex((el) => el.textContent?.includes("New Workout"))
        const oldIndex = workoutCards.findIndex((el) => el.textContent?.includes("Old Workout"))
        expect(newIndex).toBeLessThan(oldIndex)
    })

    it("expands workout card to show exercises", async () => {
        const user = userEvent.setup()
        await seedTestState({
            workouts: [
                createWorkout({
                    id: "workout-1",
                    name: "Push Day",
                    date: "2026-02-08",
                    exercises: [
                        createWorkoutExercise({
                            exerciseId: "barbell-bench-press",
                            sets: [
                                createWorkoutSet({ reps: 10, weight: 135, isCompleted: true }),
                                createWorkoutSet({ reps: 8, weight: 145, isCompleted: true }),
                            ],
                        }),
                    ],
                }),
            ],
        })

        await renderHistoryRoute()

        const workoutCard = await screen.findByText("Push Day")
        await user.click(workoutCard)

        // Should show expanded details with exercise info
        await waitFor(() => {
            // Check for set information being displayed
            expect(screen.getByText(/10/)).toBeTruthy()
        })
    })

    it("shows delete button and opens confirmation dialog", async () => {
        const user = userEvent.setup()
        await seedTestState({
            workouts: [
                createWorkout({
                    id: "workout-to-delete",
                    name: "Delete Me Workout",
                    date: "2026-02-08",
                    exercises: [],
                }),
            ],
        })

        await renderHistoryRoute()

        // Expand the card first
        const workoutCard = await screen.findByText("Delete Me Workout")
        await user.click(workoutCard)

        // Find and click delete button - expand reveals "Delete Workout" button
        const deleteButton = await screen.findByRole("button", { name: /Delete Workout/i })
        await user.click(deleteButton)

        // Confirmation dialog should appear
        expect(await screen.findByRole("dialog")).toBeTruthy()
        expect(screen.getByText(/Are you sure you want to delete/)).toBeTruthy()
    })

    it("deletes workout when confirmed and removes from list", async () => {
        const user = userEvent.setup()
        await seedTestState({
            workouts: [
                createWorkout({
                    id: "workout-to-delete",
                    name: "Delete Me Workout",
                    date: "2026-02-08",
                    exercises: [],
                }),
            ],
        })

        await renderHistoryRoute()

        // Expand and delete
        await user.click(await screen.findByText("Delete Me Workout"))
        await user.click(await screen.findByRole("button", { name: /Delete Workout/i }))

        // Confirm deletion
        const confirmButton = await screen.findByRole("button", { name: "Delete" })
        await user.click(confirmButton)

        // Workout should be deleted from DB
        await waitFor(async () => {
            const workout = await db.workoutSessions.get("workout-to-delete")
            expect(workout).toBeUndefined()
        })

        // The deleted workout should no longer appear in the list
        await waitFor(() => {
            expect(screen.queryByText("Delete Me Workout")).toBeNull()
        })
    })

    it("cancels delete dialog without removing workout", async () => {
        const user = userEvent.setup()
        await seedTestState({
            workouts: [
                createWorkout({
                    id: "workout-keep",
                    name: "Keep Me Workout",
                    date: "2026-02-08",
                    exercises: [],
                }),
            ],
        })

        await renderHistoryRoute()

        // Expand and click delete
        await user.click(await screen.findByText("Keep Me Workout"))
        await user.click(await screen.findByRole("button", { name: /Delete Workout/i }))

        // Cancel deletion
        await user.click(screen.getByRole("button", { name: "Cancel" }))

        // Dialog should close
        await waitFor(() => {
            expect(screen.queryByRole("dialog")).toBeNull()
        })

        // Workout should still exist
        const workout = await db.workoutSessions.get("workout-keep")
        expect(workout).toBeTruthy()
    })
})
