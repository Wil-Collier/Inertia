import type { Exercise, MuscleGroup } from "@/lib/types"

interface ExerciseDefinition {
  name: string
  muscleGroup: MuscleGroup
  isWeighted: boolean
  isTimeBased: boolean
}

const defaultExerciseList: ExerciseDefinition[] = [
  // Chest
  { name: "Bench Press", muscleGroup: "chest", isWeighted: true, isTimeBased: false },
  { name: "Incline Bench Press", muscleGroup: "chest", isWeighted: true, isTimeBased: false },
  { name: "Incline Dumbbell Press", muscleGroup: "chest", isWeighted: true, isTimeBased: false },
  { name: "Dumbbell Flyes", muscleGroup: "chest", isWeighted: true, isTimeBased: false },
  { name: "Push-ups", muscleGroup: "chest", isWeighted: false, isTimeBased: false },
  { name: "Cable Crossover", muscleGroup: "chest", isWeighted: true, isTimeBased: false },
  { name: "Pec Deck", muscleGroup: "chest", isWeighted: true, isTimeBased: false },

  // Back
  { name: "Deadlift", muscleGroup: "back", isWeighted: true, isTimeBased: false },
  { name: "Pull-ups", muscleGroup: "back", isWeighted: false, isTimeBased: false },
  { name: "Weighted Pull-ups", muscleGroup: "back", isWeighted: true, isTimeBased: false },
  { name: "Barbell Row", muscleGroup: "back", isWeighted: true, isTimeBased: false },
  { name: "Lat Pulldown", muscleGroup: "back", isWeighted: true, isTimeBased: false },
  { name: "Seated Cable Row", muscleGroup: "back", isWeighted: true, isTimeBased: false },

  // Shoulders
  { name: "Overhead Press", muscleGroup: "shoulders", isWeighted: true, isTimeBased: false },
  { name: "Lateral Raises", muscleGroup: "shoulders", isWeighted: true, isTimeBased: false },
  { name: "Front Raises", muscleGroup: "shoulders", isWeighted: true, isTimeBased: false },
  { name: "Face Pulls", muscleGroup: "shoulders", isWeighted: true, isTimeBased: false },
  { name: "Arnold Press", muscleGroup: "shoulders", isWeighted: true, isTimeBased: false },

  // Arms
  { name: "Barbell Curl", muscleGroup: "arms", isWeighted: true, isTimeBased: false },
  { name: "Hammer Curl", muscleGroup: "arms", isWeighted: true, isTimeBased: false },
  { name: "Tricep Pushdown", muscleGroup: "arms", isWeighted: true, isTimeBased: false },
  { name: "Tricep Rope Pushdown", muscleGroup: "arms", isWeighted: true, isTimeBased: false },
  { name: "Skull Crushers", muscleGroup: "arms", isWeighted: true, isTimeBased: false },
  { name: "Dips", muscleGroup: "arms", isWeighted: false, isTimeBased: false },

  // Legs
  { name: "Squat", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Front Squat", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Goblet Squat", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Leg Press", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Romanian Deadlift", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Leg Curl", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Seated Leg Curl", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Leg Extension", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Standing Calf Raises", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Seated Calf Raises", muscleGroup: "legs", isWeighted: true, isTimeBased: false },
  { name: "Lunges", muscleGroup: "legs", isWeighted: false, isTimeBased: false },
  { name: "Walking Lunges", muscleGroup: "legs", isWeighted: false, isTimeBased: false },

  // Core - time-based exercises
  { name: "Plank", muscleGroup: "core", isWeighted: false, isTimeBased: true },
  { name: "Side Plank", muscleGroup: "core", isWeighted: false, isTimeBased: true },
  { name: "Dead Bug", muscleGroup: "core", isWeighted: false, isTimeBased: true },
  { name: "Bird Dog", muscleGroup: "core", isWeighted: false, isTimeBased: true },
  { name: "Bicycle Crunches", muscleGroup: "core", isWeighted: false, isTimeBased: false },
  { name: "Crunches", muscleGroup: "core", isWeighted: false, isTimeBased: false },
  { name: "Hanging Leg Raise", muscleGroup: "core", isWeighted: false, isTimeBased: false },
  { name: "Russian Twist", muscleGroup: "core", isWeighted: true, isTimeBased: false },
  { name: "Cable Woodchop", muscleGroup: "core", isWeighted: true, isTimeBased: false },

  // Cardio
  { name: "Running", muscleGroup: "cardio", isWeighted: false, isTimeBased: true },
  { name: "Cycling", muscleGroup: "cardio", isWeighted: false, isTimeBased: true },
  { name: "Rowing", muscleGroup: "cardio", isWeighted: false, isTimeBased: true },
  { name: "Jump Rope", muscleGroup: "cardio", isWeighted: false, isTimeBased: true },
]

export const defaultExercises: Exercise[] = defaultExerciseList.map(
  (ex, index) => ({
    id: `default-${index + 1}`,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    isCustom: false,
    isWeighted: ex.isWeighted,
    isTimeBased: ex.isTimeBased,
  })
)

export const muscleGroupLabels: Record<MuscleGroup, string> = {
  chest: "Chest",
  back: "Back",
  shoulders: "Shoulders",
  arms: "Arms",
  legs: "Legs",
  core: "Core",
  cardio: "Cardio",
}

export const muscleGroupColors: Record<MuscleGroup, string> = {
  chest: "bg-red-500",
  back: "bg-blue-500",
  shoulders: "bg-purple-500",
  arms: "bg-orange-500",
  legs: "bg-green-500",
  core: "bg-yellow-500",
  cardio: "bg-pink-500",
}
