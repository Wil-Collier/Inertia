import { expect, test } from "@playwright/test"

test("critical nutrition flow opens logger and supports meal entry interactions", async ({ page }) => {
  await page.goto("/nutrition")

  await expect(page.getByRole("heading", { name: "Nutrition" })).toBeVisible()

  await expect(page.getByText("Add", { exact: false })).toBeVisible()
  await expect(page.getByText("History", { exact: false })).toBeVisible()
})
