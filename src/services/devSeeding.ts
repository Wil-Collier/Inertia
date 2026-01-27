import { db } from "./db"
import { subDays, format } from "date-fns"
import type { 
  Workout, 
  WorkoutTemplate, 
  WeightEntry, 
  DailyNutrition, 
  FoodItem,
  MealType,
  UnlockedAchievement
} from "@/lib/types"
import { exerciseDatabase } from "@/data/exerciseDatabase"
import { statsService } from "@/services/statsService"
import { achievementService } from "@/services/achievementService"

// Helper to get a random exercise from a muscle group
const getExerciseByMuscle = (muscle: string) => {
  const matches = exerciseDatabase.filter(ex => ex.muscleGroup === muscle)
  return matches[Math.floor(Math.random() * matches.length)]
}

export async function seedTestData() {
  console.log("Starting data seeding...")

  // 1. Clear + seed within one write transaction.
  // Safari can be sensitive to lots of parallel transactions during startup.
  await db.transaction(
    "rw",
    [
      db.workoutSessions,
      db.workoutTemplates,
      db.bodyWeight,
      db.nutritionLogs,
      db.foods,
      db.personalRecords,
      db.achievements,
    ],
    async () => {
      await db.workoutSessions.clear()
      await db.workoutTemplates.clear()
      await db.bodyWeight.clear()
      await db.nutritionLogs.clear()
      await db.foods.clear()
      await db.personalRecords.clear()
      await db.achievements.clear()

      // 2. Seed Body Weight (15 entries, last 30 days)
      const weightEntries: WeightEntry[] = []
      let currentWeight = 185.5
      for (let i = 30; i >= 0; i -= 2) {
        currentWeight -= (Math.random() * 0.5) - 0.2 // Slight downward trend
        weightEntries.push({
          id: crypto.randomUUID(),
          date: format(subDays(new Date(), i), "yyyy-MM-dd"),
          weight: parseFloat(currentWeight.toFixed(1)),
          note: i === 30 ? "Starting point" : undefined
        })
      }
      await db.bodyWeight.bulkAdd(weightEntries)

      // 3. Seed Foods (Some custom items)
      const customFoods: FoodItem[] = [
        {
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          foodId: customFoods[Math.floor(Math.random() * customFoods.length)].id,
          quantity: 1 + Math.random() * 2,
          mealType: type
        }))
        nutritionLogs.push({ date, entries })
      }
      // date is the primary key; bulkPut makes this idempotent.
      await db.nutritionLogs.bulkPut(nutritionLogs)

      // 5. Seed Workout Templates
      const templates: WorkoutTemplate[] = [
        {
          id: crypto.randomUUID(),
          name: "Upper Body Power",
          exercises: [
            { exerciseId: getExerciseByMuscle("chest").id, targetSets: 3, targetReps: 5 },
            { exerciseId: getExerciseByMuscle("back").id, targetSets: 3, targetReps: 5 },
            { exerciseId: getExerciseByMuscle("shoulders").id, targetSets: 3, targetReps: 8 },
          ]
        },
        {
          id: crypto.randomUUID(),
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
          id: crypto.randomUUID(),
          name: template.name,
          date: format(date, "yyyy-MM-dd"),
          completedAt: date.toISOString(),
          duration: 45 + Math.floor(Math.random() * 30),
          weightUnit: "kg",
          exerciseIds: template.exercises.map(e => e.exerciseId),
          exercises: template.exercises.map(templateExercise => ({
            id: crypto.randomUUID(),
            exerciseId: templateExercise.exerciseId,
            sets: Array.from({ length: templateExercise.targetSets }).map(() => ({
              id: crypto.randomUUID(),
              reps: (templateExercise.targetReps || 10) + Math.floor(Math.random() * 3) - 1,
              weight: 100 + Math.floor(Math.random() * 100),
              isCompleted: true
            }))
          }))
        })
      }
      await db.workoutSessions.bulkAdd(workouts)

      // 7. Seed Achievements & Streaks
      const unlockedAchievements: UnlockedAchievement[] = [
        { id: "first-workout", unlockedAt: format(subDays(new Date(), 28), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") },
        { id: "ten-workouts", unlockedAt: format(subDays(new Date(), 2), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") },
        { id: "10k-club", unlockedAt: format(subDays(new Date(), 15), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") },
        { id: "macro-tracker", unlockedAt: format(subDays(new Date(), 5), "yyyy-MM-dd'T'HH:mm:ss.SSSxxx") }
      ]

      await db.achievements.put({
        id: "achievements",
        unlockedAchievements,
        streaks: {
          currentWorkoutStreak: 3,
          longestWorkoutStreak: 12,
          lastWorkoutDate: format(subDays(new Date(), 1), "yyyy-MM-dd"),
          currentNutritionStreak: 7,
          longestNutritionStreak: 14,
          lastNutritionDate: format(new Date(), "yyyy-MM-dd")
        }
      })
    }
  )

  // Recalculate stats and check for any additional achievements met by seed data
  await statsService.recalculateAll()
  await achievementService.checkAll()

  console.log("Seeding complete!")
}

// Attach to window for console access (DEV only)
if (import.meta.env.DEV && typeof window !== "undefined") {
  window.__DEV_SEED__ = {
    seed: async () => {
      await seedTestData()
      window.location.reload()
    }
  }
}
