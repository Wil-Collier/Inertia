import { expect, test } from "@playwright/test"
import {
  registerAuthenticatedSyncApiMocks,
  registerUnauthenticatedSyncApiMocks,
} from "./helpers/syncApiMocks"

test.describe("authentication journey via sync settings", () => {
  test("shows unauthenticated cloud sync state", async ({ page }) => {
    await registerUnauthenticatedSyncApiMocks(page)
    await page.goto("/settings")

    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()
    await expect(page.getByText("Cloud Sync")).toBeVisible()
    await expect(
      page.getByText("Sync keeps workouts and nutrition aligned across devices.")
    ).toBeVisible()
    await expect(page.getByText("Signed in as")).toHaveCount(0)
  })

  test("restores session and shows signed-in state", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page)
    await page.goto("/settings")

    await expect(page.getByText("Signed in as")).toBeVisible()
    await expect(page.getByText("athlete@example.com")).toBeVisible()
    await expect(page.getByRole("button", { name: "Sync Now" })).toBeVisible()
    await expect(page.getByRole("button", { name: "Sign Out" })).toBeVisible()
  })

  test("signs out and returns to unauthenticated state", async ({ page }) => {
    await registerAuthenticatedSyncApiMocks(page)
    await page.goto("/settings")

    await expect(page.getByText("Signed in as")).toBeVisible()
    await page.getByRole("button", { name: "Sign Out" }).click()

    await expect(page.getByText("Signed in as")).toHaveCount(0)
    await expect(
      page.getByText("Sync keeps workouts and nutrition aligned across devices.")
    ).toBeVisible()
  })
})
