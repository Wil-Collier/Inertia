import { useSettings } from "@/features/settings/queries"
import type { WeightUnit, DistanceUnit } from "@/lib/types"
import { LBS_TO_KG, KG_TO_LBS, MI_TO_KM, KM_TO_MI } from "@/lib/constants"

// ============================================
// Weight Conversions (stored internally as lbs)
// ============================================

export function convertWeight(
  weight: number,
  from: WeightUnit,
  to: WeightUnit
): number {
  if (from === to) return weight
  if (from === "lbs" && to === "kg") return weight * LBS_TO_KG
  if (from === "kg" && to === "lbs") return weight * KG_TO_LBS
  return weight
}

export function formatWeight(
  weight: number,
  displayUnit: WeightUnit,
  options?: { shouldShowUnit?: boolean; decimals?: number }
): string {
  const { shouldShowUnit = true, decimals = 1 } = options ?? {}
  const converted = displayUnit === "kg" ? weight * LBS_TO_KG : weight
  const rounded =
    decimals === 0
      ? Math.round(converted)
      : parseFloat(converted.toFixed(decimals))

  if (shouldShowUnit) {
    return `${rounded} ${displayUnit}`
  }
  return String(rounded)
}

export function parseWeight(input: string | number, inputUnit: WeightUnit): number {
  const value = typeof input === "string" ? parseFloat(input) || 0 : input
  return inputUnit === "kg" ? value * KG_TO_LBS : value
}

export function getDisplayWeight(storedWeight: number, displayUnit: WeightUnit): number {
  if (displayUnit === "kg") {
    return parseFloat((storedWeight * LBS_TO_KG).toFixed(1))
  }
  return storedWeight
}

// ============================================
// Distance Conversions (stored internally as miles)
// ============================================

export function convertDistance(
  distance: number,
  from: DistanceUnit,
  to: DistanceUnit
): number {
  if (from === to) return distance
  if (from === "mi" && to === "km") return distance * MI_TO_KM
  if (from === "km" && to === "mi") return distance * KM_TO_MI
  return distance
}

export function formatDistance(
  distance: number,
  displayUnit: DistanceUnit,
  options?: { shouldShowUnit?: boolean; decimals?: number }
): string {
  const { shouldShowUnit = true, decimals = 2 } = options ?? {}
  const converted = displayUnit === "km" ? distance * MI_TO_KM : distance
  const rounded =
    decimals === 0
      ? Math.round(converted)
      : parseFloat(converted.toFixed(decimals))

  if (shouldShowUnit) {
    return `${rounded} ${displayUnit}`
  }
  return String(rounded)
}

export function parseDistance(input: string | number, inputUnit: DistanceUnit): number {
  const value = typeof input === "string" ? parseFloat(input) || 0 : input
  return inputUnit === "km" ? value * KM_TO_MI : value
}

export function getDisplayDistance(storedDistance: number, displayUnit: DistanceUnit): number {
  if (displayUnit === "km") {
    return parseFloat((storedDistance * MI_TO_KM).toFixed(2))
  }
  return storedDistance
}

// ============================================
// Hook for all unit preferences
// ============================================

export function useUnits() {
  const { data: settings } = useSettings()
  const unitPreferences = settings?.unitPreferences ?? { weight: "kg", distance: "km" }

  return {
    // Current unit preferences
    weightUnit: unitPreferences.weight,
    distanceUnit: unitPreferences.distance,

    // Weight utilities
    weight: {
      unit: unitPreferences.weight,
      unitLabel: unitPreferences.weight,
      format: (value: number, options?: { shouldShowUnit?: boolean; decimals?: number }) =>
        formatWeight(value, unitPreferences.weight, options),
      parse: (input: string | number) => parseWeight(input, unitPreferences.weight),
      toDisplay: (stored: number) => getDisplayWeight(stored, unitPreferences.weight),
      toStorage: (display: number) =>
        unitPreferences.weight === "kg" ? display * KG_TO_LBS : display,
    },

    // Distance utilities
    distance: {
      unit: unitPreferences.distance,
      unitLabel: unitPreferences.distance,
      format: (value: number, options?: { shouldShowUnit?: boolean; decimals?: number }) =>
        formatDistance(value, unitPreferences.distance, options),
      parse: (input: string | number) => parseDistance(input, unitPreferences.distance),
      toDisplay: (stored: number) => getDisplayDistance(stored, unitPreferences.distance),
      toStorage: (display: number) =>
        unitPreferences.distance === "km" ? display * KM_TO_MI : display,
    },
  }
}
