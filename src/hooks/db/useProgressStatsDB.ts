import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/services/db"
import { subDays } from "date-fns"

export function useProgressStatsDB() {
  return useLiveQuery(async () => {
    // 1. Total Workouts (Fast count)
    const totalWorkouts = await db.workoutSessions.count()

    // 2. Last 30 Days Count
    const thirtyDaysAgo = subDays(new Date(), 30).toISOString()
    const last30Days = await db.workoutSessions
      .where("date")
      .aboveOrEqual(thirtyDaysAgo)
      .count()

    // 3. Total Volume (Aggregation)
    // We still need to iterate for volume, but we can do it more efficiently
    // by only selecting the fields we need if Dexie supported specific field selection easily.
    // Since Dexie returns full objects, we'll stick to iterating but check if we can optimize.
    // For now, let's load all for volume calculation as it's hard to avoid without a separate stats table,
    // BUT we will do this only once here instead of the component re-rendering with 1000 items.
    
    // To truly optimize volume calc without loading everything, we'd need a 'stats' table updated on write.
    // For this scope, let's keep the iteration but isolate it in this hook so the UI doesn't manage the heavy object list.
    const allWorkouts = await db.workoutSessions.toArray()
    
    const totalVolume = allWorkouts.reduce((total, workout) => {
      return (
        total +
        workout.exercises.reduce((exTotal, ex) => {
          return (
            exTotal +
            ex.sets
              .filter((s) => s.completed)
              .reduce((setTotal, set) => {
                return setTotal + set.weight * set.reps
              }, 0)
          )
        }, 0)
      )
    }, 0)

    // 4. PR Count
    const prsCount = await db.personalRecords.count()

    return {
      totalWorkouts,
      last30Days,
      totalVolume,
      prsCount,
    }
  }) ?? {
    totalWorkouts: 0,
    last30Days: 0,
    totalVolume: 0,
    prsCount: 0,
  }
}
