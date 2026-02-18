import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import userEvent from "@testing-library/user-event"
import { cleanup, screen, waitFor } from "@testing-library/react"
import { http, HttpResponse } from "msw"
import { db } from "@/services/db"
import { achievementService } from "@/services/achievementService"
import { NutritionPage } from "@/pages/NutritionPage"
import { server } from "@/test/msw/server"
import { createRemoteFood } from "@/test/factories/nutritionFactory"
import { createSettings } from "@/test/factories/settingsFactory"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"

interface BarcodeScannerProps {
  isOpen: boolean
  onScan: (code: string) => void
  onClose: () => void
}

const nutritionTestState = vi.hoisted(() => ({
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => nutritionTestState.toastSuccess(...args),
    info: (...args: unknown[]) => nutritionTestState.toastInfo(...args),
    error: (...args: unknown[]) => nutritionTestState.toastError(...args),
  },
}))

vi.mock("@/lib/dateUtils", () => ({
  getToday: () => "2026-02-09",
  parseDbDate: (dateStr: string) => {
    const [yStr, mStr, dStr] = dateStr.split("-")
    return new Date(Number(yStr), Number(mStr) - 1, Number(dStr))
  },
  formatDate: (date: Date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, "0")
    const day = String(date.getDate()).padStart(2, "0")
    return `${year}-${month}-${day}`
  },
}))

vi.mock("@/components/BarcodeScanner", () => ({
  BarcodeScanner: ({ isOpen, onScan, onClose }: BarcodeScannerProps) =>
    isOpen ? (
      <div data-testid="barcode-scanner">
        <button type="button" onClick={() => onScan("1234567890")}>
          Mock Scanner Success
        </button>
        <button type="button" onClick={onClose}>
          Mock Scanner Close
        </button>
      </div>
    ) : null,
}))

const REMOTE_FOOD = createRemoteFood({
  id: "remote-food-1",
  name: "Remote Oats",
  calories: 240,
  protein: 10,
  carbs: 42,
  fat: 4,
  fiber: 6,
  sugar: 1,
  servingSize: "1 bowl",
  isFavorite: false,
})

async function renderNutritionRoute() {
  return await renderAppRoute({
    initialPath: "/nutrition",
    routes: [
      { path: "/nutrition", component: NutritionPage },
      { path: "/nutrition/history", component: () => <div>History Page</div> },
      { path: "/nutrition/template-editor", component: () => <div>Template Editor</div> },
    ],
  })
}

async function openBreakfastSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Add food to Breakfast" }))
  await screen.findByRole("button", { name: "Scan barcode" })
}

async function scanDefaultBarcode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Scan barcode" }))
  const scanner = await screen.findByTestId("barcode-scanner")
  const scanButton = scanner.querySelector("button")
  if (!scanButton) {
    throw new Error("Expected scanner success button")
  }
  await user.click(scanButton)
}

