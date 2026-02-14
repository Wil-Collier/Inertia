import { useSettings } from "@/features/settings/queries"
import { KG_TO_LBS } from "@/lib/constants"
import {
  convertWeight,
  formatWeight,
  parseWeight,
  getDisplayWeight,
} from "@/lib/conversions"

// Re-export pure functions so existing imports keep working
export { convertWeight, formatWeight, parseWeight, getDisplayWeight }

/**
 * Hook for weight unit preferences and conversions
 * Uses unitPreferences.weight from settings
 */
export function useWeightUnit() {
  const { data: settings } = useSettings()
  const unit = settings?.unitPreferences.weight ?? "kg"

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
