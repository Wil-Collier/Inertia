import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { FoodSearch } from "./FoodSearch"
import type { ComponentProps } from "react"
import type { FoodItem } from "@/lib/types"

vi.mock("./FoodListItem", () => ({
  FoodListItem: ({ food }: { food: FoodItem }) => <div>{food.name}</div>,
}))

vi.mock("./CustomFoodForm", () => ({
  CustomFoodForm: () => <div>Custom Food Form</div>,
}))

const sampleFood: FoodItem = {
  id: "food-1",
  name: "Local Apple",
  calories: 52,
  protein: 0.3,
  carbs: 13.8,
  fat: 0.2,
  fiber: 2.4,
  sugar: 10.4,
  servingSize: "1 apple",
  isCustom: true,
}

function renderFoodSearch(overrides: Partial<ComponentProps<typeof FoodSearch>> = {}) {
  return render(
    <FoodSearch
      activeTab="search"
      onTabChange={vi.fn()}
      searchQuery="apple"
      onSearchQueryChange={vi.fn()}
      isSearching={false}
      isLookingUp={false}
      searchResults={[]}
      onScanBarcode={vi.fn()}
      onAddFood={vi.fn()}
      onToggleFavorite={vi.fn()}
      onDeleteFood={vi.fn()}
      favorites={[]}
      customFoods={[]}
      scannedBarcode={null}
      onClearBarcode={vi.fn()}
      onSaveCustomFood={vi.fn()}
      onSaveAndAddCustomFood={vi.fn()}
      remoteStatus="idle"
      {...overrides}
    />
  )
}

describe("FoodSearch", () => {
  it("does not show remote error helper when there are no local fallback results", () => {
    renderFoodSearch({
      remoteStatus: "error",
      remoteError: "Server error",
      searchResults: [],
    })

    expect(screen.getByText("No results found")).toBeTruthy()
    expect(screen.queryByText(/Remote search unavailable/i)).toBeNull()
  })

  it("shows remote error helper when local results are present", () => {
    renderFoodSearch({
      remoteStatus: "error",
      remoteError: "Server error",
      searchResults: [sampleFood],
    })

    expect(screen.getByText(/Remote search unavailable\. Showing local results: Server error/i)).toBeTruthy()
    expect(screen.getByText("Local Apple")).toBeTruthy()
  })
})
