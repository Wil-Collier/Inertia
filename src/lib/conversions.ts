import type { WeightUnit, DistanceUnit } from "@/lib/types"
import { LBS_TO_KG, KG_TO_LBS, MI_TO_KM, KM_TO_MI } from "@/lib/constants"

// ============================================
// Weight Conversions (stored internally as lbs)
// ============================================

/**
 * Convert a weight value from one unit to another.
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
 * Convert a weight in the recording unit to lbs (the internal storage unit).
 */
export function toLbs(weight: number, unit: WeightUnit): number {
  return unit === "kg" ? weight * KG_TO_LBS : weight
}

/**
 * Format a stored weight (in lbs) for display in the user's preferred unit.
 */
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

/**
 * Parse user input weight to internal storage (lbs).
 * User enters in their preferred unit, we convert to lbs for storage.
 */
export function parseWeight(input: string | number, inputUnit: WeightUnit): number {
  const value = typeof input === "string" ? parseFloat(input) || 0 : input
  return inputUnit === "kg" ? value * KG_TO_LBS : value
}

/**
 * Get display value for an input field.
 * Converts stored lbs to display unit for editing.
 */
export function getDisplayWeight(storedWeight: number, displayUnit: WeightUnit): number {
  if (displayUnit === "kg") {
    return parseFloat((storedWeight * LBS_TO_KG).toFixed(1))
  }
  return storedWeight
}

// ============================================
// Distance Conversions (stored internally as miles)
// ============================================

/**
 * Convert a distance value from one unit to another.
 */
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

/**
 * Format a stored distance (in miles) for display in the user's preferred unit.
 */
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

/**
 * Parse user input distance to internal storage (miles).
 */
export function parseDistance(input: string | number, inputUnit: DistanceUnit): number {
  const value = typeof input === "string" ? parseFloat(input) || 0 : input
  return inputUnit === "km" ? value * KM_TO_MI : value
}

/**
 * Get display value for a stored distance.
 */
export function getDisplayDistance(storedDistance: number, displayUnit: DistanceUnit): number {
  if (displayUnit === "km") {
    return parseFloat((storedDistance * MI_TO_KM).toFixed(2))
  }
  return storedDistance
}
