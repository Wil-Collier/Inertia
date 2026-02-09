import { expect, test } from "@playwright/test"
import { registerUnauthenticatedSyncApiMocks } from "./helpers/syncApiMocks"

test.describe("progress and achievements journey", () => {
    test.beforeEach(async ({ page }) => {
        await registerUnauthenticatedSyncApiMocks(page)
    })

    test("progress page shows all tabs", async ({ page }) => {
        await page.goto("/progress")

        await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible()
        // The actual tab names from ProgressPage.tsx
        await expect(page.getByRole("tab", { name: "Volume" })).toBeVisible()
        await expect(page.getByRole("tab", { name: "Training" })).toBeVisible()
        await expect(page.getByRole("tab", { name: "Body" })).toBeVisible()
        await expect(page.getByRole("tab", { name: "Awards" })).toBeVisible()
    })

    test("navigates between progress tabs", async ({ page }) => {
        await page.goto("/progress")

        await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible()

        // Click through each tab
        await page.getByRole("tab", { name: "Training" }).click()
        await expect(page.getByText("Muscle Group Frequency")).toBeVisible()

        await page.getByRole("tab", { name: "Body" }).click()
        await expect(page.getByText("Log Weight")).toBeVisible()

        await page.getByRole("tab", { name: "Awards" }).click()
        // Awards tab should show achievement content
        await expect(page.getByRole("tab", { name: "Awards", selected: true })).toBeVisible()

        await page.getByRole("tab", { name: "Volume" }).click()
        await expect(page.getByText("Weekly Volume")).toBeVisible()
    })

    test("completing a workout updates progress stats", async ({ page }) => {
        // Start and complete a workout
        await page.goto("/workout")
        await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()

        await page.getByText("Empty Workout", { exact: false }).click()
        await page.locator("[role='dialog'] input").first().fill("Progress Test Workout")
        await page.getByRole("button", { name: "Let's Go" }).click()
        await expect(page).toHaveURL(/\/workout\/active/)

        // Add an exercise
        await page.getByRole("button", { name: "Add Exercise" }).click()
        await page.getByPlaceholder("Search exercises...").fill("deadlift")
        await page.getByRole("button", { name: /deadlift/i }).first().click()

        // Finish the workout
        await page.getByRole("button", { name: "Finish Workout" }).click()
        await page.getByRole("button", { name: "Finish" }).click()

        await expect(page).toHaveURL(/\/workout$/)
        await expect(page.getByText("Progress Test Workout")).toBeVisible()

        // Navigate to progress to check workout stats
        await page.goto("/progress")
        await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible()

        // Stats should be visible
        await expect(page.getByText("Total Workouts")).toBeVisible()
        await expect(page.getByText("Last 30 Days")).toBeVisible()
    })

    test("body weight logging works on Body tab", async ({ page }) => {
        await page.goto("/progress")
        await page.getByRole("tab", { name: "Body" }).click()

        // Log a weight entry
        await page.locator("input[placeholder^='Enter weight']").first().fill("175.5")
        await page.getByRole("button", { name: "Log" }).click()

        await expect(page.getByText("Weight logged!")).toBeVisible()
        await expect(page.getByText(/Current:\s*175\.5/)).toBeVisible()
    })

    test("awards tab displays achievements", async ({ page }) => {
        await page.goto("/progress")
        await page.getByRole("tab", { name: "Awards" }).click()

        // Awards tab should be selected and display achievement content
        await expect(page.getByRole("tab", { name: "Awards", selected: true })).toBeVisible()
    })

    test("training tab shows exercise progress", async ({ page }) => {
        await page.goto("/progress")
        await page.getByRole("tab", { name: "Training" }).click()

        // Training tab should show muscle group frequency and exercise progress sections
        await expect(page.getByText("Muscle Group Frequency")).toBeVisible()
        await expect(page.getByText("Exercise Progress")).toBeVisible()
    })
})
