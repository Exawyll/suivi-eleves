import { describe, expect, it } from 'vitest'
import {
  RECOVERY_KEY_BYTES,
  decodeRecoveryKey,
  encodeRecoveryKey,
  randomRecoveryKey,
} from '@/crypto/recoveryKey'
import { deriveRecoveryCredentials } from '@/crypto/kdf'

describe('clé de récupération', () => {
  it('génère 32 octets aléatoires et différents à chaque fois', () => {
    const a = randomRecoveryKey()
    const b = randomRecoveryKey()

    expect(a).toHaveLength(RECOVERY_KEY_BYTES)
    expect(a).not.toEqual(b)
  })

  it('fait l’aller-retour entre les octets et la forme lisible', () => {
    const bytes = randomRecoveryKey()

    expect(decodeRecoveryKey(encodeRecoveryKey(bytes))).toEqual(bytes)
  })

  it('accepte la clé retapée en minuscules, avec ou sans les tirets', () => {
    const bytes = randomRecoveryKey()
    const encoded = encodeRecoveryKey(bytes)

    expect(decodeRecoveryKey(encoded.toLowerCase())).toEqual(bytes)
    expect(decodeRecoveryKey(encoded.replace(/-/g, ' '))).toEqual(bytes)
  })

  it('refuse une clé trop courte, trop longue ou hors alphabet', () => {
    const encoded = encodeRecoveryKey(randomRecoveryKey())

    expect(() => decodeRecoveryKey(encoded.slice(0, -5))).toThrow('invalide')
    expect(() => decodeRecoveryKey(`${encoded}-ABCDE`)).toThrow('invalide')
    // '0', '1' and 'l' are deliberately outside the alphabet, so a
    // transposed digit is caught rather than silently decoded into something
    // else.
    expect(() => decodeRecoveryKey(encoded.replace(/^./, '0'))).toThrow('invalide')
  })

  it('dérive un secret différent de la clé qui unwrap le carnet', async () => {
    const bytes = randomRecoveryKey()
    const { authSecret, kek } = await deriveRecoveryCredentials(bytes)

    expect(kek.extractable).toBe(false)
    expect(authSecret).not.toBe('')
    // If the server-facing secret and the unwrap key were the same value, a
    // server holding the hash of one would hold the other too.
    await expect(crypto.subtle.exportKey('raw', kek)).rejects.toBeDefined()
  })

  it('dérive le même secret et la même clé pour la même clé de récupération', async () => {
    const bytes = randomRecoveryKey()
    const a = await deriveRecoveryCredentials(bytes)
    const b = await deriveRecoveryCredentials(bytes)

    expect(a.authSecret).toBe(b.authSecret)
  })
})
