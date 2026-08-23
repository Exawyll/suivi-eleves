import { beforeEach, describe, expect, it } from 'vitest'
import { attachVault, detachVault } from '@/store/vaultBinding'
import { createEncryptedStorage } from '@/store/encryptedStorage'
import { seededDomainState, useAppStore, vaultKeyFor } from '@/store/useAppStore'
import { resolveDefaultStorage } from '@/store/memoryStorage'

/**
 * Never `localStorage` directly: Node 26 ships an experimental Web Storage
 * global that shadows jsdom's and reads as undefined unless
 * --localstorage-file is passed, which is exactly how these tests passed
 * locally and failed in CI. The resolver hands back whatever the application
 * itself is using.
 */
const ACCOUNTS = ['u1', 'camille', 'dominique']

function clearStorage(): void {
  const storage = resolveDefaultStorage()
  for (const account of ACCOUNTS) {
    storage.removeItem(vaultKeyFor(account))
  }
}

async function aKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt'])
}

async function readVault(userId: string, dek: CryptoKey): Promise<string | null> {
  return createEncryptedStorage(dek, resolveDefaultStorage()).getItem(vaultKeyFor(userId))
}

/**
 * Lets any write already in flight finish.
 *
 * Persistence writes asynchronously, so reading straight after a state change
 * sees the *previous* contents — which made an earlier version of these tests
 * pass with the detach order reversed, proving nothing at all. A destructive
 * write has to be given time to land before its absence means anything.
 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 60))
}

describe('branchement du coffre', () => {
  beforeEach(() => {
    clearStorage()
  })

  it('écrit l’état initial d’un compte neuf dans son coffre', async () => {
    const dek = await aKey()

    // Resolves only once the write has landed, which is what lets sign-up
    // delete the plain-text carnet without racing it.
    expect(await attachVault('u1', dek, seededDomainState())).toBe(true)

    const stored = await readVault('u1', dek)
    expect(stored).not.toBeNull()
    expect(JSON.parse(stored ?? '{}').state.classes.length).toBeGreaterThan(0)
  })

  it('relit le carnet d’un compte connu', async () => {
    const dek = await aKey()
    await attachVault('u1', dek, seededDomainState())
    const expected = useAppStore.getState().eleves.length
    detachVault()
    await settle()

    await attachVault('u1', dek)

    expect(useAppStore.getState().eleves).toHaveLength(expected)
  })

  it('NE DÉTRUIT PAS le carnet à la déconnexion', async () => {
    // The trap this module exists for: clearing the state while persistence
    // still points at the vault writes the empty carnet over the real one.
    const dek = await aKey()
    await attachVault('u1', dek, seededDomainState())
    const before = await readVault('u1', dek)

    detachVault()
    await settle()

    expect(useAppStore.getState().eleves).toEqual([])
    expect(await readVault('u1', dek)).toBe(before)
  })

  it('n’écrit plus dans le coffre une fois détaché', async () => {
    const dek = await aKey()
    await attachVault('u1', dek, seededDomainState())
    const before = await readVault('u1', dek)
    detachVault()

    // Anything a lingering screen does after sign-out must land nowhere.
    useAppStore.getState().createEtablissement('École fantôme')
    await settle()

    expect(await readVault('u1', dek)).toBe(before)
  })

  it('garde deux comptes du même navigateur étanches', async () => {
    const camille = await aKey()
    const dominique = await aKey()
    await attachVault('camille', camille, seededDomainState())
    detachVault()

    await attachVault('dominique', dominique, {
      ...seededDomainState(),
      eleves: [{ id: 'e9', classeId: 'c1', name: 'Élève de Dominique' }],
    })

    // Separate keys under separate names, and neither key opens the other.
    expect(await readVault('camille', dominique)).toBeNull()
    expect(await readVault('dominique', camille)).toBeNull()
    const camilleVault = await readVault('camille', camille)
    expect(camilleVault).not.toContain('Dominique')
  })
})
