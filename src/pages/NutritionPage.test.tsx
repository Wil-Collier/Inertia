import { cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { ReactNode } from "react"
import { NutritionPage } from "@/pages/NutritionPage"
import type { FoodItem, MealType } from "@/lib/types"

interface LinkProps {
  children?: ReactNode
}

interface MealLoggerProps {
  openAddSheet: (mealType: MealType) => void
}

interface AddFoodSheetProps {
  isOpen: boolean
  activeTab: string
  searchResults: FoodItem[]
  scannedBarcode: string | null
  onScanBarcode: () => void
  onAddFood: (food: FoodItem, qty: number) => Promise<void>
  onSaveAndAddCustomFood: (food: Omit<FoodItem, "id" | "isCustom">) => void
  onToggleFavorite: (foodId: string) => Promise<void>
}

interface BarcodeScannerProps {
  onScan: (code: string) => void
  onClose: () => void
}

interface CombinedSearchState {
  items: FoodItem[]
  remoteStatus: "idle" | "ok" | "error"
  remoteError?: string
}

const REMOTE_FOOD: FoodItem = {
  id: "remote-food-1",
  name: "Remote Oats",
  calories: 240,
  protein: 10,
  carbs: 42,
  fat: 4,
  fiber: 6,
  sugar: 1,
  servingSize: "1 bowl",
  isCustom: false,
  isFavorite: false,
}

const CUSTOM_PAYLOAD: Omit<FoodItem, "id" | "isCustom"> = {
  name: "Custom Bowl",
  calories: 420,
  protein: 32,
  carbs: 45,
  fat: 12,
  fiber: 8,
  sugar: 6,
  servingSize: "1 serving",
}

const CUSTOM_FOOD: FoodItem = {
  id: "custom-food-1",
  ...CUSTOM_PAYLOAD,
  isCustom: true,
}

const nutritionPageState = vi.hoisted(() => ({
  dbFoodGet: vi.fn(),
  getProductByBarcode: vi.fn(),
  toastSuccess: vi.fn(),
  toastInfo: vi.fn(),
  toastError: vi.fn(),
  addFoodMutateAsync: vi.fn(),
  addMealEntryMutate: vi.fn(),
  updateMealEntryMutateAsync: vi.fn(),
  removeMealEntryMutateAsync: vi.fn(),
  toggleFavoriteMutateAsync: vi.fn(),
  deleteFoodMutateAsync: vi.fn(),
  deleteMealTemplateMutate: vi.fn(),
  applyMealTemplateMutate: vi.fn(),
  removeMealEntryGroupMutateAsync: vi.fn(),
  dailyNutrition: {
    totals: {
      calories: 0,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
    },
    entriesWithFood: [],
    log: null,
  },
  favorites: [] as FoodItem[],
  customFoods: [] as FoodItem[],
  mealTemplates: [] as Array<{ id: string; name: string; entries: [] }>,
  combinedSearch: {
    items: [] as FoodItem[],
    remoteStatus: "idle",
    remoteError: undefined as string | undefined,
  } as CombinedSearchState,
  settings: {
    nutritionGoals: {
      calories: 2200,
      protein: 180,
      carbs: 250,
      fat: 70,
      fiber: 30,
      sugar: 50,
    },
  },
}))

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: LinkProps) => <div>{children}</div>,
}))

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => nutritionPageState.toastSuccess(...args),
    info: (...args: unknown[]) => nutritionPageState.toastInfo(...args),
    error: (...args: unknown[]) => nutritionPageState.toastError(...args),
  },
}))

vi.mock("@/lib/dateUtils", () => ({
  getToday: () => "2026-02-09",
}))

vi.mock("@/hooks/useDebouncedValue", () => ({
  useDebouncedValue: (value: string) => value,
}))

vi.mock("@/services/db", () => ({
  db: {
    foods: {
      get: (...args: unknown[]) => nutritionPageState.dbFoodGet(...args),
    },
  },
}))

vi.mock("@/services/nutritionApi", () => ({
  getProductByBarcode: (...args: unknown[]) => nutritionPageState.getProductByBarcode(...args),
}))

vi.mock("@/components/layout/Header", () => ({
  Header: ({ title, rightAction }: { title: string; rightAction?: ReactNode }) => (
    <div>
      <h1>{title}</h1>
      {rightAction}
    </div>
  ),
}))

vi.mock("@/components/nutrition/DateNavigator", () => ({
  DateNavigator: ({ selectedDate }: { selectedDate: string }) => (
    <div>Date: {selectedDate}</div>
  ),
}))

