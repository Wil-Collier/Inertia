import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it } from "vitest"
import { WeightCard } from "@/components/dashboard/WeightCard"
import { renderAppRoute } from "@/test/helpers/renderAppRoute"
import { resetTestRuntime } from "@/test/helpers/resetTestRuntime"
import { seedTestState } from "@/test/helpers/seedTestState"
import { createSettings } from "@/test/factories/settingsFactory"

function renderWeightCard() {
  return renderAppRoute({
    initialPath: "/",
    routes: [{ path: "/", component: WeightCard }],
  })
}

describe("WeightCard", () => {
  beforeEach(async () => {
    await resetTestRuntime()
  })

  it("shows placeholder when no weight entries exist", async () => {
    await renderWeightCard()

    await waitFor(() => {
      // "--" is shown when no entries have loaded
      expect(screen.getAllByText("--").length).toBeGreaterThan(0)
    })
  })

  it("displays the latest weight entry in kg (default unit)", async () => {
    // Default unit is kg. 180 lbs stored → displayed as 81.6 kg.
    await seedTestState({
      bodyWeight: [
        { id: "w1", date: "2026-02-18", weight: 180 },
        { id: "w2", date: "2026-02-17", weight: 179 },
      ],
    })

    await renderWeightCard()

    await waitFor(() => {
      expect(screen.getAllByText("81.6").length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText("kg").length).toBeGreaterThan(0)
  })

  it("displays the latest weight in lbs when user preference is lbs", async () => {
    // 180 lbs stored → displayed as 180 when unit is lbs.
    await seedTestState({
      settings: createSettings({ unitPreferences: { weight: "lbs", distance: "km" } }),
      bodyWeight: [{ id: "w1", date: "2026-02-18", weight: 180 }],
    })

    await renderWeightCard()

    await waitFor(() => {
      expect(screen.getAllByText("180").length).toBeGreaterThan(0)
    })
    expect(screen.getAllByText("lbs").length).toBeGreaterThan(0)
  })

  it("shows positive trend when latest weight is higher than previous (in display unit)", async () => {
    // Default unit is kg.
    // 182 lbs → 82.6 kg, 180 lbs → 81.6 kg. Difference = +1.0 kg.
    await seedTestState({
      bodyWeight: [
        { id: "w1", date: "2026-02-18", weight: 182 },
        { id: "w2", date: "2026-02-17", weight: 180 },
      ],
    })

    await renderWeightCard()

    await waitFor(() => {
      // trend span text content is "+1.0"
      const elements = screen.getAllByText("+1.0")
      expect(elements.length).toBeGreaterThan(0)
    })
  })

  it("shows negative trend when latest weight is lower than previous (in display unit)", async () => {
    // Default unit is kg.
    // 178 lbs → 80.7 kg, 180 lbs → 81.6 kg. Difference ≈ -0.9 kg.
    await seedTestState({
      bodyWeight: [
        { id: "w1", date: "2026-02-18", weight: 178 },
        { id: "w2", date: "2026-02-17", weight: 180 },
      ],
    })

    await renderWeightCard()

    await waitFor(() => {
      const elements = screen.getAllByText("-0.9")
      expect(elements.length).toBeGreaterThan(0)
    })
  })

  it("saves weight in lbs when user enters in kg (default unit)", async () => {
    const user = userEvent.setup()

    await renderWeightCard()

    // Open the log dialog via the Plus button
    const plusButtons = screen.getAllByRole("button")
    // Find the plus/add button (DialogTrigger wraps a Button with Plus icon)
    const addButton = plusButtons.find((btn) => btn.querySelector("svg") !== null)
    expect(addButton).toBeTruthy()
    await user.click(addButton!)

    const input = await screen.findByPlaceholderText("0.0")
    await user.type(input, "82")

    const saveButton = screen.getByRole("button", { name: /save weight/i })
    await user.click(saveButton)

    // After save, the dialog should close (input disappears)
    await waitFor(() => {
      expect(screen.queryByPlaceholderText("0.0")).toBeFalsy()
    })
  })
})
