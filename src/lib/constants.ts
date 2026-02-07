// Weight Conversion
export const LBS_TO_KG = 0.453592
export const KG_TO_LBS = 2.20462

// Distance Conversion
export const MI_TO_KM = 1.60934
export const KM_TO_MI = 0.621371

// Nutrition Keys
export const MACROS = {
  CALORIES: "calories",
  PROTEIN: "protein",
  CARBS: "carbs",
  FAT: "fat",
  FIBER: "fiber",
  SUGAR: "sugar",
} as const

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
export const DEFAULT_THEME = "system" as const

// Singleton record IDs
export const ACTIVE_SESSION_ID = "current"
