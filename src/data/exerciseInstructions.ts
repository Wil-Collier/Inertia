// Exercise instructions pulled from the exercise database
// For new exercises, instructions come directly from the JSON data

import { getExerciseFromDatabase } from "./exerciseDatabase"

export interface ExerciseInstruction {
  instructions: string[]
}

// Helper function to get instructions for an exercise
export function getExerciseInstructions(
  exerciseId: string
): ExerciseInstruction | undefined {
  // Try to get from the new exercise database
  const exercise = getExerciseFromDatabase(exerciseId)

  if (exercise && exercise.instructions.length > 0) {
    return {
      instructions: exercise.instructions,
    }
  }

  return undefined
}
