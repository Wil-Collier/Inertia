import { useLiveQuery } from "dexie-react-hooks"
import { db } from "@/services/db"

/**
 * Hook for fetching body weight entries.
 */
export function useBodyWeightDB(limit: number = 100) {
  return useLiveQuery(async () => {
    return await db.bodyWeight.orderBy("date").reverse().limit(limit).toArray()
  }, [limit]) ?? []
}

/**
 * Hook for body weight trends in a range.
 */
export function useBodyWeightHistoryDB(startDate: string, endDate: string) {
  return useLiveQuery(async () => {
    return await db.bodyWeight
      .where("date")
      .between(startDate, endDate, true, true)
      .sortBy("date")
  }, [startDate, endDate]) ?? []
}
