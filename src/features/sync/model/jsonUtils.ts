import { isRecord } from "@/features/sync/model/typeGuards"

type NormalizeJsonOptions = {
  sortKeys?: boolean
  stripTopLevelUpdatedAt?: boolean
}

function normalizeJsonValue(value: unknown, options: NormalizeJsonOptions, depth = 0): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => normalizeJsonValue(item, options, depth + 1))
  }

  if (!isRecord(value)) {
    return value
  }

  const normalized: Record<string, unknown> = {}
  const keys = options.sortKeys ? Object.keys(value).toSorted() : Object.keys(value)

  for (const key of keys) {
    if (options.stripTopLevelUpdatedAt && depth === 0 && key === "updatedAt") continue
    const normalizedValue = normalizeJsonValue(value[key], options, depth + 1)
    if (normalizedValue !== undefined) {
      normalized[key] = normalizedValue
    }
  }

  return normalized
}

export function jsonDeepEqual(
  left: unknown,
  right: unknown,
  options: NormalizeJsonOptions = {}
): boolean {
  try {
    const normalizedLeft = normalizeJsonValue(left, options)
    const normalizedRight = normalizeJsonValue(right, options)
    return JSON.stringify(normalizedLeft) === JSON.stringify(normalizedRight)
  } catch {
    return false
  }
}
