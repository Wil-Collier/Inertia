import { expect, test } from "@playwright/test"
import { readStoredSettings } from "./helpers/indexedDb"
import { registerUnauthenticatedSyncApiMocks } from "./helpers/syncApiMocks"

test.describe("settings journey", () => {
  test.beforeEach(async ({ page }) => {
    await registerUnauthenticatedSyncApiMocks(page)
  })

  test("updates rest timer + units and persists after reload", async ({ page }) => {
    await page.goto("/settings")
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible()

    const restTimerInput = page.getByText("Rest Timer Duration (seconds)").locator("..").locator("input[type='number']")
    await restTimerInput.fill("75")

    await expect.poll(async () => (await readStoredSettings(page))?.restTimerDuration).toBe(75)

    await page.getByRole("button", { name: "Kilograms (kg)" }).click()
    await page.getByRole("button", { name: "Kilometers (km)" }).click()

    await expect.poll(async () => (await readStoredSettings(page))?.unitPreferences.weight).toBe("kg")
    await expect.poll(async () => (await readStoredSettings(page))?.unitPreferences.distance).toBe("km")

    await page.reload()

    await expect(page.getByRole("button", { name: "Kilograms (kg)" })).toHaveClass(/bg-primary/)
    await expect(page.getByRole("button", { name: "Kilometers (km)" })).toHaveClass(/bg-primary/)
    await expect.poll(async () => (await readStoredSettings(page))?.restTimerDuration).toBe(75)
  })

  test("shows export warning dialog, supports cancel, then confirm", async ({ page }) => {
    await page.goto("/settings")

    const exportButton = page.getByRole("button", { name: "Export Data (JSON)" })
    await exportButton.click()

    await expect(page.getByRole("heading", { name: "Export Data" })).toBeVisible()
    await expect(page.getByText("not encrypted", { exact: false })).toBeVisible()

    await page.getByRole("button", { name: "Cancel" }).click()
    await expect(page.getByRole("heading", { name: "Export Data" })).toHaveCount(0)

    await exportButton.click()

    const downloadPromise = page.waitForEvent("download")
    await page.getByRole("button", { name: "Export" }).click()
    const download = await downloadPromise
    expect(download.suggestedFilename()).toMatch(/\.json$/)
  })
})
