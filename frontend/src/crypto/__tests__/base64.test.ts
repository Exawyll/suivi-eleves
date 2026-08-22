import { describe, expect, it } from 'vitest'
import { base64ToBytes, bytesToBase64 } from '@/crypto/base64'

/** getRandomValues is capped at 65 536 bytes per call, by specification. */
function randomBytes(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  for (let offset = 0; offset < length; offset += 65_536) {
    crypto.getRandomValues(bytes.subarray(offset, Math.min(offset + 65_536, length)))
  }
  return bytes
}

describe('base64', () => {
  it('fait l’aller-retour sur des octets quelconques', () => {
    const bytes = randomBytes(1_000)
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })

  it('encode un carnet entier sans faire déborder la pile', () => {
    // The naive String.fromCharCode(...bytes) spreads every byte into an
    // argument, which throws well below this size.
    const bytes = randomBytes(400_000)
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes)
  })

  it('gère le tableau vide', () => {
    expect(bytesToBase64(new Uint8Array(0))).toBe('')
    expect(base64ToBytes('')).toEqual(new Uint8Array(0))
  })
})
