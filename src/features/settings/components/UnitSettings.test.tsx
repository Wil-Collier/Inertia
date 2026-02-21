import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { UnitSettings } from "@/features/settings/components/UnitSettings"

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
})
