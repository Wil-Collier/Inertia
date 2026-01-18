import { useSettingsStore } from "@/stores/settingsStore"
import type { WeightUnit } from "@/lib/types"
import { LBS_TO_KG, KG_TO_LBS } from "@/lib/constants"

/**
 * Convert weight between units
 * All weights are stored in lbs internally
 */
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

/**
 * Format weight for display with rounding
 * Stored weights are in lbs, converts to display unit
 */
export function formatWeight(
  weight: number,
  displayUnit: WeightUnit,
  options?: { shouldShowUnit?: boolean; decimals?: number }
): string {
  const { shouldShowUnit = true, decimals = 1 } = options ?? {}

  // Convert from internal lbs to display unit
  const converted = displayUnit === "kg" ? weight * LBS_TO_KG : weight

  // Round to specified decimals, but remove trailing zeros
  const rounded =
    decimals === 0
      ? Math.round(converted)
      : parseFloat(converted.toFixed(decimals))

  if (shouldShowUnit) {
    return `${rounded} ${displayUnit}`
  }
  return String(rounded)
}

/**
 * Parse user input weight to internal storage (lbs)
 * User enters in their preferred unit, we convert to lbs for storage
 */
export function parseWeight(input: string | number, inputUnit: WeightUnit): number {
  const value = typeof input === "string" ? parseFloat(input) || 0 : input
  // Convert from input unit to lbs for storage
  return inputUnit === "kg" ? value * KG_TO_LBS : value
}

/**
 * Get display value for an input field
 * Converts stored lbs to display unit for editing
 */
export function getDisplayWeight(storedWeight: number, displayUnit: WeightUnit): number {
  if (displayUnit === "kg") {
    // Round to 1 decimal for cleaner input display
    return parseFloat((storedWeight * LBS_TO_KG).toFixed(1))
  }
  return storedWeight
}

/**
 * Hook for weight unit preferences and conversions
 * Uses unitPreferences.weight from settings
 */
export function useWeightUnit() {
  const unit = useSettingsStore((s) => s.settings.unitPreferences.weight)

  return {
    /** Current weight unit preference */
    unit,

    /** Unit label for display (e.g., "lbs" or "kg") */
    unitLabel: unit,

    /**
     * Format a stored weight (in lbs) for display
     */
    format: (weight: number, options?: { shouldShowUnit?: boolean; decimals?: number }) =>
      formatWeight(weight, unit, options),

    /**
     * Parse user input to storage format (lbs)
     */
    parse: (input: string | number) => parseWeight(input, unit),

    /**
     * Get display value for input fields
     */
    toDisplay: (storedWeight: number) => getDisplayWeight(storedWeight, unit),

    /**
     * Convert display value back to storage (lbs)
     */
    toStorage: (displayWeight: number) =>
      unit === "kg" ? displayWeight * KG_TO_LBS : displayWeight,
  }
}

