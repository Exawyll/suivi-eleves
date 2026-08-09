import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryStorage, resolveDefaultStorage } from '@/store/memoryStorage'

/**
 * Whether this test environment actually provides a writable `localStorage`.
 * Node 26 shadows jsdom's with an experimental global that is unavailable
 * without `--localstorage-file`, so the two assertions below that describe
 * browser behaviour cannot run there — which is exactly the situation
 * `resolveDefaultStorage` exists to survive.
 */
const hasWritableLocalStorage = (() => {
  try {
    localStorage.setItem('__probe__', '1')
    localStorage.removeItem('__probe__')
    return true
  } catch {
    return false
  }
})()

describe('createMemoryStorage', () => {
  it('round-trips values and reports missing keys as null', () => {
    const storage = createMemoryStorage()

    expect(storage.getItem('absent')).toBeNull()
    storage.setItem('k', 'v')
    expect(storage.getItem('k')).toBe('v')
    storage.removeItem('k')
    expect(storage.getItem('k')).toBeNull()
  })

  it('seeds from an initial record', () => {
    expect(createMemoryStorage({ k: 'v' }).getItem('k')).toBe('v')
  })
})

describe('resolveDefaultStorage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it.skipIf(!hasWritableLocalStorage)('uses localStorage when it is writable', () => {
    expect(resolveDefaultStorage()).toBe(localStorage)
  })

  it.skipIf(!hasWritableLocalStorage)('leaves no probe key behind', () => {
    resolveDefaultStorage()

    expect(Object.keys(localStorage).some((k) => k.includes('probe'))).toBe(false)
  })

  it('falls back to memory when localStorage throws on write (private mode, blocked site data)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError')
    })

    const storage = resolveDefaultStorage()

    expect(storage).not.toBe(localStorage)
    // Still a working storage rather than a crash.
    storage.setItem('k', 'v')
    expect(storage.getItem('k')).toBe('v')
  })
})
