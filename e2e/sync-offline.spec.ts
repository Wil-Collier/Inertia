import { expect, test } from "@playwright/test"

test("offline to online transition keeps app responsive", async ({ context, page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: "Inertia" })).toBeVisible()

  await context.setOffline(true)
  await page.goto("/workout")
  await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()

  await context.setOffline(false)
  await page.reload()
  await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()
})
