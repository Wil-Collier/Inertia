import { toast } from "sonner"

/**
 * Helper to perform an optimistic update with rollback on failure.
 * 
 * @param currentValue The current value before update
 * @param updateFn Function to update the state in the store (sync)
 * @param saveFn Function to save the new value to the DB (async)
 * @param calculatorFn Function to calculate the new value from the old value
 * @param errorMessage Message to show on failure
 */
export async function performOptimisticUpdate<T>(
  currentValue: T | null | undefined,
  updateFn: (newValue: T) => void,
  saveFn: (newValue: T) => Promise<void>,
  calculatorFn: (current: T) => T,
  errorMessage: string = "Failed to save changes"
) {
  if (!currentValue) return

  const newValue = calculatorFn(currentValue)

  // 1. Optimistic Update
  updateFn(newValue)

  // 2. Persist
  try {
    await saveFn(newValue)
  } catch (error) {
    console.error(`${errorMessage}:`, error)
    toast.error(errorMessage)
    // 3. Revert on error
    updateFn(currentValue)
  }
}