vi.mock("@/components/nutrition/MacroSummary", () => ({
  MacroSummary: () => <div>Macro Summary</div>,
}))

vi.mock("@/components/nutrition/MealLogger", () => ({
  MealLogger: ({ openAddSheet }: MealLoggerProps) => (
    <button type="button" onClick={() => openAddSheet("breakfast")}>
      Open Breakfast Sheet
    </button>
  ),
}))

vi.mock("@/components/nutrition/AddFoodSheet", () => ({
  AddFoodSheet: ({
    isOpen,
    activeTab,
    searchResults,
    scannedBarcode,
    onScanBarcode,
    onAddFood,
    onSaveAndAddCustomFood,
    onToggleFavorite,
  }: AddFoodSheetProps) => (
    <div
      data-testid="add-food-sheet"
      data-open={isOpen ? "true" : "false"}
      data-tab={activeTab}
    >
      <p>{searchResults[0] ? `Result: ${searchResults[0].name}` : "Result: none"}</p>
      <p>{scannedBarcode ? `Scanned: ${scannedBarcode}` : "Scanned: none"}</p>
      <button type="button" onClick={onScanBarcode}>
        Trigger Barcode Scan
      </button>
      <button type="button" onClick={() => void onAddFood(REMOTE_FOOD, 2)}>
        Invoke Add Remote Food
      </button>
      <button type="button" onClick={() => onSaveAndAddCustomFood(CUSTOM_PAYLOAD)}>
        Invoke Save And Add Custom
      </button>
      <button type="button" onClick={() => void onToggleFavorite(REMOTE_FOOD.id)}>
        Invoke Toggle Favorite
      </button>
    </div>
  ),
}))

vi.mock("@/components/BarcodeScanner", () => ({
  BarcodeScanner: ({ onScan, onClose }: BarcodeScannerProps) => (
    <div data-testid="barcode-scanner">
      <button type="button" onClick={() => onScan("1234567890")}>
        Mock Scanner Success
      </button>
      <button type="button" onClick={onClose}>
        Mock Scanner Close
      </button>
    </div>
  ),
}))

vi.mock("@/features/nutrition/queries", () => ({
  useDailyNutrition: () => ({ data: nutritionPageState.dailyNutrition }),
  useFavoriteFoods: () => ({ data: nutritionPageState.favorites }),
  useCustomFoods: () => ({ data: nutritionPageState.customFoods }),
  useMealTemplates: () => ({ data: nutritionPageState.mealTemplates }),
  useCombinedFoodSearch: () => ({
    data: nutritionPageState.combinedSearch,
    isFetching: false,
  }),
}))

vi.mock("@/features/nutrition/mutations", () => ({
  useAddMealEntry: () => ({ mutate: nutritionPageState.addMealEntryMutate }),
  useUpdateMealEntry: () => ({ mutateAsync: nutritionPageState.updateMealEntryMutateAsync }),
  useRemoveMealEntry: () => ({ mutateAsync: nutritionPageState.removeMealEntryMutateAsync }),
  useAddFood: () => ({ mutateAsync: nutritionPageState.addFoodMutateAsync }),
  useDeleteFood: () => ({ mutateAsync: nutritionPageState.deleteFoodMutateAsync }),
  useToggleFavoriteFood: () => ({ mutateAsync: nutritionPageState.toggleFavoriteMutateAsync }),
  useDeleteMealTemplate: () => ({ mutate: nutritionPageState.deleteMealTemplateMutate }),
  useApplyMealTemplate: () => ({ mutate: nutritionPageState.applyMealTemplateMutate }),
  useRemoveMealEntryGroup: () => ({ mutateAsync: nutritionPageState.removeMealEntryGroupMutateAsync }),
}))

vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({ data: nutritionPageState.settings }),
}))

