/**
 * Groups items by a derived key, preserving the order in which each key was
 * first encountered (not sorted) — matters for date-label groups, which must
 * stay in the chronological order events were passed in.
 */
export function groupBy<T, K extends string>(items: T[], keyOf: (item: T) => K): Map<K, T[]> {
  const groups = new Map<K, T[]>()
  for (const item of items) {
    const key = keyOf(item)
    const existing = groups.get(key)
    if (existing) {
      existing.push(item)
    } else {
      groups.set(key, [item])
    }
  }
  return groups
}
