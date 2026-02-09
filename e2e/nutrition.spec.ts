import { expect, test } from "@playwright/test"
import { registerUnauthenticatedSyncApiMocks, registerAuthenticatedSyncApiMocks } from "./helpers/syncApiMocks"

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

test("barcode not-found path switches to scanned custom food flow", async ({ page }) => {
  // Use the helper with barcode mock configured to return 404
  await registerAuthenticatedSyncApiMocks(page, {
    barcodeStatus: 404,
    barcodeBody: { error: "Not Found" },
  })

  await page.goto("/nutrition")
  await expect(page.getByRole("heading", { name: "Nutrition" })).toBeVisible()

  await page.getByRole("button", { name: "Add food to Breakfast" }).click()
  await expect(page.getByRole("heading", { name: "Add to Breakfast" })).toBeVisible()

  await page.getByRole("button", { name: "Scan barcode" }).click()
  await expect(page.getByPlaceholder("Enter barcode manually")).toBeVisible()

  const manualBarcodeInput = page.getByTestId("manual-barcode-input")
  await manualBarcodeInput.fill("999123456789")
  const useBarcodeButton = page.getByTestId("manual-barcode-submit")
  await expect(useBarcodeButton).toBeEnabled()
  await manualBarcodeInput.press("Enter")
  if (await useBarcodeButton.isVisible()) {
    await useBarcodeButton.click()
  }

  // Wait for the barcode lookup result
  await expect(page.getByRole("tab", { name: "My Foods", selected: true })).toBeVisible()
  await expect(page.getByLabel("Name")).toBeVisible()
  await expect(page.getByText("Create Food (Scanned)")).toBeVisible()
  await expect(page.getByText("999123456789")).toBeVisible()

  await page.getByLabel("Name").fill("E2E Scanned Not Found Food")
  await page.getByLabel("Calories").fill("310")
  await page.getByRole("button", { name: "Save & Add" }).click()

  await expect(page.getByText("E2E Scanned Not Found Food", { exact: true }).first()).toBeVisible()
})

