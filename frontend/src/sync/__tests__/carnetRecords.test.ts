import { describe, expect, it } from 'vitest'
import type { SyncEntityType } from '@/store/syncMeta'
import { seededDomainState } from '@/store/useAppStore'
import { applyRecord, readRecord, removeRecord } from '@/sync/carnetRecords'

/**
 * The mapping table is the last thing between a record off the wire and the
 * carnet, and it gets asked about kinds this version may not know — a newer
 * client on the same account writes them.
 *
 * It has to stay inert rather than throw. A throw here travels up through the
 * pull, fails the round, and fails every round after it too: the same record
 * comes back on the next page, so the carnet would stop synchronising for
 * good over a record it simply has nowhere to put.
 */
const FOREIGN = 'devoir' as SyncEntityType

describe('un genre d’enregistrement inconnu', () => {
  it('n’a rien à lire dans le carnet', () => {
    expect(readRecord(seededDomainState(), FOREIGN, 'd1')).toBeNull()
  })

  it('n’écrit rien — et surtout pas par-dessus les préférences', () => {
    expect(applyRecord(seededDomainState(), FOREIGN, 'd1', { titre: 'Poésie' })).toEqual({})
  })

  it('ne supprime rien', () => {
    expect(removeRecord(seededDomainState(), FOREIGN, 'd1')).toEqual({})
  })
})
