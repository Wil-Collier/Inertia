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

test("barcode not-found path switches to scanned custom food flow", async ({ page }) => {
  // Use addInitScript for cross-browser compatibility (Safari has issues with page.route for fetch)
  await page.addInitScript(() => {
    const originalFetch = window.fetch.bind(window)
    window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const request = input instanceof Request ? input : new Request(input, init)
      const url = new URL(request.url)
      const method = request.method.toUpperCase()

      if (url.pathname === "/api/auth/refresh" && method === "POST") {
        return new Response(
          JSON.stringify({
            accessToken: "e2e-access-token",
            userId: "e2e-user-id",
            email: "athlete@example.com",
            expiresAtMs: Date.now() + 60 * 60 * 1000,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.pathname === "/api/sync/pull" && method === "POST") {
        return new Response(
          JSON.stringify({ changes: [], nextCursor: null, serverTimestampMs: Date.now(), hasMore: false }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.pathname === "/api/sync/push" && method === "POST") {
        return new Response(
          JSON.stringify({ accepted: 0, acceptedChanges: [], conflicts: [] }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      }

      if (url.pathname === "/api/auth/logout" && method === "POST") {
        return new Response(JSON.stringify({ success: true }), { status: 200, headers: { "Content-Type": "application/json" } })
      }

      if (url.pathname === "/api/nutrition/barcode") {
        return new Response(JSON.stringify({ error: "Not Found" }), { status: 404, headers: { "Content-Type": "application/json" } })
      }

      return await originalFetch(input, init)
    }
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
  await expect(page.getByRole("tab", { name: "My Foods", selected: true })).toBeVisible({ timeout: 10000 })
  await expect(page.getByLabel("Name")).toBeVisible()
  await expect(page.getByText("Create Food (Scanned)")).toBeVisible()
  await expect(page.getByText("999123456789")).toBeVisible()

  await page.getByLabel("Name").fill("E2E Scanned Not Found Food")
  await page.getByLabel("Calories").fill("310")
  await page.getByRole("button", { name: "Save & Add" }).click()

  await expect(page.getByText("E2E Scanned Not Found Food", { exact: true }).first()).toBeVisible()
})
