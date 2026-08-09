import type { StateStorage } from 'zustand/middleware'

/** Synchronous in-memory `StateStorage` — the fallback when no durable storage is usable. */
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

const PROBE_KEY = '__carnet_storage_probe__'

/**
 * Resolves the storage the persisted store should write to.
 *
 * `localStorage` is not always usable: Safari's private mode and browsers with
 * site data blocked make it throw on write, and Node 26 exposes an experimental
 * Web Storage global that reads as undefined unless `--localstorage-file` is
 * passed. Writing through it unguarded throws on *every* mutation, which would
 * take down an app whose whole point is capturing notes. Falling back to memory
 * keeps the carnet fully usable for the session — it just won't survive a
 * reload, which is strictly better than crashing.
 */
export function resolveDefaultStorage(): StateStorage {
  try {
    localStorage.setItem(PROBE_KEY, '1')
    localStorage.removeItem(PROBE_KEY)
    return localStorage
  } catch {
    return createMemoryStorage()
  }
}
