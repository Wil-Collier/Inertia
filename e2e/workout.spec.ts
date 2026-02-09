import { expect, test } from "@playwright/test"
import { registerUnauthenticatedSyncApiMocks } from "./helpers/syncApiMocks"

test("workout journey starts, modifies, finishes, and appears in history", async ({ page }) => {
  await registerUnauthenticatedSyncApiMocks(page)
  await page.goto("/workout")

  await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()

  const workoutName = "E2E Session Workout"

  await page.getByText("Empty Workout", { exact: false }).click()
  await page.locator("[role='dialog'] input").first().fill(workoutName)
  await page.getByRole("button", { name: "Let's Go" }).click()

  await expect(page).toHaveURL(/\/workout\/active/)
  await page.getByRole("button", { name: "Add Exercise" }).click()
  await expect(page.getByRole("heading", { name: "Add Exercise" })).toBeVisible()

  await page.getByPlaceholder("Search exercises...").fill("bench")
  await page.getByRole("button", { name: /bench press/i }).first().click()

  await expect(page.getByRole("button", { name: "Add Set" }).first()).toBeVisible()
  await page.getByRole("button", { name: "Add Set" }).first().click()

  await page.getByRole("button", { name: "Finish Workout" }).click()
  await page.getByRole("button", { name: "Finish" }).click()

  await expect(page).toHaveURL(/\/workout$/)
  await expect(page.getByText("Recent Sessions")).toBeVisible()
  await expect(page.getByText(workoutName)).toBeVisible()

  await page.getByRole("button", { name: "History" }).click()
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible()
  await expect(page.getByText(workoutName)).toBeVisible()
})
