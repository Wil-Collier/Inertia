// Weight Conversion (exact reciprocals)
export const LBS_TO_KG = 0.45359237
export const KG_TO_LBS = 1 / LBS_TO_KG

// Distance Conversion (exact reciprocals)
export const MI_TO_KM = 1.609344
export const KM_TO_MI = 1 / MI_TO_KM

// Default Settings
export const DEFAULT_UNIT_PREFERENCES = { weight: "kg", distance: "km" } as const
export const DEFAULT_NUTRITION_GOALS = { 
  calories: 2000, 
  protein: 150, 
  carbs: 250, 
  fat: 65, 
  fiber: 30, 
  sugar: 50 
} as const
export const DEFAULT_REST_TIMER_DURATION = 90
export const DEFAULT_PROGRESSIVE_OVERLOAD_ENABLED = true
export const DEFAULT_THEME = "system" as const

// Singleton record IDs
export const ACTIVE_SESSION_ID = "current"
