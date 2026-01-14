import type { Exercise } from "@/lib/types"

let exercisesLoaded = false
let loadPromise: Promise<Exercise[]> | null = null

/**
 * Dynamically imports the exercise database.
 * This keeps the 904KB exercises.json out of the main bundle.
 */
export async function loadDefaultExercises(): Promise<Exercise[]> {
  const { exerciseDatabase } = await import("./exerciseDatabase")
  return exerciseDatabase.map((ex) => ({
    id: ex.id,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    isCustom: ex.isCustom,
    isWeighted: ex.isWeighted,
    isTimeBased: ex.isTimeBased,
  }))
}

/**
 * Ensures exercises are loaded into the store.
 * Returns cached promise if already loading.
 */
export function ensureExercisesLoaded(
  setExercises: (exercises: Exercise[]) => void,
  isLoaded: boolean
): Promise<Exercise[]> {
  if (isLoaded && loadPromise) {
    return loadPromise
  }

  if (exercisesLoaded && loadPromise) {
    return loadPromise
  }

  if (loadPromise) {
    return loadPromise
  }

  loadPromise = loadDefaultExercises().then((exercises) => {
    exercisesLoaded = true
    setExercises(exercises)
    return exercises
  })

  return loadPromise
}

/**
 * Check if exercises have been loaded
 */
export function areExercisesLoaded(): boolean {
  return exercisesLoaded
}
