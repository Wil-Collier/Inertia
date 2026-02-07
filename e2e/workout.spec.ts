import { expect, test } from "@playwright/test"

test("critical workout flow starts a session and enters active workout", async ({ page }) => {
  await page.goto("/workout")

  await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()

  await page.getByText("Empty Workout", { exact: false }).click()
  await page.getByRole("button", { name: "Let's Go" }).click()

  await expect(page).toHaveURL(/\/workout\/active/)
  await expect(page.getByRole("button", { name: "Finish" })).toBeVisible()
})
