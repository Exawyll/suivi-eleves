import type { StateStorage } from 'zustand/middleware'

/** Synchronous in-memory storage for tests — avoids touching jsdom's real localStorage. */
export function createMemoryStorage(initial?: Record<string, string>): StateStorage {
  const store = new Map<string, string>(Object.entries(initial ?? {}))
  return {
    getItem: (name) => store.get(name) ?? null,
    setItem: (name, value) => {
      store.set(name, value)
    },
    removeItem: (name) => {
      store.delete(name)
    },
  }
}
