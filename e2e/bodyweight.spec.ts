import { expect, test } from "@playwright/test"
import { registerUnauthenticatedSyncApiMocks } from "./helpers/syncApiMocks"

test.describe("bodyweight journey", () => {
  test.beforeEach(async ({ page }) => {
    await registerUnauthenticatedSyncApiMocks(page)
  })

  test("rejects invalid weight input", async ({ page }) => {
    await page.goto("/progress")

    await expect(page.getByRole("heading", { name: "Progress" })).toBeVisible()
    await page.getByRole("tab", { name: "Body" }).click()
    await expect(page.getByText("Log Weight")).toBeVisible()

    await page.locator("input[placeholder^='Enter weight']").first().fill("-4")
    await page.getByRole("button", { name: "Log" }).click()

    await expect(page.getByText("Please enter a valid weight")).toBeVisible()
    await expect(page.getByText("No weight entries yet. Log your first entry above!")).toBeVisible()
  })

  test("logs and deletes a bodyweight entry", async ({ page }) => {
    await page.goto("/progress")

    await page.getByRole("tab", { name: "Body" }).click()
    await expect(page.getByText("Log Weight")).toBeVisible()

    await page.locator("input[placeholder^='Enter weight']").first().fill("182.4")
    await page.getByRole("button", { name: "Log" }).click()

    await expect(page.getByText("Weight logged!")).toBeVisible()
    await expect(page.getByText(/Current:\s*182\.4/)).toBeVisible()

    await page.getByRole("button", { name: /Delete weight entry/ }).first().click()
    await expect(page.getByRole("heading", { name: "Delete weight entry?" })).toBeVisible()
    await page.getByRole("button", { name: "Delete" }).click()

    await expect(page.getByText("Entry deleted").first()).toBeVisible()
    await expect(page.getByText("No weight entries yet. Log your first entry above!")).toBeVisible()
  })
})
