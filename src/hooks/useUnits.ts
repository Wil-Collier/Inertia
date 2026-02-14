import { useSettings } from "@/features/settings/queries"
import { KG_TO_LBS, KM_TO_MI } from "@/lib/constants"
import {
  convertWeight,
  formatWeight,
  parseWeight,
  getDisplayWeight,
  convertDistance,
  formatDistance,
  parseDistance,
  getDisplayDistance,
} from "@/lib/conversions"

// Re-export pure functions so existing imports keep working
export {
  convertWeight,
  formatWeight,
  parseWeight,
  getDisplayWeight,
  convertDistance,
  formatDistance,
  parseDistance,
  getDisplayDistance,
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
