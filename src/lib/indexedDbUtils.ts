export function orderedUniqueStringKeys(keys: unknown[]): string[] {
  const deduped: string[] = []
  let previous: string | undefined

  for (const key of keys) {
    if (typeof key !== "string") continue
    if (key === previous) continue
    deduped.push(key)
    previous = key
  }

  return deduped
}
