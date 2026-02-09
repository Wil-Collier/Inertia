import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { UnitSettings } from "@/components/settings/UnitSettings"

describe("UnitSettings", () => {
  afterEach(() => {
    cleanup()
  })

  it("invokes callbacks when weight and distance units change", async () => {
    const user = userEvent.setup()
    const onWeightUnitChange = vi.fn()
    const onDistanceUnitChange = vi.fn()

    render(
      <UnitSettings
        weightUnit="lbs"
        distanceUnit="mi"
        onWeightUnitChange={onWeightUnitChange}
        onDistanceUnitChange={onDistanceUnitChange}
      />
    )

    await user.click(screen.getByRole("button", { name: "Kilograms (kg)" }))
    await user.click(screen.getByRole("button", { name: "Kilometers (km)" }))

    expect(onWeightUnitChange).toHaveBeenCalledWith("kg")
    expect(onDistanceUnitChange).toHaveBeenCalledWith("km")
  })

  it("renders selected options with active styles", () => {
    render(
      <UnitSettings
        weightUnit="kg"
        distanceUnit="km"
        onWeightUnitChange={vi.fn()}
        onDistanceUnitChange={vi.fn()}
      />
    )

    expect(screen.getAllByRole("button", { name: "Kilograms (kg)" })[0].className).toMatch(/bg-primary/)
    expect(screen.getAllByRole("button", { name: "Kilometers (km)" })[0].className).toMatch(/bg-primary/)
  })
})
