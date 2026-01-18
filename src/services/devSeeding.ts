import { db } from "./db"
import { v4 as uuidv4 } from "uuid"
import { subDays, format } from "date-fns"
import type { 
  Workout, 
  WorkoutTemplate, 
  WeightEntry, 
  DailyNutrition, 
  FoodItem,
  MealType
} from "@/lib/types"
import { exerciseDatabase } from "@/data/exerciseDatabase"

// Helper to get a random exercise from a muscle group
const getExerciseByMuscle = (muscle: string) => {
  const matches = exerciseDatabase.filter(ex => ex.muscleGroup === muscle)
  return matches[Math.floor(Math.random() * matches.length)]
}

export async function seedTestData() {
  console.log("Starting data seeding...")

  // 1. Clear existing data (optional but recommended for clean seed)
  await Promise.all([
    db.workoutSessions.clear(),
    db.workoutTemplates.clear(),
    db.bodyWeight.clear(),
    db.nutritionLogs.clear(),
    db.foods.clear(),
    db.personalRecords.clear()
  ])

  // 2. Seed Body Weight (15 entries, last 30 days)
  const weightEntries: WeightEntry[] = []
  let currentWeight = 185.5
  for (let i = 30; i >= 0; i -= 2) {
    currentWeight -= (Math.random() * 0.5) - 0.2 // Slight downward trend
    weightEntries.push({
      id: uuidv4(),
      date: format(subDays(new Date(), i), "yyyy-MM-dd"),
      weight: parseFloat(currentWeight.toFixed(1)),
      note: i === 30 ? "Starting point" : undefined
    })
  }
  await db.bodyWeight.bulkAdd(weightEntries)

  // 3. Seed Foods (Some custom items)
  const customFoods: FoodItem[] = [
    {
      id: uuidv4(),
      name: "Protein Shake",
      brand: "Optimum Nutrition",
      calories: 120,
      protein: 24,
      carbs: 3,
      fat: 1,
      fiber: 0,
      sugar: 1,
      servingSize: "1 scoop",
      isCustom: true,
      isFavorite: true
    },
    {
      id: uuidv4(),
      name: "Chicken Breast",
      brand: "Home Cooked",
      calories: 165,
      protein: 31,
      carbs: 0,
      fat: 3.6,
      fiber: 0,
      sugar: 0,
      servingSize: "100g",
      isCustom: true
    }
  ]
  await db.foods.bulkAdd(customFoods)

  // 4. Seed Nutrition Logs (Last 7 days)
  const nutritionLogs: DailyNutrition[] = []
  const mealTypes: MealType[] = ["breakfast", "lunch", "dinner", "snack"]
  
  for (let i = 0; i < 7; i++) {
    const date = format(subDays(new Date(), i), "yyyy-MM-dd")
    const entries = mealTypes.map(type => ({
      id: uuidv4(),
      foodId: customFoods[Math.floor(Math.random() * customFoods.length)].id,
      quantity: 1 + Math.random() * 2,
      mealType: type
    }))
    nutritionLogs.push({ date, entries })
  }
  await db.nutritionLogs.bulkAdd(nutritionLogs)

  // 5. Seed Workout Templates
  const templates: WorkoutTemplate[] = [
    {
      id: uuidv4(),
      name: "Upper Body Power",
      exercises: [
        { exerciseId: getExerciseByMuscle("chest").id, targetSets: 3, targetReps: 5 },
        { exerciseId: getExerciseByMuscle("back").id, targetSets: 3, targetReps: 5 },
        { exerciseId: getExerciseByMuscle("shoulders").id, targetSets: 3, targetReps: 8 },
      ]
    },
    {
      id: uuidv4(),
      name: "Lower Body Hypertrophy",
      exercises: [
        { exerciseId: getExerciseByMuscle("legs").id, targetSets: 4, targetReps: 12 },
        { exerciseId: getExerciseByMuscle("legs").id, targetSets: 3, targetReps: 15 },
        { exerciseId: getExerciseByMuscle("core").id, targetSets: 3, targetReps: 20 },
      ]
    }
  ]
  await db.workoutTemplates.bulkAdd(templates)

  // 6. Seed Workout History (10 sessions)
  const workouts: Workout[] = []
  for (let i = 0; i < 10; i++) {
    const template = templates[i % templates.length]
    const date = subDays(new Date(), i * 3 + 1)
    
    workouts.push({
      id: uuidv4(),
      name: template.name,
      date: date.toISOString(),
      completedAt: date.toISOString(),
      duration: 45 + Math.floor(Math.random() * 30),
      exercises: template.exercises.map(templateExercise => ({
        id: uuidv4(),
        exerciseId: templateExercise.exerciseId,
        sets: Array.from({ length: templateExercise.targetSets }).map(() => ({
          id: uuidv4(),
          reps: (templateExercise.targetReps || 10) + Math.floor(Math.random() * 3) - 1,
          weight: 100 + Math.floor(Math.random() * 100),
          isCompleted: true
        }))
      }))
    })
  }
  await db.workoutSessions.bulkAdd(workouts)

  console.log("Seeding complete!")
}

// Attach to window for console access
if (typeof window !== "undefined") {
  window.antigravity = {
    seed: async () => {
      await seedTestData()
      window.location.reload()
    }
  }
}
