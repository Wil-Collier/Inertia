import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CustomFoodForm } from "@/features/nutrition/components/CustomFoodForm"

describe("CustomFoodForm", () => {
  const onSave = vi.fn()
  const onSaveAndAdd = vi.fn()
  const onClearBarcode = vi.fn()

  afterEach(() => {
    cleanup()
  })

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("starts collapsed and expands when creating a new food", async () => {
    const user = userEvent.setup()

    render(
      <CustomFoodForm
        onSave={onSave}
        onSaveAndAdd={onSaveAndAdd}
      />
    )

    expect(screen.getByRole("button", { name: "Create New Food" })).toBeTruthy()
    await user.click(screen.getByRole("button", { name: "Create New Food" }))

    expect(screen.getByText("Create New Food")).toBeTruthy()
    expect(screen.getByLabelText("Name")).toBeTruthy()
  })

  it("requires a name before enabling save actions", async () => {
    const user = userEvent.setup()

    render(
      <CustomFoodForm
        onSave={onSave}
        onSaveAndAdd={onSaveAndAdd}
      />
    )

    await user.click(screen.getByRole("button", { name: "Create New Food" }))

    const saveOnlyButton = screen.getByRole("button", { name: "Save Only" })
    const saveAndAddButton = screen.getByRole("button", { name: "Save & Add" })
    expect(saveOnlyButton.hasAttribute("disabled")).toBe(true)
    expect(saveAndAddButton.hasAttribute("disabled")).toBe(true)

    await user.type(screen.getByLabelText("Name"), "   ")
    expect(saveOnlyButton.hasAttribute("disabled")).toBe(true)

    await user.clear(screen.getByLabelText("Name"))
    await user.type(screen.getByLabelText("Name"), "Chicken Bowl")
    expect(saveOnlyButton.hasAttribute("disabled")).toBe(false)
    expect(saveAndAddButton.hasAttribute("disabled")).toBe(false)
  })

  it("saves only with normalized numeric values and resets form", async () => {
    const user = userEvent.setup()

    render(
      <CustomFoodForm
        onSave={onSave}
        onSaveAndAdd={onSaveAndAdd}
      />
    )

    await user.click(screen.getByRole("button", { name: "Create New Food" }))
    await user.type(screen.getByLabelText("Name"), "  Protein Oats  ")
    await user.type(screen.getByLabelText("Calories"), "350")
    await user.type(screen.getByLabelText("Protein (g)"), "25")
    await user.type(screen.getByLabelText("Carbs (g)"), "48")
    await user.type(screen.getByLabelText("Fat (g)"), "7")
    await user.type(screen.getByLabelText("Fiber (g)"), "6")
    await user.type(screen.getByLabelText("Sugar (g)"), "8")
    await user.clear(screen.getByLabelText("Serving Size"))
    await user.type(screen.getByLabelText("Serving Size"), "1 bowl")

    await user.click(screen.getByRole("button", { name: "Save Only" }))

    expect(onSave).toHaveBeenCalledWith({
      name: "Protein Oats",
      calories: 350,
      protein: 25,
      carbs: 48,
      fat: 7,
      fiber: 6,
      sugar: 8,
      servingSize: "1 bowl",
      barcode: undefined,
    })
    expect(screen.getByRole("button", { name: "Create New Food" })).toBeTruthy()
  })

  it("auto-expands with scanned barcode and clears stale barcode when closed", async () => {
    const user = userEvent.setup()

    render(
      <CustomFoodForm
        onSave={onSave}
        onSaveAndAdd={onSaveAndAdd}
        initialBarcode="1234567890123"
        onClearBarcode={onClearBarcode}
      />
    )

    expect(screen.getByText("Create Food (Scanned)")).toBeTruthy()
    expect(screen.getByText("1234567890123")).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Close custom food form" }))
    expect(onClearBarcode).toHaveBeenCalledTimes(1)
    expect(screen.getByRole("button", { name: "Create New Food" })).toBeTruthy()

    await user.click(screen.getByRole("button", { name: "Create New Food" }))
    expect(screen.queryByText("1234567890123")).toBeNull()
  })

  it("supports save-and-add flow with barcode payload", async () => {
    const user = userEvent.setup()

    render(
      <CustomFoodForm
        onSave={onSave}
        onSaveAndAdd={onSaveAndAdd}
        initialBarcode="987654321000"
        onClearBarcode={onClearBarcode}
      />
    )

    await user.type(screen.getByLabelText("Name"), "E2E Snack")
    await user.type(screen.getByLabelText("Calories"), "220")
    await user.click(screen.getByRole("button", { name: "Save & Add" }))

    expect(onSaveAndAdd).toHaveBeenCalledWith({
      name: "E2E Snack",
      calories: 220,
      protein: 0,
      carbs: 0,
      fat: 0,
      fiber: 0,
      sugar: 0,
      servingSize: "1 serving",
      barcode: "987654321000",
    })
    expect(onClearBarcode).toHaveBeenCalled()
  })
})
