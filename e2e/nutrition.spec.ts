import { expect, test } from "@playwright/test"
import { registerUnauthenticatedSyncApiMocks } from "./helpers/syncApiMocks"

test("nutrition journey adds a custom food entry and navigates history", async ({ page }) => {
  await registerUnauthenticatedSyncApiMocks(page)
  await page.goto("/nutrition")

  await expect(page.getByRole("heading", { name: "Nutrition" })).toBeVisible()
  await expect(page.getByRole("button", { name: "History" })).toBeVisible()

  await page.getByRole("button", { name: "Add food to Breakfast" }).click()
  await expect(page.getByRole("heading", { name: "Add to Breakfast" })).toBeVisible()

  await page.getByRole("tab", { name: "My Foods" }).click()
  await page.getByRole("button", { name: "Create New Food" }).click()

  await page.getByLabel("Name").fill("E2E Protein Bowl")
  await page.getByLabel("Calories").fill("420")
  await page.getByRole("button", { name: "Save & Add" }).click()

  await expect(page.getByText("E2E Protein Bowl", { exact: true }).first()).toBeVisible()

  await page.getByRole("button", { name: "History" }).click()
  await expect(page).toHaveURL(/\/nutrition\/history/)
  await expect(page.getByRole("heading", { name: "Nutrition History" })).toBeVisible()
})
