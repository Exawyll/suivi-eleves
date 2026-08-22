import { describe, expect, it } from 'vitest'
import { deriveCredentials, randomKdfSalt } from '@/crypto/kdf'
import { generateDataKey, rewrapDataKey, unwrapDataKey, wrapDataKey } from '@/crypto/vault'
import { openRecord, sealRecord } from '@/crypto/envelope'

// WebCrypto signals every failure — wrong key, tampered bytes, mismatched
// additional data — as an `OperationError` carrying no message at all, and
// deliberately so: a message would say which check failed. Asserting on the
// rejection itself is therefore the strongest thing available here, which is
// why none of these expectations names an error.

// PBKDF2 at the production count takes about a second per call; the tests
// exercise the wiring, not the work factor, so they use a cheap one.
const FAST = 1_000

describe('dérivation', () => {
  it('donne le même authSecret pour les mêmes entrées', async () => {
    const salt = randomKdfSalt()
    const a = await deriveCredentials('mot de passe', salt, FAST)
    const b = await deriveCredentials('mot de passe', salt, FAST)

    expect(a.authSecret).toBe(b.authSecret)
  })

  it('change d’authSecret si le mot de passe, le sel ou le nombre d’itérations change', async () => {
    const salt = randomKdfSalt()
    const reference = (await deriveCredentials('mot de passe', salt, FAST)).authSecret

    expect((await deriveCredentials('autre', salt, FAST)).authSecret).not.toBe(reference)
    expect((await deriveCredentials('mot de passe', randomKdfSalt(), FAST)).authSecret).not.toBe(
      reference,
    )
    expect((await deriveCredentials('mot de passe', salt, FAST + 1)).authSecret).not.toBe(reference)
  })

  it('ne laisse pas la KEK sortir du navigateur', async () => {
    const { kek } = await deriveCredentials('mot de passe', randomKdfSalt(), FAST)

    expect(kek.extractable).toBe(false)
    await expect(crypto.subtle.exportKey('raw', kek)).rejects.toBeDefined()
  })

  it('ne dérive pas la KEK de la même chose que l’authSecret', async () => {
    // If the two shared a derivation, the server would hold something the
    // carnet could be unlocked with.
    const salt = randomKdfSalt()
    const { authSecret, kek } = await deriveCredentials('mot de passe', salt, FAST)
    const dek = await generateDataKey()
    const wrapped = await wrapDataKey(dek, kek)

    const authAsKey = await crypto.subtle.importKey(
      'raw',
      new Uint8Array(
        atob(authSecret)
          .split('')
          .map((c) => c.charCodeAt(0)),
      ),
      { name: 'AES-GCM' },
      false,
      ['unwrapKey'],
    )
    await expect(unwrapDataKey(wrapped, authAsKey)).rejects.toBeDefined()
  })
})

describe('clé de données', () => {
  it('se déverrouille avec le bon mot de passe et pas avec un autre', async () => {
    const salt = randomKdfSalt()
    const { kek } = await deriveCredentials('bon', salt, FAST)
    const wrapped = await wrapDataKey(await generateDataKey(), kek)

    await expect(unwrapDataKey(wrapped, kek)).resolves.toBeDefined()

    const { kek: wrongKek } = await deriveCredentials('mauvais', salt, FAST)
    await expect(unwrapDataKey(wrapped, wrongKek)).rejects.toBeDefined()
  })

  it('survit à un changement de mot de passe sans re-chiffrer le carnet', async () => {
    // Walks the production path, which an earlier version of this test did
    // not: it re-wrapped the freshly *generated* key, which is extractable,
    // and so never exercised what the app actually holds — a non-extractable
    // key that `crypto.subtle.wrapKey` flatly refuses.
    const { kek: oldKek } = await deriveCredentials('avant', randomKdfSalt(), FAST)
    const wrapped = await wrapDataKey(await generateDataKey(), oldKek)
    const inUse = await unwrapDataKey(wrapped, oldKek)
    const sealed = await sealRecord(inUse, 'eleve', 'e1', { name: 'Camille' })
    expect(inUse.extractable).toBe(false)

    const { kek: newKek } = await deriveCredentials('après', randomKdfSalt(), FAST)
    const rewrapped = await rewrapDataKey(wrapped, oldKek, newKek)

    const recovered = await unwrapDataKey(rewrapped, newKek)
    expect(await openRecord(recovered, 'eleve', 'e1', sealed)).toEqual({ name: 'Camille' })
    await expect(unwrapDataKey(rewrapped, oldKek)).rejects.toBeDefined()
  })

  it('refuse de ré-envelopper la clé que l’application garde en main', async () => {
    // The reason rewrapDataKey exists at all. Without it, changing the
    // password would fail in production with InvalidAccessError while every
    // test stayed green.
    const { kek } = await deriveCredentials('mot de passe', randomKdfSalt(), FAST)
    const kept = await unwrapDataKey(await wrapDataKey(await generateDataKey(), kek), kek)

    await expect(wrapDataKey(kept, kek)).rejects.toBeDefined()
  })

  it('revient non extractible après déverrouillage', async () => {
    const { kek } = await deriveCredentials('mot de passe', randomKdfSalt(), FAST)
    const wrapped = await wrapDataKey(await generateDataKey(), kek)

    const dek = await unwrapDataKey(wrapped, kek)

    expect(dek.extractable).toBe(false)
  })
})

describe('enveloppes', () => {
  async function aKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ])
  }

  it('fait l’aller-retour sur un enregistrement', async () => {
    const dek = await aKey()
    const entity = { id: 'e1', name: 'Camille Roux', classeId: 'c1' }

    const sealed = await sealRecord(dek, 'eleve', 'e1', entity)

    expect(sealed.ciphertext).not.toContain('Camille')
    expect(await openRecord(dek, 'eleve', 'e1', sealed)).toEqual(entity)
  })

  it('donne deux chiffrés différents pour le même contenu', async () => {
    const dek = await aKey()
    const first = await sealRecord(dek, 'eleve', 'e1', { name: 'Camille' })
    const second = await sealRecord(dek, 'eleve', 'e1', { name: 'Camille' })

    // Otherwise the server could tell that two records hold the same thing.
    expect(first.ciphertext).not.toBe(second.ciphertext)
    expect(first.nonce).not.toBe(second.nonce)
  })

  it('refuse une enveloppe déplacée vers un autre enregistrement', async () => {
    const dek = await aKey()
    const sealed = await sealRecord(dek, 'eleve', 'e1', { name: 'Camille' })

    // Exactly what a hostile server would try: same bytes, different identity.
    await expect(openRecord(dek, 'eleve', 'e2', sealed)).rejects.toBeDefined()
    await expect(openRecord(dek, 'classe', 'e1', sealed)).rejects.toBeDefined()
  })

  it('refuse une enveloppe altérée', async () => {
    const dek = await aKey()
    const sealed = await sealRecord(dek, 'eleve', 'e1', { name: 'Camille' })
    const tampered = { ...sealed, ciphertext: sealed.ciphertext.replace(/^./, 'Z') }

    await expect(openRecord(dek, 'eleve', 'e1', tampered)).rejects.toBeDefined()
  })

  it('refuse une enveloppe chiffrée avec une autre clé', async () => {
    const sealed = await sealRecord(await aKey(), 'eleve', 'e1', { name: 'Camille' })

    await expect(openRecord(await aKey(), 'eleve', 'e1', sealed)).rejects.toBeDefined()
  })
})
