import { renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { convertWeight, formatWeight, getDisplayWeight, parseWeight, useWeightUnit } from "@/hooks/useUnits"

let settingsWeight: "kg" | "lbs" = "kg"
let hasSettings = true

vi.mock("@/features/settings/queries", () => ({
  useSettings: () => ({
    data: hasSettings
      ? {
          unitPreferences: {
            weight: settingsWeight,
            distance: "km",
          },
        }
      : undefined,
  }),
}))

describe("useWeightUnit", () => {
  beforeEach(() => {
    settingsWeight = "kg"
    hasSettings = true
  })

  it("converts and parses weights correctly", () => {
    const kg = convertWeight(220.462, "lbs", "kg")
    expect(kg).toBeCloseTo(100, 3)
    expect(convertWeight(kg, "kg", "lbs")).toBeCloseTo(220.462, 3)

    expect(formatWeight(220.462, "kg", { shouldShowUnit: true, decimals: 1 })).toBe("100 kg")
    expect(parseWeight("100", "kg")).toBeCloseTo(220.462, 3)
    expect(getDisplayWeight(220.462, "kg")).toBe(100)
  })

  it("uses settings weight preference in hook output", () => {
    hasSettings = true
    settingsWeight = "lbs"
    const { result } = renderHook(() => useWeightUnit())

    expect(result.current.unit).toBe("lbs")
    expect(result.current.unitLabel).toBe("lbs")
    expect(result.current.format(185)).toBe("185 lbs")
    expect(result.current.parse("185")).toBe(185)
    expect(result.current.toDisplay(185)).toBe(185)
    expect(result.current.toStorage(185)).toBe(185)
  })

  it("defaults to kg when settings are absent", () => {
    hasSettings = false
    settingsWeight = "kg"
    const { result } = renderHook(() => useWeightUnit())

    expect(result.current.unit).toBe("kg")
    expect(result.current.format(220.462)).toBe("100 kg")
    expect(result.current.parse("100")).toBeCloseTo(220.462, 3)
  })
})
