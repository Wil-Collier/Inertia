import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { db } from "@/services/db"
import { queryKeys } from "@/lib/queryKeys"
import type { WeightEntry } from "@/lib/types"

export function useAddWeightEntry() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (entry: Omit<WeightEntry, "id">) => {
      const id = crypto.randomUUID()
      const newEntry = { ...entry, id }
      await db.bodyWeight.add(newEntry)
      return newEntry
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bodyWeight.all })
      toast.success("Weight logged")
    },
    onError: () => {
      toast.error("Failed to log weight")
    }
  })
}

export function useDeleteWeightEntry() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: string) => {
      await db.bodyWeight.delete(id)
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.bodyWeight.all })
      toast.success("Entry deleted")
    },
    onError: () => {
      toast.error("Failed to delete entry")
    }
  })
}
