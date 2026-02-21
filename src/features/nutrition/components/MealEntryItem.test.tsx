import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MealEntryItem } from "./MealEntryItem"
import type { FoodItem } from "@/lib/types"

const food: FoodItem = {
  id: "food-1",
  name: "Whole Wheat Bread",
  brand: "Acme",
  calories: 83,
  protein: 3.8,
  carbs: 15.7,
  fat: 1,
  fiber: 2.2,
  sugar: 1.9,
  servingSize: "1 slice",
  isCustom: false,
}

afterEach(() => {
  cleanup()
})

describe("MealEntryItem", () => {
  it("increments quantity by 0.25 from quick controls", async () => {
    const user = userEvent.setup()
    const onUpdateQuantity = vi.fn()

    render(
      <MealEntryItem
        entry={{ id: "entry-1", quantity: 1 }}
        food={food}
        onRemove={vi.fn()}
        onUpdateQuantity={onUpdateQuantity}
      />
    )

    await user.click(screen.getByRole("button", { name: "Increase quantity for Whole Wheat Bread" }))

    expect(onUpdateQuantity).toHaveBeenCalledWith(1.25)
    expect(screen.getByText("1.25")).toBeTruthy()
  })

  it("prevents decrementing below 0.25", () => {
    render(
      <MealEntryItem
        entry={{ id: "entry-1", quantity: 0.25 }}
        food={food}
        onRemove={vi.fn()}
        onUpdateQuantity={vi.fn()}
      />
    )

    const decrementButton = screen.getByRole("button", { name: "Decrease quantity for Whole Wheat Bread" })
    if (!(decrementButton instanceof HTMLButtonElement)) {
      throw new TypeError("Expected decrement button to be a HTMLButtonElement")
    }
    expect(decrementButton.disabled).toBe(true)
  })
})
