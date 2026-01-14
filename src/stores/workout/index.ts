// Main export - the store hook
export { useWorkoutStore } from "./workoutStore"

// Type exports for consumers
export type {
  WorkoutStore,
  WorkoutState,
  SessionSlice,
  TemplateSlice,
  HistorySlice,
  ProgressionSlice,
  ExerciseHistoryEntry,
  Workout,
  WorkoutTemplate,
  WorkoutExercise,
  WorkoutSet,
  ActiveWorkoutSession,
  PersonalRecord,
  LastPerformance,
  ProgressionSuggestion,
} from "./types"
