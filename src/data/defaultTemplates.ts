import type { WorkoutTemplate } from "@/lib/types"

// Pre-computed exercise IDs from the exercise database
// These IDs are generated from: `ex-${index}-${slug}`
// where slug is the exercise name lowercased, special chars replaced with hyphens
const exerciseIds = {
  "Bench Press": "ex-43-barbell-bench-press-medium-gri",
  "Barbell Row": "ex-79-bent-over-barbell-row",
  "Overhead Press": "ex-771-standing-military-press",
  "Weighted Pull-ups": "ex-850-weighted-pull-ups",
  "Skull Crushers": "ex-253-ez-bar-skullcrusher",
  "Barbell Curl": "ex-44-barbell-curl",
  "Squat": "ex-47-barbell-full-squat",
  "Deadlift": "ex-46-barbell-deadlift",
  "Leg Press": "ex-411-leg-press",
  "Standing Calf Raises": "ex-751-standing-calf-raises",
  "Incline Dumbbell Press": "ex-343-incline-dumbbell-press",
  "Lat Pulldown": "ex-175-close-grip-front-lat-pulldown",
  "Seated Cable Row": "ex-625-seated-cable-rows",
  "Lateral Raises": "ex-664-side-lateral-raise",
  "Pec Deck": "ex-108-butterfly",
  "Tricep Rope Pushdown": "ex-824-triceps-pushdown",
  "Hammer Curl": "ex-9-alternate-hammer-curl",
  "Front Squat": "ex-294-front-squat-clean-grip",
  "Romanian Deadlift": "ex-603-romanian-deadlift",
  "Walking Lunges": "ex-95-bodyweight-walking-lunge",
  "Leg Extension": "ex-409-leg-extensions",
  "Seated Leg Curl": "ex-643-seated-leg-curl",
  "Seated Calf Raises": "ex-57-barbell-seated-calf-raise",
  "Dead Bug": "ex-191-dead-bug",
  "Plank": "ex-538-plank",
  "Superman": "ex-801-superman", // Replaced Bird Dog which doesn't exist
  "Bicycle Crunches": "ex-7-air-bike",
  "Side Plank": "ex-661-side-bridge",
} as const

// Templates based on the PHUL (Power Hypertrophy Upper Lower) training plan
export const defaultTemplates: WorkoutTemplate[] = [
  {
    id: "template-upper-power",
    name: "Upper Body Power (Tuesday)",
    exercises: [
      { exerciseId: exerciseIds["Bench Press"], targetSets: 4, targetReps: 4 },
      { exerciseId: exerciseIds["Barbell Row"], targetSets: 4, targetReps: 4 },
      { exerciseId: exerciseIds["Overhead Press"], targetSets: 3, targetReps: 6 },
      { exerciseId: exerciseIds["Weighted Pull-ups"], targetSets: 3, targetReps: 6 },
      { exerciseId: exerciseIds["Skull Crushers"], targetSets: 3, targetReps: 9 },
      { exerciseId: exerciseIds["Barbell Curl"], targetSets: 3, targetReps: 9 },
    ],
  },
  {
    id: "template-lower-power",
    name: "Lower Body Power (Wednesday)",
    exercises: [
      { exerciseId: exerciseIds["Squat"], targetSets: 4, targetReps: 4 },
      { exerciseId: exerciseIds["Deadlift"], targetSets: 3, targetReps: 4 },
      { exerciseId: exerciseIds["Leg Press"], targetSets: 3, targetReps: 11 },
      { exerciseId: exerciseIds["Standing Calf Raises"], targetSets: 4, targetReps: 9 },
    ],
  },
  {
    id: "template-upper-hypertrophy",
    name: "Upper Body Hypertrophy (Thursday)",
    exercises: [
      { exerciseId: exerciseIds["Incline Dumbbell Press"], targetSets: 4, targetReps: 10 },
      { exerciseId: exerciseIds["Lat Pulldown"], targetSets: 4, targetReps: 10 },
      { exerciseId: exerciseIds["Seated Cable Row"], targetSets: 3, targetReps: 11 },
      { exerciseId: exerciseIds["Lateral Raises"], targetSets: 4, targetReps: 13 },
      { exerciseId: exerciseIds["Pec Deck"], targetSets: 3, targetReps: 13 },
      { exerciseId: exerciseIds["Tricep Rope Pushdown"], targetSets: 3, targetReps: 11 },
      { exerciseId: exerciseIds["Hammer Curl"], targetSets: 3, targetReps: 11 },
    ],
  },
  {
    id: "template-lower-hypertrophy",
    name: "Lower Body Hypertrophy (Friday)",
    exercises: [
      { exerciseId: exerciseIds["Front Squat"], targetSets: 3, targetReps: 10 },
      { exerciseId: exerciseIds["Romanian Deadlift"], targetSets: 3, targetReps: 10 },
      { exerciseId: exerciseIds["Walking Lunges"], targetSets: 3, targetReps: 12 },
      { exerciseId: exerciseIds["Leg Extension"], targetSets: 3, targetReps: 17 },
      { exerciseId: exerciseIds["Seated Leg Curl"], targetSets: 3, targetReps: 13 },
      { exerciseId: exerciseIds["Seated Calf Raises"], targetSets: 3, targetReps: 17 },
    ],
  },
  {
    id: "template-daily-core",
    name: "Daily Core Circuit",
    exercises: [
      { exerciseId: exerciseIds["Dead Bug"], targetSets: 1, targetReps: 60 }, // 60 seconds
      { exerciseId: exerciseIds["Plank"], targetSets: 1, targetReps: 60 }, // 60 seconds
      { exerciseId: exerciseIds["Superman"], targetSets: 1, targetReps: 10 }, // 10 reps
      { exerciseId: exerciseIds["Bicycle Crunches"], targetSets: 1, targetReps: 45 }, // 45 seconds
      { exerciseId: exerciseIds["Side Plank"], targetSets: 2, targetReps: 30 }, // 30 seconds per side
    ],
  },
]
