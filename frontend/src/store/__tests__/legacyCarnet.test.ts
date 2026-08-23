import { beforeEach, describe, expect, it } from 'vitest'
import { LEGACY_STORAGE_KEY, discardLegacyCarnet, readLegacyCarnet } from '@/store/legacyCarnet'
import { resolveDefaultStorage } from '@/store/memoryStorage'

// Through the resolver, like the code under test: `localStorage` is not
// reliably present under Node 26, which is how these tests passed locally and
// failed in CI.
function writeLegacy(state: unknown): void {
  resolveDefaultStorage().setItem(LEGACY_STORAGE_KEY, JSON.stringify({ state, version: 1 }))
}

describe('reprise du carnet d’avant les comptes', () => {
  beforeEach(() => {
    resolveDefaultStorage().removeItem(LEGACY_STORAGE_KEY)
  })

  it('reprend un carnet réellement rempli', () => {
    writeLegacy({
      etablissements: [{ id: 'et1', name: 'École Jean Moulin' }],
      classes: [{ id: 'c1', etablissementId: 'et1', name: 'CM1 A', niveau: 'CM1' }],
      eleves: [{ id: 'e1', classeId: 'c1', name: 'Camille Roux' }],
      events: [],
      principalClasseId: 'c1',
    })

    const adopted = readLegacyCarnet()

    expect(adopted?.eleves).toHaveLength(1)
    expect(adopted?.principalClasseId).toBe('c1')
    // Missing collections must not come back undefined and break every screen.
    expect(adopted?.tags).toEqual([])
    // With none recorded, the first classe opens rather than no classe at all.
    expect(adopted?.activeClasseId).toBe('c1')
  })

  it('ignore un carnet vide plutôt que d’adopter le néant', () => {
    // Otherwise a fresh install would "adopt" nothing and skip the demo carnet
    // that makes the app legible on first run.
    writeLegacy({ etablissements: [], classes: [], eleves: [], events: [] })

    expect(readLegacyCarnet()).toBeNull()
  })

  it('ignore une absence et un contenu illisible', () => {
    expect(readLegacyCarnet()).toBeNull()

    resolveDefaultStorage().setItem(LEGACY_STORAGE_KEY, 'pas du json')
    expect(readLegacyCarnet()).toBeNull()
  })

  it('efface la copie en clair une fois le carnet mis à l’abri', () => {
    // Leaving it would keep every student's name readable on the device for
    // ever, which is exactly what the vault exists to prevent.
    writeLegacy({ eleves: [{ id: 'e1', classeId: 'c1', name: 'Camille Roux' }] })

    discardLegacyCarnet()

    expect(resolveDefaultStorage().getItem(LEGACY_STORAGE_KEY)).toBeNull()
    expect(readLegacyCarnet()).toBeNull()
  })
})
