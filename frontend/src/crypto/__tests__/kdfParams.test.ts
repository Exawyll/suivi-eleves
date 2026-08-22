import { describe, expect, it } from 'vitest'
import { DEFAULT_KDF_ITERATIONS, MAX_KDF_ITERATIONS, assertUsableKdfParams } from '@/crypto/kdf'

describe('paramètres de dérivation venus du serveur', () => {
  it('accepte le compte attendu et au-dessus', () => {
    expect(() => assertUsableKdfParams(DEFAULT_KDF_ITERATIONS)).not.toThrow()
    expect(() => assertUsableKdfParams(MAX_KDF_ITERATIONS)).not.toThrow()
  })

  it('refuse un compte affaibli', () => {
    // The attack this exists for: a server answering `1` would receive an
    // authSecret derived in microseconds, cheap enough to brute-force back to
    // the password — and the password derives the real key to the carnet.
    for (const weak of [1, 1_000, DEFAULT_KDF_ITERATIONS - 1, 0, -1]) {
      expect(() => assertUsableKdfParams(weak)).toThrow('sécurité')
    }
  })

  it('refuse un compte qui figerait le navigateur', () => {
    expect(() => assertUsableKdfParams(MAX_KDF_ITERATIONS + 1)).toThrow('sécurité')
    expect(() => assertUsableKdfParams(Number.MAX_SAFE_INTEGER)).toThrow('sécurité')
  })

  it('refuse ce qui n’est pas un entier', () => {
    for (const invalid of [Number.NaN, Infinity, 600_000.5]) {
      expect(() => assertUsableKdfParams(invalid)).toThrow('invalides')
    }
  })
})
