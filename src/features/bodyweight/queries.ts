import { useQuery } from "@tanstack/react-query"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"

export function useBodyWeightHistory(limit = 30) {
  return useQuery({
    queryKey: queryKeys.bodyWeight.list(limit),
    queryFn: async () => {
      return db.bodyWeight
        .orderBy("date")
        // oxlint-disable-next-line unicorn/no-array-reverse
        .reverse()
        .limit(limit)
        .toArray()
    },
  })
}

export function useLatestBodyWeight() {
  return useQuery({
    queryKey: queryKeys.bodyWeight.latest(),
    queryFn: async () => {
      return db.bodyWeight
        .orderBy("date")
        // oxlint-disable-next-line unicorn/no-array-reverse
        .reverse()
        .first()
    },
  })
}