describe("NutritionPage", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(async () => {
    vi.clearAllMocks()
    await resetTestRuntime()

    vi.spyOn(achievementService, "updateStreaks").mockResolvedValue()
    vi.spyOn(achievementService, "checkNutritionAchievements").mockResolvedValue()

    await seedTestState({
      settings: createSettings(),
    })
  })

  it("handles barcode lookup success and adds meal entry immediately", async () => {
    const user = userEvent.setup()

    await renderNutritionRoute()
    await openBreakfastSheet(user)
    await scanDefaultBarcode(user)

    await waitFor(() => {
      expect(nutritionTestState.toastSuccess).toHaveBeenCalledWith("Found: Remote Oats")
    })

    expect(screen.queryByTestId("barcode-scanner")).toBeNull()

    await waitFor(() => {
      expect(screen.queryByText("Add to Breakfast")).toBeNull()
    })

    await waitFor(async () => {
      const nutritionLog = await db.nutritionLogs.get("2026-02-09")
      expect(nutritionLog?.entries).toHaveLength(1)
      expect(nutritionLog?.entries[0]).toMatchObject({
        foodId: REMOTE_FOOD.id,
        mealType: "breakfast",
        quantity: 1,
      })
    })
  })

  it("handles missing barcode results by switching to custom flow", async () => {
    const user = userEvent.setup()

    server.use(
      http.get("/api/nutrition/barcode", () => {
        return HttpResponse.json({ error: "NOT_FOUND", message: "Product not found" }, { status: 404 })
      })
    )

    await renderNutritionRoute()
    await openBreakfastSheet(user)
    await scanDefaultBarcode(user)

    await waitFor(() => {
      expect(nutritionTestState.toastInfo).toHaveBeenCalledWith(
        "Product not found. Create a custom entry."
      )
    })

    expect(screen.queryByTestId("barcode-scanner")).toBeNull()
    expect(screen.getByText("Create Food (Scanned)")).toBeTruthy()
    expect(screen.getByText("Barcode:")).toBeTruthy()
    expect(screen.getByText("1234567890")).toBeTruthy()
  })

  it("shows barcode lookup errors to the user", async () => {
    const user = userEvent.setup()

    server.use(
      http.get("/api/nutrition/barcode", () => {
        return HttpResponse.json({ error: "SERVER_ERROR", message: "lookup failed" }, { status: 500 })
      })
    )

    await renderNutritionRoute()
    await openBreakfastSheet(user)
    await scanDefaultBarcode(user)

    await waitFor(() => {
      expect(nutritionTestState.toastError).toHaveBeenCalledWith("Failed to look up product")
    })

    expect(screen.queryByTestId("barcode-scanner")).toBeNull()
  })

  it("adds remote food to local db when missing and logs meal entry", async () => {
    const user = userEvent.setup()

    await renderNutritionRoute()
    await openBreakfastSheet(user)
    await scanDefaultBarcode(user)

    await waitFor(async () => {
      const persistedFood = await db.foods.get(REMOTE_FOOD.id)
      const nutritionLog = await db.nutritionLogs.get("2026-02-09")

      expect(persistedFood).toBeTruthy()
      expect(nutritionLog?.entries).toHaveLength(1)
      expect(nutritionLog?.entries[0]).toMatchObject({
        foodId: REMOTE_FOOD.id,
        mealType: "breakfast",
        quantity: 1,
      })
    })

    expect(screen.queryByText("Add to Breakfast")).toBeNull()
  })

  it("does not duplicate remote food when already present locally", async () => {
    const user = userEvent.setup()

    await seedTestState({
      foods: [REMOTE_FOOD],
    })

    await renderNutritionRoute()
    await openBreakfastSheet(user)
    await scanDefaultBarcode(user)

    await waitFor(async () => {
      const foods = await db.foods.toArray()
      const nutritionLog = await db.nutritionLogs.get("2026-02-09")

      expect(foods).toHaveLength(1)
      expect(foods[0]?.id).toBe(REMOTE_FOOD.id)
      expect(nutritionLog?.entries).toHaveLength(1)
    })
  })

  it("toggles favorites via real mutation and persists state", async () => {
    // Seed the food so it shows up in the list without needing a barcode scan
    await seedTestState({ foods: [REMOTE_FOOD] })

    const user = userEvent.setup()

    await renderNutritionRoute()
    await openBreakfastSheet(user)

    // Type into the search box then advance past the debounce delay
    const searchInput = screen.getByPlaceholderText("Search foods...")
    await user.type(searchInput, "oats")
    vi.useFakeTimers()
    vi.advanceTimersByTime(400)
    vi.useRealTimers()

    await user.click(await screen.findByRole("button", { name: "Toggle favorite for Remote Oats" }))

    await waitFor(async () => {
      const favoriteFood = await db.foods.get(REMOTE_FOOD.id)
      expect(favoriteFood?.isFavorite).toBe(true)
    })
  })
})
