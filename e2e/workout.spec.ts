import { expect, test, type Page } from "@playwright/test"
import { registerUnauthenticatedSyncApiMocks } from "./helpers/syncApiMocks"

async function startBlankWorkout(name: string, page: Page) {
  await page.goto("/workout")
  await expect(page.getByRole("heading", { name: "Workout" })).toBeVisible()

  await page.getByText("Empty Workout", { exact: false }).click()
  await page.locator("[role='dialog'] input").first().fill(name)
  await page.getByRole("button", { name: "Let's Go" }).click()
  await expect(page).toHaveURL(/\/workout\/active/)
}

async function addExerciseFromSheet(page: Page, searchQuery: string, exerciseName: RegExp) {
  await page.getByRole("button", { name: "Add Exercise" }).click()
  await expect(page.getByRole("heading", { name: "Add Exercise" })).toBeVisible()
  await page.getByPlaceholder("Search exercises...").fill(searchQuery)
  await page.getByRole("button", { name: exerciseName }).first().click()

  await expect(page.getByRole("heading", { name: "Add Exercise" })).toBeHidden()
  await expect(page.locator("[data-slot='sheet-overlay']")).toHaveCount(0)
}

test("workout journey starts, modifies, finishes, and appears in history", async ({ page }) => {
  await registerUnauthenticatedSyncApiMocks(page)
  const workoutName = "E2E Session Workout"

  await startBlankWorkout(workoutName, page)
  await page.getByRole("button", { name: "Add Exercise" }).click()
  await expect(page.getByRole("heading", { name: "Add Exercise" })).toBeVisible()

  await page.getByPlaceholder("Search exercises...").fill("bench")
  await page.getByRole("button", { name: /bench press/i }).first().click()

  await expect(page.getByRole("button", { name: "Add Set" }).first()).toBeVisible()
  await page.getByRole("button", { name: "Add Set" }).first().click()

  await page.getByRole("button", { name: "Finish Workout" }).click()
  await page.getByRole("button", { name: "Finish" }).click()

  await expect(page).toHaveURL(/\/workout$/)
  await expect(page.getByText("Recent Sessions")).toBeVisible()
  await expect(page.getByText(workoutName)).toBeVisible()

  await page.getByRole("button", { name: "History" }).click()
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible()
  await expect(page.getByText(workoutName)).toBeVisible()
})

test("exercise picker supports custom create/edit/filter flows", async ({ page }) => {
  await registerUnauthenticatedSyncApiMocks(page)
  await startBlankWorkout("E2E Custom Exercise Flow", page)

  await page.getByRole("button", { name: "Add Exercise" }).click()
  await expect(page.getByRole("heading", { name: "Add Exercise" })).toBeVisible()

  await page.getByRole("button", { name: "Custom", exact: true }).click()
  await expect(page.getByText("No exercises found")).toBeVisible()

  const customName = "E2E Custom Kickback"
  const updatedCustomName = "E2E Custom Kickback Updated"

  await page.getByRole("button", { name: "New" }).click()
  await page.getByLabel("Name").fill(customName)
  await page.getByRole("button", { name: "Create Exercise" }).click()

  await expect(page.getByText(customName, { exact: true }).first()).toBeVisible()

  await page.getByRole("button", { name: "Add Exercise" }).click()
  await page.getByRole("button", { name: "Custom", exact: true }).click()
  await expect(page.getByRole("button", { name: customName, exact: true })).toBeVisible()

  await page.getByRole("button", { name: `Edit ${customName}` }).click()
  await page.getByLabel("Name").fill(updatedCustomName)
  await page.getByRole("button", { name: "Update Exercise" }).click()

  await expect(page.getByRole("button", { name: updatedCustomName, exact: true })).toBeVisible()
})

test("workout set row supports reps/weight editing and timed controls", async ({ page }) => {
  await registerUnauthenticatedSyncApiMocks(page)
  await startBlankWorkout("E2E Set Row Flow", page)

  await addExerciseFromSheet(page, "bench press", /bench press/i)
  await addExerciseFromSheet(page, "plank", /plank/i)

  const benchCard = page
    .locator("[data-slot='card']")
    .filter({ hasText: /bench press/i })
    .first()

  await benchCard.locator("[data-slot='card-header']").click()

  const repsButton = benchCard.getByRole("button", { name: "Set 1 reps" })
  await expect(repsButton).toBeVisible()
  await repsButton.click()
  await page.locator(".snap-y.snap-mandatory").first().evaluate((element) => {
    element.scrollTop = 600
    element.dispatchEvent(new Event("scroll"))
  })
  await page.waitForTimeout(150)
  await page.getByRole("button", { name: "Confirm" }).click()
  await expect.poll(async () => {
    const text = await repsButton.innerText()
    const parsed = Number.parseFloat(text)
    return Number.isFinite(parsed) ? parsed : 0
  }).toBeGreaterThan(0)

  const weightButton = benchCard.getByRole("button", { name: "Set 1 weight" })
  await expect(weightButton).toBeVisible()
  await weightButton.click()
  await page.locator(".snap-y.snap-mandatory").first().evaluate((element) => {
    element.scrollTop = 600
    element.dispatchEvent(new Event("scroll"))
  })
  await page.waitForTimeout(150)
  await page.getByRole("button", { name: "Confirm" }).click()
  await expect.poll(async () => {
    const text = await weightButton.innerText()
    const parsed = Number.parseFloat(text)
    return Number.isFinite(parsed) ? parsed : 0
  }).toBeGreaterThan(0)

  const plankCard = page
    .locator("[data-slot='card']")
    .filter({ hasText: /plank/i })
    .first()

  await plankCard.locator("[data-slot='card-header']").click()

  const durationInput = plankCard.getByPlaceholder("0:00").first()
  await durationInput.fill("0:45")
  await durationInput.press("Enter")

  await plankCard.getByRole("button", { name: "Start set 1 timer" }).click()
  await expect(plankCard.getByRole("button", { name: "Pause set 1 timer" })).toBeVisible()
  await plankCard.getByRole("button", { name: "Pause set 1 timer" }).click()
  await expect(plankCard.getByRole("button", { name: "Resume set 1 timer" })).toBeVisible()
  await plankCard.getByRole("button", { name: "Resume set 1 timer" }).click()
})
