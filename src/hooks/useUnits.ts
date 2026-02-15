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
import type { DistanceUnit, WeightUnit } from "@/lib/types"

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

type UnitPreferences = { weight: WeightUnit; distance: DistanceUnit }

const DEFAULT_UNIT_PREFERENCES: UnitPreferences = {
  weight: "kg",
  distance: "km",
}

function useUnitPreferences(): UnitPreferences {
  const { data: settings } = useSettings()
  return settings?.unitPreferences ?? DEFAULT_UNIT_PREFERENCES
}

function getWeightUnitHelpers(unit: WeightUnit) {
  return {
    unit,
    unitLabel: unit,
    format: (value: number, options?: { shouldShowUnit?: boolean; decimals?: number }) =>
      formatWeight(value, unit, options),
    parse: (input: string | number) => parseWeight(input, unit),
    toDisplay: (stored: number) => getDisplayWeight(stored, unit),
    toStorage: (display: number) => (unit === "kg" ? display * KG_TO_LBS : display),
  }
}

function getDistanceUnitHelpers(unit: DistanceUnit) {
  return {
    unit,
    unitLabel: unit,
    format: (value: number, options?: { shouldShowUnit?: boolean; decimals?: number }) =>
      formatDistance(value, unit, options),
    parse: (input: string | number) => parseDistance(input, unit),
    toDisplay: (stored: number) => getDisplayDistance(stored, unit),
    toStorage: (display: number) => (unit === "km" ? display * KM_TO_MI : display),
  }
}

export function useWeightUnit() {
  const unitPreferences = useUnitPreferences()
  return getWeightUnitHelpers(unitPreferences.weight)
}

export function useUnits() {
  const unitPreferences = useUnitPreferences()

  return {
    weightUnit: unitPreferences.weight,
    distanceUnit: unitPreferences.distance,
    weight: getWeightUnitHelpers(unitPreferences.weight),
    distance: getDistanceUnitHelpers(unitPreferences.distance),
  }
}
