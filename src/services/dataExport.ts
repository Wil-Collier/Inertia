import { useExerciseStore } from "@/stores/exerciseStore"
import { useWorkoutStore } from "@/stores/workout"
import { useNutritionStore } from "@/stores/nutritionStore"
import { useSettingsStore } from "@/stores/settingsStore"
import { useBodyWeightStore } from "@/stores/bodyWeightStore"
import { useAchievementsStore } from "@/stores/achievementsStore"
import { useRestTimerStore } from "@/stores/restTimerStore"
import { defaultTemplates } from "@/data/defaultTemplates"

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
  bodyWeight?: {
    entries: ReturnType<typeof useBodyWeightStore.getState>["entries"]
  }
  achievements?: {
    unlockedAchievements: ReturnType<typeof useAchievementsStore.getState>["unlockedAchievements"]
    streaks: ReturnType<typeof useAchievementsStore.getState>["streaks"]
  }
}

export function exportAllData(): string {
  const exerciseState = useExerciseStore.getState()
  const workoutState = useWorkoutStore.getState()
  const nutritionState = useNutritionStore.getState()
  const settingsState = useSettingsStore.getState()
  const bodyWeightState = useBodyWeightStore.getState()
  const achievementState = useAchievementsStore.getState()

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
    bodyWeight: {
      entries: bodyWeightState.entries,
    },
    achievements: {
      unlockedAchievements: achievementState.unlockedAchievements,
      streaks: achievementState.streaks,
    },
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
        templates: data.templates || defaultTemplates,
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

    if (data.bodyWeight) {
      useBodyWeightStore.setState({
        entries: data.bodyWeight.entries || [],
      })
      // Handle legacy preferredUnit by migrating to settings
      if ((data.bodyWeight as { preferredUnit?: string }).preferredUnit) {
        const legacyUnit = (data.bodyWeight as { preferredUnit?: string }).preferredUnit
        if (legacyUnit === "lbs" || legacyUnit === "kg") {
          useSettingsStore.setState((state) => ({
            settings: { ...state.settings, weightUnit: legacyUnit }
          }))
        }
      }
    }

    if (data.achievements) {
      useAchievementsStore.setState({
        unlockedAchievements: data.achievements.unlockedAchievements || [],
        streaks: data.achievements.streaks || {
          currentWorkoutStreak: 0,
          longestWorkoutStreak: 0,
          lastWorkoutDate: null,
          currentNutritionStreak: 0,
          longestNutritionStreak: 0,
          lastNutritionDate: null,
        },
      })
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
  localStorage.removeItem("training-app-bodyweight")
  localStorage.removeItem("training-app-achievements")

  // Reset stores to defaults
  useExerciseStore.getState().resetToDefaults()
  useSettingsStore.getState().resetSettings()
  useWorkoutStore.setState({
    workouts: [],
    templates: defaultTemplates,
    activeSession: null,
    personalRecords: {},
  })
  useNutritionStore.setState({
    foods: [],
    dailyLogs: [],
    mealTemplates: [],
  })
  useBodyWeightStore.setState({
    entries: [],
  })
  useAchievementsStore.setState({
    unlockedAchievements: [],
    streaks: {
      currentWorkoutStreak: 0,
      longestWorkoutStreak: 0,
      lastWorkoutDate: null,
      currentNutritionStreak: 0,
      longestNutritionStreak: 0,
      lastNutritionDate: null,
    },
  })
  useRestTimerStore.getState().reset()
}
