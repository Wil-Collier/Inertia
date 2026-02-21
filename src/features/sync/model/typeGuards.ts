/**
 * Type guard for plain objects (Record<string, unknown>).
 * Shared across sync pipeline modules to avoid duplication.
 */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value)
}
