import type { WorkoutSliceCreator, ProgressionSlice, ProgressionSuggestion } from "./types"

export const createProgressionSlice: WorkoutSliceCreator<ProgressionSlice> = (set, get) => ({
  // Get smart progression suggestion for an exercise based on history analysis
  getProgressionSuggestion: (exerciseId, isTimeBased = false): ProgressionSuggestion | null => {
    const history = get().getExerciseHistory(exerciseId)

    // Need at least 1 session to make a suggestion
    if (history.length === 0) {
      return null
    }

    // Get the most recent sessions (up to 5) for analysis
    const recentHistory = history.slice(-5)
    const lastSession = recentHistory[recentHistory.length - 1]

    // For time-based exercises, analyze duration progression
    if (isTimeBased) {
      // Duration is stored in reps field for time-based exercises
      const lastDuration =
        lastSession.sets.length > 0
          ? Math.max(...lastSession.sets.map((s) => s.reps))
          : 0

      if (lastDuration === 0) {
        return null
      }

      // Detect duration increment pattern from history
      let durationIncrement = 5 // default 5 seconds
      if (recentHistory.length >= 2) {
        const durationChanges: number[] = []
        for (let i = 1; i < recentHistory.length; i++) {
          const prevMax = Math.max(...recentHistory[i - 1].sets.map((s) => s.reps))
          const currMax = Math.max(...recentHistory[i].sets.map((s) => s.reps))
          if (currMax > prevMax) {
            durationChanges.push(currMax - prevMax)
          }
        }
        if (durationChanges.length > 0) {
          durationIncrement = Math.min(...durationChanges)
        }
      }

      // For time-based, we generally suggest progression if they completed the last session
      const lastAllCompleted = lastSession.sets.length > 0

      if (lastAllCompleted) {
        return {
          type: "increase",
          suggestedWeight: 0,
          suggestedReps: 0,
          suggestedDuration: lastDuration + durationIncrement,
          reason: `You completed ${lastDuration}s last time`,
          confidence: "medium" as const,
          increment: durationIncrement,
          isTimeBased: true,
        }
      }

      return {
        type: "maintain",
        suggestedWeight: 0,
        suggestedReps: 0,
        suggestedDuration: lastDuration,
        reason: "Keep building duration",
        confidence: "medium" as const,
        increment: durationIncrement,
        isTimeBased: true,
      }
    }

    // For weighted exercises - analyze weight and rep patterns
    const allSets = recentHistory.flatMap((s) => s.sets)

    // Infer target reps from recent history (use median of recent reps)
    const recentReps = allSets.map((s) => s.reps).sort((a, b) => a - b)
    const medianReps = recentReps[Math.floor(recentReps.length / 2)] || 8
    const targetReps = Math.ceil(medianReps)

    // Detect weight increment pattern (smallest positive weight jump in history)
    let weightIncrement = 5 // default 5 lbs
    if (recentHistory.length >= 2) {
      const weightChanges: number[] = []
      for (let i = 1; i < recentHistory.length; i++) {
        const change = recentHistory[i].maxWeight - recentHistory[i - 1].maxWeight
        if (change > 0) {
          weightChanges.push(change)
        }
      }
      if (weightChanges.length > 0) {
        // Use the smallest increment they've used (usually 2.5, 5, or 10)
        const minChange = Math.min(...weightChanges)
        // Round to nearest 2.5 for sanity
        weightIncrement = Math.round(minChange / 2.5) * 2.5 || 5
      }
    }

    // Analyze last session for mixed weights (user dropped weight mid-workout)
    const lastSessionSets = lastSession.sets
    const uniqueWeights = [...new Set(lastSessionSets.map((s) => s.weight))].sort(
      (a, b) => b - a
    )
    const hasMultipleWeights = uniqueWeights.length > 1
    const maxWeightInSession = uniqueWeights[0] || 0

    // Find the "working weight" - the weight at which user successfully hit target reps
    // This handles the case where user tried heavier weight, failed, dropped back
    let workingWeight = maxWeightInSession
    if (hasMultipleWeights) {
      // Check if sets at the max weight hit target reps
      const setsAtMaxWeight = lastSessionSets.filter(
        (s) => s.weight === maxWeightInSession
      )
      const maxWeightHitTarget = setsAtMaxWeight.every((s) => s.reps >= targetReps)

      if (!maxWeightHitTarget) {
        // User failed at the higher weight - find the weight where they succeeded
        for (const weight of uniqueWeights) {
          const setsAtWeight = lastSessionSets.filter((s) => s.weight === weight)
          const hitTargetAtWeight = setsAtWeight.every((s) => s.reps >= targetReps)
          if (hitTargetAtWeight && setsAtWeight.length > 0) {
            workingWeight = weight
            break
          }
        }
      }
    }

    // Check if weight was lowered compared to previous session's working weight
    let weightWasLowered = false
    let previousWorkingWeight = workingWeight
    if (recentHistory.length >= 2) {
      const prevSession = recentHistory[recentHistory.length - 2]
      previousWorkingWeight = prevSession.maxWeight
      weightWasLowered = workingWeight < previousWorkingWeight
    }

    // Check if all sets at the working weight hit target reps
    const setsAtWorkingWeight = lastSessionSets.filter(
      (s) => s.weight === workingWeight
    )
    const hitAllTargetRepsAtWorkingWeight =
      setsAtWorkingWeight.length > 0 &&
      setsAtWorkingWeight.every((s) => s.reps >= targetReps)

    // Check if user attempted a higher weight and had to drop back (failed progression)
    const failedProgressionAttempt =
      hasMultipleWeights && workingWeight < maxWeightInSession

    const avgReps =
      lastSessionSets.reduce((sum, s) => sum + s.reps, 0) / lastSessionSets.length

    // Determine recommendation
    if (failedProgressionAttempt) {
      // User tried to progress but couldn't complete all sets at higher weight
      // Recommend staying at the successful working weight
      return {
        type: "maintain",
        suggestedWeight: workingWeight,
        suggestedReps: targetReps,
        reason: `Build strength at ${workingWeight} lbs first`,
        confidence: "high" as const,
        increment: weightIncrement,
        isTimeBased: false,
      }
    } else if (weightWasLowered) {
      // User lowered weight from previous session - recommend building back up
      if (hitAllTargetRepsAtWorkingWeight) {
        // They hit their reps at the lower weight - suggest getting back to previous weight
        return {
          type: "maintain",
          suggestedWeight: previousWorkingWeight,
          suggestedReps: targetReps,
          reason: `Build back to ${previousWorkingWeight} lbs`,
          confidence: "high" as const,
          increment: weightIncrement,
          isTimeBased: false,
        }
      } else {
        // Still working at lower weight
        return {
          type: "maintain",
          suggestedWeight: workingWeight,
          suggestedReps: targetReps,
          reason: "Rebuild strength at current weight",
          confidence: "medium" as const,
          increment: weightIncrement,
          isTimeBased: false,
        }
      }
    } else if (hitAllTargetRepsAtWorkingWeight) {
      // Weight maintained or increased AND all sets hit target reps - ready to progress
      return {
        type: "increase",
        suggestedWeight: workingWeight + weightIncrement,
        suggestedReps: targetReps,
        reason: `You hit ${targetReps}+ reps on all sets`,
        confidence: setsAtWorkingWeight.length >= 3 ? ("high" as const) : ("medium" as const),
        increment: weightIncrement,
        isTimeBased: false,
      }
    } else if (avgReps >= targetReps * 0.8) {
      // Close to target - maintain weight
      return {
        type: "maintain",
        suggestedWeight: workingWeight,
        suggestedReps: targetReps,
        reason: `Build to ${targetReps} reps on all sets`,
        confidence: "medium" as const,
        increment: weightIncrement,
        isTimeBased: false,
      }
    } else {
      // Far from target - maintain
      return {
        type: "maintain",
        suggestedWeight: workingWeight,
        suggestedReps: targetReps,
        reason: "Focus on hitting rep targets",
        confidence: "low" as const,
        increment: weightIncrement,
        isTimeBased: false,
      }
    }
  },

  // Apply a progression suggestion to uncompleted sets
  applyProgressionSuggestion: (workoutExerciseId, suggestion) => {
    set((state) => {
      if (!state.activeSession) return state

      return {
        activeSession: {
          ...state.activeSession,
          workout: {
            ...state.activeSession.workout,
            exercises: state.activeSession.workout.exercises.map((e) =>
              e.id === workoutExerciseId
                ? {
                    ...e,
                    sets: e.sets.map((s) =>
                      s.completed
                        ? s // Don't modify completed sets
                        : suggestion.isTimeBased
                        ? { ...s, reps: suggestion.suggestedDuration ?? s.reps }
                        : { ...s, weight: suggestion.suggestedWeight }
                    ),
                  }
                : e
            ),
          },
        },
      }
    })
  },
})
