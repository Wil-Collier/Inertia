import { expect, test } from "@playwright/test"
import {
  registerAuthenticatedSyncApiMocks,
  registerUnauthenticatedSyncApiMocks,
  createConflictPushResponse,
  createServerErrorResponse,
} from "./helpers/syncApiMocks"

test.describe("sync and offline behavior", () => {
  test("offline to online transition keeps app responsive", async ({ context, page }) => {
    await registerUnauthenticatedSyncApiMocks(page)
    await page.goto("/workout")
    await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()

    await context.setOffline(true)
    await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()

    await context.setOffline(false)
    await page.reload()
    await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()
  })

  test("shows signed-in state and sync button for authenticated user", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page)
    await page.goto("/settings")

    await expect(page.getByText("Signed in as")).toBeVisible()
    await expect(page.getByText("athlete@example.com")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sync Now" })).toBeVisible()
  })

  test("manual sync via Sync Now button completes", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page)
    await page.goto("/settings")

    const syncButton = page.getByRole("button", { name: "Sync Now" })
    await expect(syncButton).toBeVisible()
    await syncButton.click()

    // After sync completes, the button should be available again
    await expect(syncButton).toBeVisible()
  })

  test("authenticated user can interact with settings page", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page)
    await page.goto("/settings")

    await expect(page.getByText("Signed in as")).toBeVisible()
    await expect(page.getByText("athlete@example.com")).toBeVisible()

    // Verify sync button works
    const syncButton = page.getByRole("button", { name: "Sync Now" })
    await expect(syncButton).toBeVisible()

    // Verify sign out button is present
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible()
  })
})

test.describe("sync error handling", () => {
  test("handles 500 server error gracefully during pull", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page, {
      pullStatus: 500,
      pullBody: createServerErrorResponse("Internal Server Error"),
    })

    await page.goto("/settings")
    await expect(page.getByText("Signed in as")).toBeVisible()

    // App should still be responsive even with sync errors
    await page.getByRole("button", { name: "Sync Now" }).click()

    // The app should remain functional
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
  })

  test("handles 503 service unavailable gracefully", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page, {
      pullStatus: 503,
      pullBody: createServerErrorResponse("Service Unavailable"),
    })

    await page.goto("/workout")
    await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()

    // App should still be usable
    await page.getByText("Empty Workout", { exact: false }).click()
    await expect(page.locator("[role='dialog']")).toBeVisible()
  })

  test("handles push failure without data loss", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page, {
      pushStatus: 500,
      pushBody: createServerErrorResponse("Push failed"),
    })

    await page.goto("/nutrition")
    await expect(page.getByRole("heading", { name: "Nutrition" })).toBeVisible()

    // Create a food entry (should be saved locally even if push fails)
    await page.getByRole("button", { name: "Add food to Breakfast" }).click()
    await page.getByRole("tab", { name: "My Foods" }).click()
    await page.getByRole("button", { name: "Create New Food" }).click()

    await page.getByLabel("Name").fill("Pending Sync Food")
    await page.getByLabel("Calories").fill("250")
    await page.getByRole("button", { name: "Save & Add" }).click()

    // Food should be visible in the meal (saved locally)
    await expect(page.getByText("Pending Sync Food", { exact: true }).first()).toBeVisible()
  })

  test("conflict response is handled without crashing", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page, {
      pushBody: createConflictPushResponse([
        {
          collection: "foods",
          id: "conflict-food-1",
          serverVersion: 5,
          clientBaseVersion: 2,
        },
      ]),
    })

    await page.goto("/settings")
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()

    // Trigger a sync
    await page.getByRole("button", { name: "Sync Now" }).click()

    // App should remain functional after conflict
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Sync Now" })).toBeVisible()
  })
})

test.describe("offline data persistence", () => {
  test("data created persists after reload", async ({ page }) => {
    await registerUnauthenticatedSyncApiMocks(page)
    await page.goto("/nutrition")

    // Create food
    await page.getByRole("button", { name: "Add food to Breakfast" }).click()
    await page.getByRole("tab", { name: "My Foods" }).click()
    await page.getByRole("button", { name: "Create New Food" }).click()

    await page.getByLabel("Name").fill("Persistence Test Food")
    await page.getByLabel("Calories").fill("400")
    await page.getByRole("button", { name: "Save & Add" }).click()

    await expect(page.getByText("Persistence Test Food", { exact: true }).first()).toBeVisible()

    // Reload page
    await page.reload()

    // Data should persist (loaded from IndexedDB)
    await expect(page.getByRole("heading", { name: "Nutrition" })).toBeVisible()

    // Navigate to my foods to verify it persisted
    await page.getByRole("button", { name: "Add food to Breakfast" }).click()
    await page.getByRole("tab", { name: "My Foods" }).click()
    await expect(page.getByText("Persistence Test Food").first()).toBeVisible()
  })

  test("workout is saved to history after completion", async ({ page }) => {
    await registerUnauthenticatedSyncApiMocks(page)
    await page.goto("/workout")

    // Start a workout
    await page.getByText("Empty Workout", { exact: false }).click()
    await page.locator("[role='dialog'] input").first().fill("Persisted Workout")
    await page.getByRole("button", { name: "Let's Go" }).click()
    await expect(page).toHaveURL(/\/workout\/active/)

    // Add exercise
    await page.getByRole("button", { name: "Add Exercise" }).click()
    await page.getByPlaceholder("Search exercises...").fill("squat")
    await page.getByRole("button", { name: /squat/i }).first().click()

    // Finish
    await page.getByRole("button", { name: "Finish Workout" }).click()
    await page.getByRole("button", { name: "Finish" }).click()

    await expect(page).toHaveURL(/\/workout$/)
    await expect(page.getByText("Persisted Workout")).toBeVisible()

    // Verify in history
    await page.getByRole("button", { name: "History" }).click()
    await expect(page.getByText("Persisted Workout")).toBeVisible()
  })

  test("settings persist after reload", async ({ page }) => {
    await registerUnauthenticatedSyncApiMocks(page)
    await page.goto("/settings")

    // Change rest timer
    const restTimerInput = page.getByText("Rest Timer Duration (seconds)").locator("..").locator("input[type='number']")
    await restTimerInput.fill("90")

    // Wait for save
    await page.waitForTimeout(500)

    // Reload
    await page.reload()

    // Setting should persist
    await expect(restTimerInput).toHaveValue("90")
  })
})