describe("NutritionPage", () => {
  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
    nutritionPageState.dbFoodGet.mockResolvedValue(undefined)
    nutritionPageState.getProductByBarcode.mockResolvedValue(null)
    nutritionPageState.addFoodMutateAsync.mockResolvedValue(REMOTE_FOOD)
    nutritionPageState.addMealEntryMutate.mockImplementation((_variables: unknown, options?: { onSuccess?: () => void }) => {
      options?.onSuccess?.()
    })
    nutritionPageState.toggleFavoriteMutateAsync.mockResolvedValue(undefined)
    nutritionPageState.combinedSearch = {
      items: [REMOTE_FOOD],
      remoteStatus: "ok",
      remoteError: undefined,
    }
  })

  it("handles barcode lookup success and shows resolved result", async () => {
    const user = userEvent.setup()
    nutritionPageState.getProductByBarcode.mockResolvedValue(REMOTE_FOOD)

    render(<NutritionPage />)

    await user.click(screen.getByRole("button", { name: "Open Breakfast Sheet" }))
    expect(screen.getByTestId("add-food-sheet").getAttribute("data-open")).toBe("true")

    await user.click(screen.getByRole("button", { name: "Trigger Barcode Scan" }))
    await waitFor(() => {
      expect(screen.getByTestId("barcode-scanner")).toBeTruthy()
    })
    await user.click(screen.getByRole("button", { name: "Mock Scanner Success" }))

    await waitFor(() => {
      expect(nutritionPageState.toastSuccess).toHaveBeenCalledWith(`Found: ${REMOTE_FOOD.name}`)
    })
    expect(screen.getByText(`Result: ${REMOTE_FOOD.name}`)).toBeTruthy()
    expect(screen.getByTestId("add-food-sheet").getAttribute("data-tab")).toBe("search")
  })

  it("handles missing barcode results by switching to custom food creation flow", async () => {
    const user = userEvent.setup()
    nutritionPageState.getProductByBarcode.mockResolvedValue(null)

    render(<NutritionPage />)

    await user.click(screen.getByRole("button", { name: "Open Breakfast Sheet" }))
    await user.click(screen.getByRole("button", { name: "Trigger Barcode Scan" }))
    await user.click(screen.getByRole("button", { name: "Mock Scanner Success" }))

    await waitFor(() => {
      expect(nutritionPageState.toastInfo).toHaveBeenCalledWith("Product not found. Create a custom entry.")
    })
    expect(screen.getByTestId("add-food-sheet").getAttribute("data-tab")).toBe("myfoods")
    expect(screen.getByText("Scanned: 1234567890")).toBeTruthy()
  })

  it("adds remote food to local db when missing and logs meal entry", async () => {
    const user = userEvent.setup()
    nutritionPageState.dbFoodGet.mockResolvedValue(undefined)
    nutritionPageState.addFoodMutateAsync.mockResolvedValue(REMOTE_FOOD)

    render(<NutritionPage />)

    await user.click(screen.getByRole("button", { name: "Open Breakfast Sheet" }))
    await user.click(screen.getByRole("button", { name: "Invoke Add Remote Food" }))

    await waitFor(() => {
      expect(nutritionPageState.addFoodMutateAsync).toHaveBeenCalledWith({
        ...REMOTE_FOOD,
        isCustom: false,
      })
      expect(nutritionPageState.addMealEntryMutate).toHaveBeenCalledWith(
        {
          date: "2026-02-09",
          foodId: REMOTE_FOOD.id,
          quantity: 2,
          mealType: "breakfast",
        },
        expect.any(Object)
      )
    })
    expect(screen.getByTestId("add-food-sheet").getAttribute("data-open")).toBe("false")
  })

  it("saves and adds a custom food through the page flow", async () => {
    const user = userEvent.setup()
    nutritionPageState.addFoodMutateAsync.mockResolvedValue(CUSTOM_FOOD)

    render(<NutritionPage />)

    await user.click(screen.getByRole("button", { name: "Open Breakfast Sheet" }))
    await user.click(screen.getByRole("button", { name: "Invoke Save And Add Custom" }))

    await waitFor(() => {
      expect(nutritionPageState.addFoodMutateAsync).toHaveBeenCalledWith({
        ...CUSTOM_PAYLOAD,
        isCustom: true,
      })
      expect(nutritionPageState.addMealEntryMutate).toHaveBeenCalledWith(
        {
          date: "2026-02-09",
          foodId: CUSTOM_FOOD.id,
          quantity: 1,
          mealType: "breakfast",
        },
        expect.any(Object)
      )
    })
  })

  it("toggles favorites using the displayed food set", async () => {
    const user = userEvent.setup()

    render(<NutritionPage />)

    await user.click(screen.getByRole("button", { name: "Open Breakfast Sheet" }))
    await user.click(screen.getByRole("button", { name: "Invoke Toggle Favorite" }))

    await waitFor(() => {
      expect(nutritionPageState.toggleFavoriteMutateAsync).toHaveBeenCalledWith({
        id: REMOTE_FOOD.id,
        isFavorite: true,
        food: REMOTE_FOOD,
      })
    })
  })
})
