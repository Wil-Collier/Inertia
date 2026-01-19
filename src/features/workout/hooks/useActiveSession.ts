import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import { queryKeys } from "@/lib/queryKeys"
import { activeSessionService } from "../services/activeSessionService"
import type { WorkoutExercise, WorkoutSet } from "@/lib/types"

export function useActiveSession() {
  return useQuery({
    queryKey: queryKeys.activeSession.current,
    queryFn: () => activeSessionService.getSession(),
    staleTime: Infinity, // The data only changes via mutations which will invalidate this
  })
}

export function useActiveSessionActions() {
  const queryClient = useQueryClient()

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.activeSession.current })
  }

  const startWorkoutMutation = useMutation({
    mutationFn: ({ name, templateId, exercises }: { name: string; templateId?: string; exercises?: WorkoutExercise[] }) =>
      activeSessionService.startWorkout(name, templateId, exercises),
    onSuccess: invalidate
  })

  const finishWorkoutMutation = useMutation({
    mutationFn: () => activeSessionService.finishWorkout(),
    onSuccess: () => {
      invalidate()
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
    }
  })

  const cancelWorkoutMutation = useMutation({
    mutationFn: () => activeSessionService.cancelWorkout(),
    onSuccess: invalidate
  })

  const updateWorkoutNameMutation = useMutation({
    mutationFn: (name: string) => activeSessionService.updateWorkoutName(name),
    onSuccess: invalidate
  })

  const addExerciseMutation = useMutation({
    mutationFn: (exerciseId: string) => activeSessionService.addExercise(exerciseId),
    onSuccess: invalidate
  })

  const removeExerciseMutation = useMutation({
    mutationFn: (workoutExerciseId: string) => activeSessionService.removeExercise(workoutExerciseId),
    onSuccess: invalidate
  })

  const reorderExercisesMutation = useMutation({
    mutationFn: (exerciseIds: string[]) => activeSessionService.reorderExercises(exerciseIds),
    onSuccess: invalidate
  })

  const updateExerciseNotesMutation = useMutation({
    mutationFn: ({ workoutExerciseId, notes }: { workoutExerciseId: string; notes: string }) =>
      activeSessionService.updateExerciseNotes(workoutExerciseId, notes),
    onSuccess: invalidate
  })

  const addSetMutation = useMutation({
    mutationFn: (workoutExerciseId: string) => activeSessionService.addSet(workoutExerciseId),
    onSuccess: invalidate
  })

  const updateSetMutation = useMutation({
    mutationFn: ({ workoutExerciseId, setId, updates }: { workoutExerciseId: string; setId: string; updates: Partial<WorkoutSet> }) =>
      activeSessionService.updateSet(workoutExerciseId, setId, updates),
    onSuccess: invalidate
  })

  const removeSetMutation = useMutation({
    mutationFn: ({ workoutExerciseId, setId }: { workoutExerciseId: string; setId: string }) =>
      activeSessionService.removeSet(workoutExerciseId, setId),
    onSuccess: invalidate
  })

  const toggleSetCompleteMutation = useMutation({
    mutationFn: ({ workoutExerciseId, setId }: { workoutExerciseId: string; setId: string }) =>
      activeSessionService.toggleSetComplete(workoutExerciseId, setId),
    onSuccess: invalidate
  })

  return {
    startWorkout: startWorkoutMutation.mutateAsync,
    finishWorkout: finishWorkoutMutation.mutateAsync,
    cancelWorkout: cancelWorkoutMutation.mutateAsync,
    updateWorkoutName: updateWorkoutNameMutation.mutateAsync,
    addExercise: addExerciseMutation.mutateAsync,
    removeExercise: removeExerciseMutation.mutateAsync,
    reorderExercises: reorderExercisesMutation.mutateAsync,
    updateExerciseNotes: updateExerciseNotesMutation.mutateAsync,
    addSet: addSetMutation.mutateAsync,
    updateSet: updateSetMutation.mutateAsync,
    removeSet: removeSetMutation.mutateAsync,
    toggleSetComplete: toggleSetCompleteMutation.mutateAsync,
  }
}
