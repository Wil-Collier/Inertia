import { db } from "@/services/db"
import type { Workout } from "@/lib/types"
import { statsService } from "@/services/statsService"
import { achievementService } from "@/services/achievementService"

function estimateOneRepMax(weight: number, reps: number): number {
  if (reps === 0 || weight === 0) return 0
  if (reps === 1) return weight
  if (reps >= 13) return weight * (1 + reps / 30)
  return weight * (36 / (37 - reps))
}

async function recalculatePersonalRecords(): Promise<void> {
  const workouts = await db.workoutSessions.toArray()
  const bestByExercise = new Map<
    string,
    { exerciseId: string; weight: number; reps: number; date: string; workoutId: string; e1rm: number }
  >()

  for (const workout of workouts) {
    updateBestRecordsFromWorkout(workout, bestByExercise)
  }

  const records = Array.from(bestByExercise.values()).map(({ e1rm: _e1rm, ...record }) => record)

  await db.transaction("rw", db.personalRecords, async () => {
    await db.personalRecords.clear()
    if (records.length > 0) {
      await db.personalRecords.bulkPut(records)
    }
  })
}

function updateBestRecordsFromWorkout(
  workout: Workout,
  bestByExercise: Map<
    string,
    { exerciseId: string; weight: number; reps: number; date: string; workoutId: string; e1rm: number }
  >
) {
  for (const exercise of workout.exercises) {
    const completedSets = exercise.sets.filter((set) => set.isCompleted && set.weight > 0 && set.reps > 0)
    if (completedSets.length === 0) continue

    let bestSet = completedSets[0]
    let bestE1RM = estimateOneRepMax(bestSet.weight, bestSet.reps)

    for (const set of completedSets) {
      const e1rm = estimateOneRepMax(set.weight, set.reps)
      if (e1rm > bestE1RM) {
        bestE1RM = e1rm
        bestSet = set
      }
    }

    const existing = bestByExercise.get(exercise.exerciseId)
    if (!existing || bestE1RM > existing.e1rm) {
      bestByExercise.set(exercise.exerciseId, {
        exerciseId: exercise.exerciseId,
        weight: bestSet.weight,
        reps: bestSet.reps,
        date: workout.date,
        workoutId: workout.id,
        e1rm: bestE1RM,
      })
    }
  }
}

export async function recalculateDerivedData(): Promise<void> {
  await recalculatePersonalRecords()
  await statsService.recalculateAll()
  await achievementService.checkAll()
}
