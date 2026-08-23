import type { StateStorage } from 'zustand/middleware'

/**
 * The synchronous shape both `localStorage` and the in-memory fallback share.
 *
 * Narrower than `StateStorage`, whose `getItem` may return a promise: callers
 * here read the vault key or the previous carnet inline, and awaiting would
 * turn a handful of straight-line functions async for no gain.
 */
export interface SyncStorage {
  getItem: (name: string) => string | null
  setItem: (name: string, value: string) => void
  removeItem: (name: string) => void
}

/** Synchronous in-memory storage — the fallback when nothing durable is usable. */
export function createMemoryStorage(initial?: Record<string, string>): SyncStorage & StateStorage {
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
 * One fallback for the whole application, not one per caller.
 *
 * Each call used to build a fresh store, so wherever localStorage is unusable
 * every module got its own: the vault would be written to one and read back
 * from another, and the app would behave as though nothing had ever been
 * saved — within a single session, not just across reloads.
 */
let fallback: (SyncStorage & StateStorage) | null = null

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
export function resolveDefaultStorage(): SyncStorage & StateStorage {
  try {
    localStorage.setItem(PROBE_KEY, '1')
    localStorage.removeItem(PROBE_KEY)
    return localStorage
  } catch {
    fallback ??= createMemoryStorage()
    return fallback
  }
}
