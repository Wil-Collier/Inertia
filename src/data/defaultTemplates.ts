import type { WorkoutTemplate } from "@/lib/types"
import { defaultExercises } from "./defaultExercises"

// Helper to find exercise ID by name
function getExerciseId(name: string): string {
  const exercise = defaultExercises.find(
    (e) => e.name.toLowerCase() === name.toLowerCase()
  )
  if (!exercise) {
    console.warn(`Exercise not found: ${name}`)
    return ""
  }
  return exercise.id
}

// Templates based on the PHUL (Power Hypertrophy Upper Lower) training plan
export const defaultTemplates: WorkoutTemplate[] = [
  {
    id: "template-upper-power",
    name: "Upper Body Power (Tuesday)",
    exercises: [
      { exerciseId: getExerciseId("Bench Press"), targetSets: 4, targetReps: 4 },
      { exerciseId: getExerciseId("Barbell Row"), targetSets: 4, targetReps: 4 },
      { exerciseId: getExerciseId("Overhead Press"), targetSets: 3, targetReps: 6 },
      { exerciseId: getExerciseId("Weighted Pull-ups"), targetSets: 3, targetReps: 6 },
      { exerciseId: getExerciseId("Skull Crushers"), targetSets: 3, targetReps: 9 },
      { exerciseId: getExerciseId("Barbell Curl"), targetSets: 3, targetReps: 9 },
    ],
  },
  {
    id: "template-lower-power",
    name: "Lower Body Power (Wednesday)",
    exercises: [
      { exerciseId: getExerciseId("Squat"), targetSets: 4, targetReps: 4 },
      { exerciseId: getExerciseId("Deadlift"), targetSets: 3, targetReps: 4 },
      { exerciseId: getExerciseId("Leg Press"), targetSets: 3, targetReps: 11 },
      { exerciseId: getExerciseId("Standing Calf Raises"), targetSets: 4, targetReps: 9 },
    ],
  },
  {
    id: "template-upper-hypertrophy",
    name: "Upper Body Hypertrophy (Thursday)",
    exercises: [
      { exerciseId: getExerciseId("Incline Dumbbell Press"), targetSets: 4, targetReps: 10 },
      { exerciseId: getExerciseId("Lat Pulldown"), targetSets: 4, targetReps: 10 },
      { exerciseId: getExerciseId("Seated Cable Row"), targetSets: 3, targetReps: 11 },
      { exerciseId: getExerciseId("Lateral Raises"), targetSets: 4, targetReps: 13 },
      { exerciseId: getExerciseId("Pec Deck"), targetSets: 3, targetReps: 13 },
      { exerciseId: getExerciseId("Tricep Rope Pushdown"), targetSets: 3, targetReps: 11 },
      { exerciseId: getExerciseId("Hammer Curl"), targetSets: 3, targetReps: 11 },
    ],
  },
  {
    id: "template-lower-hypertrophy",
    name: "Lower Body Hypertrophy (Friday)",
    exercises: [
      { exerciseId: getExerciseId("Front Squat"), targetSets: 3, targetReps: 10 },
      { exerciseId: getExerciseId("Romanian Deadlift"), targetSets: 3, targetReps: 10 },
      { exerciseId: getExerciseId("Walking Lunges"), targetSets: 3, targetReps: 12 },
      { exerciseId: getExerciseId("Leg Extension"), targetSets: 3, targetReps: 17 },
      { exerciseId: getExerciseId("Seated Leg Curl"), targetSets: 3, targetReps: 13 },
      { exerciseId: getExerciseId("Seated Calf Raises"), targetSets: 3, targetReps: 17 },
    ],
  },
  {
    id: "template-daily-core",
    name: "Daily Core Circuit",
    exercises: [
      { exerciseId: getExerciseId("Dead Bug"), targetSets: 1, targetReps: 60 }, // 60 seconds
      { exerciseId: getExerciseId("Plank"), targetSets: 1, targetReps: 60 }, // 60 seconds
      { exerciseId: getExerciseId("Bird Dog"), targetSets: 1, targetReps: 10 }, // 10 per side
      { exerciseId: getExerciseId("Bicycle Crunches"), targetSets: 1, targetReps: 45 }, // 45 seconds
      { exerciseId: getExerciseId("Side Plank"), targetSets: 2, targetReps: 30 }, // 30 seconds per side
    ],
  },
]
