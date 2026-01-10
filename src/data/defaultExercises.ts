import type { Exercise, MuscleGroup } from "@/lib/types"

interface ExerciseDefinition {
  name: string
  muscleGroup: MuscleGroup
}

const defaultExerciseList: ExerciseDefinition[] = [
  // Chest
  { name: "Bench Press", muscleGroup: "chest" },
  { name: "Incline Bench Press", muscleGroup: "chest" },
  { name: "Incline Dumbbell Press", muscleGroup: "chest" },
  { name: "Dumbbell Flyes", muscleGroup: "chest" },
  { name: "Push-ups", muscleGroup: "chest" },
  { name: "Cable Crossover", muscleGroup: "chest" },
  { name: "Pec Deck", muscleGroup: "chest" },

  // Back
  { name: "Deadlift", muscleGroup: "back" },
  { name: "Pull-ups", muscleGroup: "back" },
  { name: "Weighted Pull-ups", muscleGroup: "back" },
  { name: "Barbell Row", muscleGroup: "back" },
  { name: "Lat Pulldown", muscleGroup: "back" },
  { name: "Seated Cable Row", muscleGroup: "back" },

  // Shoulders
  { name: "Overhead Press", muscleGroup: "shoulders" },
  { name: "Lateral Raises", muscleGroup: "shoulders" },
  { name: "Front Raises", muscleGroup: "shoulders" },
  { name: "Face Pulls", muscleGroup: "shoulders" },
  { name: "Arnold Press", muscleGroup: "shoulders" },

  // Arms
  { name: "Barbell Curl", muscleGroup: "arms" },
  { name: "Hammer Curl", muscleGroup: "arms" },
  { name: "Tricep Pushdown", muscleGroup: "arms" },
  { name: "Tricep Rope Pushdown", muscleGroup: "arms" },
  { name: "Skull Crushers", muscleGroup: "arms" },
  { name: "Dips", muscleGroup: "arms" },

  // Legs
  { name: "Squat", muscleGroup: "legs" },
  { name: "Front Squat", muscleGroup: "legs" },
  { name: "Goblet Squat", muscleGroup: "legs" },
  { name: "Leg Press", muscleGroup: "legs" },
  { name: "Romanian Deadlift", muscleGroup: "legs" },
  { name: "Leg Curl", muscleGroup: "legs" },
  { name: "Seated Leg Curl", muscleGroup: "legs" },
  { name: "Leg Extension", muscleGroup: "legs" },
  { name: "Standing Calf Raises", muscleGroup: "legs" },
  { name: "Seated Calf Raises", muscleGroup: "legs" },
  { name: "Lunges", muscleGroup: "legs" },
  { name: "Walking Lunges", muscleGroup: "legs" },

  // Core
  { name: "Plank", muscleGroup: "core" },
  { name: "Side Plank", muscleGroup: "core" },
  { name: "Dead Bug", muscleGroup: "core" },
  { name: "Bird Dog", muscleGroup: "core" },
  { name: "Bicycle Crunches", muscleGroup: "core" },
  { name: "Crunches", muscleGroup: "core" },
  { name: "Hanging Leg Raise", muscleGroup: "core" },
  { name: "Russian Twist", muscleGroup: "core" },
  { name: "Cable Woodchop", muscleGroup: "core" },

  // Cardio
  { name: "Running", muscleGroup: "cardio" },
  { name: "Cycling", muscleGroup: "cardio" },
  { name: "Rowing", muscleGroup: "cardio" },
  { name: "Jump Rope", muscleGroup: "cardio" },
]

export const defaultExercises: Exercise[] = defaultExerciseList.map(
  (ex, index) => ({
    id: `default-${index + 1}`,
    name: ex.name,
    muscleGroup: ex.muscleGroup,
    isCustom: false,
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
