import { expect, test } from "@playwright/test"
import { registerUnauthenticatedSyncApiMocks } from "./helpers/syncApiMocks"

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
