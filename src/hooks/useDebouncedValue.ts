import { useState, useEffect } from "react"

/**
 * Returns a debounced version of the provided value.
 * The returned value only updates after the specified delay has passed
 * without the input value changing.
 */
export function useDebouncedValue<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value)
    }, delay)

    return () => {
      clearTimeout(timer)
    }
  }, [value, delay])

  return debouncedValue
}
