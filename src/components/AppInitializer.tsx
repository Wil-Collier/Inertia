import { useEffect, useState, type ReactNode } from "react"
import { PageLoader } from "@/components/ui/PageLoader"
import { useWorkoutStore } from "@/stores/workout"
import { useSettingsStore } from "@/stores/settingsStore"
import { useExerciseStore } from "@/stores/exerciseStore"
import { useNutritionStore } from "@/stores/nutritionStore"
import { useBodyWeightStore } from "@/stores/bodyWeightStore"
import { useAchievementsStore } from "@/stores/achievementsStore"

interface AppInitializerProps {
  children: ReactNode
}

/**
 * Initializes all IndexedDB-backed stores before rendering children.
 * Shows a loading spinner while stores are initializing.
 */
export function AppInitializer({ children }: AppInitializerProps) {
  const [isInitializing, setIsInitializing] = useState(true)

  // Subscribe to all store initialization states
  const settingsInitialized = useSettingsStore((s) => s.isInitialized)
  const exercisesInitialized = useExerciseStore((s) => s.isLoaded)
  const workoutsInitialized = useWorkoutStore((s) => s.isInitialized)
  const nutritionInitialized = useNutritionStore((s) => s.isInitialized)
  const bodyWeightInitialized = useBodyWeightStore((s) => s.isInitialized)
  const achievementsInitialized = useAchievementsStore((s) => s.isInitialized)

  // Trigger initialization on mount
  useEffect(() => {
    Promise.allSettled([
      useSettingsStore.getState().loadSettings(),
      useExerciseStore.getState().init(),
      useWorkoutStore.getState().init(),
      useNutritionStore.getState().init(),
      useBodyWeightStore.getState().init(),
      useAchievementsStore.getState().init(),
    ]).finally(() => {
      setIsInitializing(false)
    })
  }, [])

  // Wait for all stores to be initialized
  const allInitialized =
    settingsInitialized &&
    exercisesInitialized &&
    workoutsInitialized &&
    nutritionInitialized &&
    bodyWeightInitialized &&
    achievementsInitialized

  if (isInitializing) {
    return <PageLoader />
  }

  // If init finished but some stores never flipped their flags (e.g. due to IDB issues),
  // don't deadlock the entire app on the loader.
  if (!allInitialized) {
    return <>{children}</>
  }

  return <>{children}</>
}
