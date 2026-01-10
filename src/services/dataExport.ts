import { useExerciseStore } from "@/stores/exerciseStore"
import { useWorkoutStore } from "@/stores/workoutStore"
import { useNutritionStore } from "@/stores/nutritionStore"
import { useSettingsStore } from "@/stores/settingsStore"

interface ExportData {
  version: number
  exportedAt: string
  exercises: ReturnType<typeof useExerciseStore.getState>["exercises"]
  workouts: ReturnType<typeof useWorkoutStore.getState>["workouts"]
  templates: ReturnType<typeof useWorkoutStore.getState>["templates"]
  personalRecords: ReturnType<typeof useWorkoutStore.getState>["personalRecords"]
  foods: ReturnType<typeof useNutritionStore.getState>["foods"]
  dailyLogs: ReturnType<typeof useNutritionStore.getState>["dailyLogs"]
  mealTemplates: ReturnType<typeof useNutritionStore.getState>["mealTemplates"]
  settings: ReturnType<typeof useSettingsStore.getState>["settings"]
}

export function exportAllData(): string {
  const exerciseState = useExerciseStore.getState()
  const workoutState = useWorkoutStore.getState()
  const nutritionState = useNutritionStore.getState()
  const settingsState = useSettingsStore.getState()

  const data: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    exercises: exerciseState.exercises,
    workouts: workoutState.workouts,
    templates: workoutState.templates,
    personalRecords: workoutState.personalRecords,
    foods: nutritionState.foods,
    dailyLogs: nutritionState.dailyLogs,
    mealTemplates: nutritionState.mealTemplates,
    settings: settingsState.settings,
  }

  return JSON.stringify(data, null, 2)
}

export function downloadExport(): void {
  const data = exportAllData()
  const blob = new Blob([data], { type: "application/json" })
  const url = URL.createObjectURL(blob)

  const a = document.createElement("a")
  a.href = url
  a.download = `training-app-backup-${new Date().toISOString().split("T")[0]}.json`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

export async function importData(file: File): Promise<{ success: boolean; message: string }> {
  try {
    const text = await file.text()
    const data: ExportData = JSON.parse(text)

    // Validate version
    if (typeof data.version !== "number") {
      return { success: false, message: "Invalid backup file format" }
    }

    // Import data into stores
    if (data.exercises) {
      useExerciseStore.setState({ exercises: data.exercises })
    }

    if (data.workouts || data.templates || data.personalRecords) {
      useWorkoutStore.setState({
        workouts: data.workouts || [],
        templates: data.templates || [],
        personalRecords: data.personalRecords || {},
      })
    }

    if (data.foods || data.dailyLogs || data.mealTemplates) {
      useNutritionStore.setState({
        foods: data.foods || [],
        dailyLogs: data.dailyLogs || [],
        mealTemplates: data.mealTemplates || [],
      })
    }

    if (data.settings) {
      useSettingsStore.setState({ settings: data.settings })
    }

    return { success: true, message: "Data imported successfully" }
  } catch (error) {
    console.error("Import error:", error)
    return { success: false, message: "Failed to parse backup file" }
  }
}

export function clearAllData(): void {
  // Clear localStorage
  localStorage.removeItem("training-app-exercises")
  localStorage.removeItem("training-app-workouts")
  localStorage.removeItem("training-app-nutrition")
  localStorage.removeItem("training-app-settings")

  // Reset stores to defaults
  useExerciseStore.getState().resetToDefaults()
  useSettingsStore.getState().resetSettings()
  useWorkoutStore.setState({
    workouts: [],
    templates: [],
    activeSession: null,
    personalRecords: {},
  })
  useNutritionStore.setState({
    foods: [],
    dailyLogs: [],
    mealTemplates: [],
  })
}
