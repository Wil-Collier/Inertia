import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format seconds as MM:SS string
 */
export function formatDuration(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds))
  const minutes = Math.floor(safeSeconds / 60)
  const seconds = safeSeconds % 60
  return `${minutes}:${seconds.toString().padStart(2, "0")}`
}

/**
 * Deep equality check for primitives, arrays, and objects.
 * Faster than JSON.stringify for deep comparisons.
 */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true

  if (a && b && typeof a === "object" && typeof b === "object") {
    if (a.constructor !== b.constructor) return false

    if (Array.isArray(a)) {
      if (!Array.isArray(b) || a.length !== b.length) return false
      for (let i = 0; i < a.length; i++) {
        // @ts-ignore
        if (!deepEqual(a[i], b[i])) return false
      }
      return true
    }

    if (a instanceof Date) {
      return b instanceof Date && a.getTime() === b.getTime()
    }

    if (a instanceof RegExp) {
      return b instanceof RegExp && a.source === b.source && a.flags === b.flags
    }

    const keysA = Object.keys(a)
    const keysB = Object.keys(b)

    if (keysA.length !== keysB.length) return false

    for (const key of keysA) {
      if (!Object.prototype.hasOwnProperty.call(b, key)) return false
      // @ts-ignore
      if (!deepEqual(a[key], b[key])) return false
    }
    return true
  }

  return a !== a && b !== b // NaN check
}
