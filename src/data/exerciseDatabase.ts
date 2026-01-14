import type { Exercise, MuscleGroup } from "@/lib/types"
import exercisesData from "./exercises.json"

// Raw exercise from JSON
interface RawExercise {
  name: string
  force: string | null
  level: string
  mechanic: string | null
  equipment: string | null
  primaryMuscles: string[]
  secondaryMuscles: string[]
  instructions: string[]
  category: string
}

// Extended exercise with instructions
export interface ExerciseWithInstructions extends Exercise {
  instructions: string[]
}

// Map the 17 granular muscles from JSON to the app's 7 muscle groups
const muscleGroupMapping: Record<string, MuscleGroup> = {
  // Chest
  chest: "chest",

  // Back
  lats: "back",
  "middle back": "back",
  "lower back": "back",
  traps: "back",

  // Shoulders
  shoulders: "shoulders",
  neck: "shoulders",

  // Arms
  biceps: "arms",
  triceps: "arms",
  forearms: "arms",

  // Legs
  quadriceps: "legs",
  hamstrings: "legs",
  glutes: "legs",
  abductors: "legs",
  adductors: "legs",
  calves: "legs",

  // Core
  abdominals: "core",
}

// Equipment that indicates weighted exercise
const weightedEquipment = new Set([
  "barbell",
  "dumbbell",
  "cable",
  "machine",
  "kettlebells",
  "e-z curl bar",
  "medicine ball",
])

// Specific exercise names that should be time-based
const timeBasedExercisePatterns = [
  "plank",
  "hold",
  "stretch",
  "hang",
  "dead bug",
  "bird dog",
  "running",
  "cycling",
  "rowing",
  "jump rope",
  "jogging",
  "walking",
]

function isTimeBased(exercise: RawExercise): boolean {
  const nameLower = exercise.name.toLowerCase()

  // Check if name matches time-based patterns
  if (timeBasedExercisePatterns.some((pattern) => nameLower.includes(pattern))) {
    return true
  }

  // Cardio category is always time-based
  if (exercise.category === "cardio") {
    return true
  }

  // Stretching with static force is time-based
  if (exercise.category === "stretching" && exercise.force === "static") {
    return true
  }

  return false
}

function isWeighted(exercise: RawExercise): boolean {
  // If it has weighted equipment, it's weighted
  if (exercise.equipment && weightedEquipment.has(exercise.equipment)) {
    return true
  }

  // Body only or no equipment = not weighted
  if (!exercise.equipment || exercise.equipment === "body only") {
    return false
  }

  // Other equipment (bands, foam roll, etc.) - default to not weighted
  return false
}

function getMuscleGroup(primaryMuscles: string[]): MuscleGroup {
  if (primaryMuscles.length === 0) {
    return "core" // Fallback
  }

  const primaryMuscle = primaryMuscles[0].toLowerCase()
  return muscleGroupMapping[primaryMuscle] || "core"
}

// Generate stable exercise ID from name
function generateExerciseId(name: string, index: number): string {
  // Create URL-safe slug from name
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 30)

  return `ex-${index}-${slug}`
}

// Transform raw exercises to app format
const rawExercises = exercisesData.exercises as RawExercise[]

export const exerciseDatabase: ExerciseWithInstructions[] = rawExercises.map(
  (raw, index) => ({
    id: generateExerciseId(raw.name, index),
    name: raw.name,
    muscleGroup: getMuscleGroup(raw.primaryMuscles),
    isCustom: false,
    isWeighted: isWeighted(raw),
    isTimeBased: isTimeBased(raw),
    instructions: raw.instructions,
  })
)

// Create a map for quick lookup by ID
export const exerciseDatabaseMap = new Map(
  exerciseDatabase.map((ex) => [ex.id, ex])
)

// Get instructions for an exercise by ID
export function getExerciseFromDatabase(
  id: string
): ExerciseWithInstructions | undefined {
  return exerciseDatabaseMap.get(id)
}
