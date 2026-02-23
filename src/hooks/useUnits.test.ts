import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"
import {
  convertDistance,
  convertWeight,
  formatDistance,
  formatWeight,
  getDisplayDistance,
  getDisplayWeight,
  parseDistance,
  parseWeight,
  useWeightUnit,
  useUnits,
} from "@/hooks/useUnits"
import { db } from "@/services/db"
import { clearDatabase } from "@/test/helpers/dbTestUtils"
import { createQueryWrapper, createTestQueryClient } from "@/test/helpers/queryHookTestUtils"

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

  describe("useUnits hook", () => {
    beforeEach(async () => {
      await clearDatabase()
    })

    it("returns sane default unit preferences when settings are missing", async () => {
      const queryClient = createTestQueryClient()
      const wrapper = createQueryWrapper(queryClient)

      const { result } = renderHook(() => useUnits(), { wrapper })

      await waitFor(() => expect(result.current.weightUnit).toBe("kg"))

      expect(result.current.distanceUnit).toBe("km")
      expect(result.current.weight.format(220.462)).toBe("100 kg")
      expect(result.current.distance.format(3.10686)).toBe("5 km")
    })

    it("uses persisted unit preferences for formatting and parsing", async () => {
      await db.settings.put({
        id: "settings",
        theme: "system",
        restTimerDuration: 90,
        progressiveOverloadEnabled: true,
        areNotificationsEnabled: false,
        unitPreferences: { weight: "lbs", distance: "mi" },
        nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
      })

      const queryClient = createTestQueryClient()
      const wrapper = createQueryWrapper(queryClient)

      const { result } = renderHook(() => useUnits(), { wrapper })

      await waitFor(() => expect(result.current.weightUnit).toBe("lbs"))

      expect(result.current.distanceUnit).toBe("mi")

      expect(result.current.weight.toDisplay(185)).toBe(185)
      expect(result.current.weight.toStorage(185)).toBe(185)
      expect(result.current.weight.parse("185")).toBe(185)

      expect(result.current.distance.toDisplay(3.1)).toBe(3.1)
      expect(result.current.distance.toStorage(3.1)).toBe(3.1)
      expect(result.current.distance.parse("3.1")).toBe(3.1)
    })

    it("exposes weight-only helpers through useWeightUnit", async () => {
      await db.settings.put({
        id: "settings",
        theme: "system",
        restTimerDuration: 90,
        progressiveOverloadEnabled: true,
        areNotificationsEnabled: false,
        unitPreferences: { weight: "lbs", distance: "km" },
        nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
      })

      const queryClient = createTestQueryClient()
      const wrapper = createQueryWrapper(queryClient)

      const { result } = renderHook(() => useWeightUnit(), { wrapper })

      await waitFor(() => expect(result.current.unit).toBe("lbs"))

      expect(result.current.unitLabel).toBe("lbs")
      expect(result.current.format(185)).toBe("185 lbs")
      expect(result.current.parse("185")).toBe(185)
    })

    it("reflects updated unit preferences after settings change", async () => {
      await db.settings.put({
        id: "settings",
        theme: "system",
        restTimerDuration: 90,
        progressiveOverloadEnabled: true,
        areNotificationsEnabled: false,
        unitPreferences: { weight: "kg", distance: "km" },
        nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
      })

      const queryClient = createTestQueryClient()
      const wrapper = createQueryWrapper(queryClient)

      const { result } = renderHook(() => useUnits(), { wrapper })

      await waitFor(() => expect(result.current.weightUnit).toBe("kg"))

      // Update settings in DB and invalidate query
      await db.settings.put({
        id: "settings",
        theme: "system",
        restTimerDuration: 90,
        progressiveOverloadEnabled: true,
        areNotificationsEnabled: false,
        unitPreferences: { weight: "lbs", distance: "mi" },
        nutritionGoals: { calories: 2000, protein: 150, carbs: 250, fat: 65, fiber: 30, sugar: 50 },
      })

      act(() => {
        void queryClient.invalidateQueries()
      })

      await waitFor(() => expect(result.current.weightUnit).toBe("lbs"))
      expect(result.current.distanceUnit).toBe("mi")
    })
  })
})
