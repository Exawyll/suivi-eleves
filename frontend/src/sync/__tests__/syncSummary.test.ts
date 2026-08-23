import { describe, expect, it } from 'vitest'
import { summariseSync } from '@/sync/syncSummary'

/**
 * The wording is the feature: this row is the only place the app says anything
 * at all about whether the carnet has left the device.
 */

const NOW = Date.parse('2026-03-10T12:00:00.000Z')

describe('résumé de la synchronisation', () => {
  it('dit depuis quand tout est à jour', () => {
    expect(summariseSync('idle', '2026-03-10T11:43:00.000Z', 0, NOW)).toBe('À jour — il y a 17 min')
  })

  it('dit qu’il ne s’est encore rien passé plutôt que de laisser croire que tout est monté', () => {
    expect(summariseSync('idle', null, 0, NOW)).toBe('Jamais synchronisé')
  })

  it('annonce ce qui attend, même hors ligne', () => {
    // The count is the half that says nothing was lost.
    expect(summariseSync('offline', null, 4, NOW)).toBe('Hors ligne — 4 modifications en attente')
    expect(summariseSync('offline', null, 1, NOW)).toBe('Hors ligne — 1 modification en attente')
  })

  it('reste sobre quand il n’y a rien à envoyer et pas de réseau', () => {
    expect(summariseSync('offline', '2026-03-10T11:00:00.000Z', 0, NOW)).toBe('Hors ligne')
  })

  it('mène l’échec par ce qui attend, pas par la panne', () => {
    expect(summariseSync('error', null, 2, NOW)).toBe('Échec — 2 modifications en attente')
  })
})
