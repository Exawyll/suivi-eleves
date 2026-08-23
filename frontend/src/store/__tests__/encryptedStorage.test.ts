import { describe, expect, it } from 'vitest'
import { createEncryptedStorage } from '@/store/encryptedStorage'
import { createMemoryStorage } from '@/store/memoryStorage'

async function aKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

describe('coffre local chiffré', () => {
  it('rend ce qu’on lui a confié', async () => {
    const storage = createEncryptedStorage(await aKey(), createMemoryStorage())

    await storage.setItem('carnet:vault:u1', '{"eleves":[{"name":"Camille Roux"}]}')

    expect(await storage.getItem('carnet:vault:u1')).toBe('{"eleves":[{"name":"Camille Roux"}]}')
  })

  it('n’écrit aucun nom d’élève en clair', async () => {
    // The promise the whole feature makes, checked against the bytes that
    // actually land on the device rather than against the API.
    const backing = createMemoryStorage()
    const storage = createEncryptedStorage(await aKey(), backing)

    await storage.setItem('carnet:vault:u1', '{"eleves":[{"name":"Camille Roux"}]}')

    const stored = await backing.getItem('carnet:vault:u1')
    expect(stored).not.toBeNull()
    expect(stored).not.toContain('Camille')
    expect(stored).not.toContain('eleves')
  })

  it('ne laisse pas une autre clé lire le coffre', async () => {
    // Two accounts on one browser: signing out drops the key, and the carnet
    // left on the device must stay unreadable to the next account.
    const backing = createMemoryStorage()
    await createEncryptedStorage(await aKey(), backing).setItem('carnet:vault:u1', 'secret')

    const other = createEncryptedStorage(await aKey(), backing)

    expect(await other.getItem('carnet:vault:u1')).toBeNull()
  })

  it('signale « rien » sans détruire un coffre illisible', async () => {
    // Reporting empty lets the app start; deleting would turn a transient
    // problem into permanent data loss.
    const backing = createMemoryStorage()
    await backing.setItem('carnet:vault:u1', 'ceci-nest-pas-une-enveloppe')
    const storage = createEncryptedStorage(await aKey(), backing)

    expect(await storage.getItem('carnet:vault:u1')).toBeNull()
    expect(await backing.getItem('carnet:vault:u1')).toBe('ceci-nest-pas-une-enveloppe')
  })

  it('rend null quand rien n’a jamais été écrit', async () => {
    const storage = createEncryptedStorage(await aKey(), createMemoryStorage())

    expect(await storage.getItem('carnet:vault:jamais-vu')).toBeNull()
  })

  it('chiffre différemment deux écritures identiques', async () => {
    const backing = createMemoryStorage()
    const storage = createEncryptedStorage(await aKey(), backing)

    await storage.setItem('a', 'même contenu')
    const first = await backing.getItem('a')
    await storage.setItem('b', 'même contenu')

    expect(first).not.toBe(await backing.getItem('b'))
  })
})
