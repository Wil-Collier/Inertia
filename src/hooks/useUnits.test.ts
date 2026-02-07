import { renderHook } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  convertDistance,
  convertWeight,
  formatDistance,
  formatWeight,
  getDisplayDistance,
  getDisplayWeight,
  parseDistance,
  parseWeight,
  useUnits,
} from "@/hooks/useUnits"
import type { UserSettings } from "@/lib/types"

let mockSettings: UserSettings | undefined

vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({ data: mockSettings }),
}))

describe("useUnits utilities", () => {
  it("converts weight and distance symmetrically", () => {
    const pounds = 200
    const kg = convertWeight(pounds, "lbs", "kg")
    const poundsRoundTrip = convertWeight(kg, "kg", "lbs")
    expect(poundsRoundTrip).toBeCloseTo(pounds, 3)

    const miles = 3.1
    const km = convertDistance(miles, "mi", "km")
    const milesRoundTrip = convertDistance(km, "km", "mi")
    expect(milesRoundTrip).toBeCloseTo(miles, 4)
  })

  it("formats and parses values using expected defaults", () => {
    expect(formatWeight(225, "lbs")).toBe("225 lbs")
    expect(formatDistance(1, "km", { decimals: 2 })).toBe("1.61 km")

    expect(parseWeight("100", "kg")).toBeCloseTo(220.462, 3)
    expect(parseWeight("not-a-number", "kg")).toBe(0)

    expect(parseDistance("5", "km")).toBeCloseTo(3.10686, 4)
    expect(parseDistance("not-a-number", "km")).toBe(0)

    expect(getDisplayWeight(220.462, "kg")).toBe(100)
    expect(getDisplayDistance(3.10686, "km")).toBe(5)
  })

  it("returns sane default unit preferences when settings are missing", () => {
    mockSettings = undefined

    const { result } = renderHook(() => useUnits())
    const units = result.current

    expect(units.weightUnit).toBe("kg")
    expect(units.distanceUnit).toBe("km")
    expect(units.weight.format(220.462)).toBe("100 kg")
    expect(units.distance.format(3.10686)).toBe("5 km")
  })

  it("uses persisted unit preferences for formatting and parsing", () => {
    mockSettings = {
      theme: "system",
      restTimerDuration: 90,
      areNotificationsEnabled: false,
      unitPreferences: { weight: "lbs", distance: "mi" },
      nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
    }

    const { result } = renderHook(() => useUnits())
    const units = result.current

    expect(units.weightUnit).toBe("lbs")
    expect(units.distanceUnit).toBe("mi")

    expect(units.weight.toDisplay(185)).toBe(185)
    expect(units.weight.toStorage(185)).toBe(185)
    expect(units.weight.parse("185")).toBe(185)

    expect(units.distance.toDisplay(3.1)).toBe(3.1)
    expect(units.distance.toStorage(3.1)).toBe(3.1)
    expect(units.distance.parse("3.1")).toBe(3.1)
  })
})
