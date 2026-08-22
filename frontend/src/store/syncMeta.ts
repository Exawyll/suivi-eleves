import type { Id } from '@/types/domain'

/**
 * The bookkeeping that turns a local carnet into something synchronisable.
 *
 * Kept apart from the entities on purpose: the carnet's shape is what the
 * screens read and what every existing test asserts on, and none of it changes
 * because the app learned to synchronise. What changes is that each record now
 * also carries when it was last touched here, which revision the server gave
 * it, and whether this device still owes the server a copy.
 */

/**
 * The seven kinds the server accepts. It cannot read the envelopes, so this
 * list is the only structural check it can make — a type it does not know is
 * refused outright, which is why the two lists must stay in step.
 */
export type SyncEntityType =
  'etablissement' | 'classe' | 'eleve' | 'tagCategory' | 'tag' | 'event' | 'preference'

/**
 * A carnet holds exactly one preference record — which classe is open, which
 * one is pinned — so it needs an id that is the same on every device.
 */
export const PREFERENCE_ID = 'carnet'

export interface SyncRecordMeta {
  /** When this device last changed the record. What last-write-wins arbitrates on. */
  updatedAt: string
  /** What the server called this record's last version, or null if it has never seen it. */
  revision: number | null
  /** This device owes the server a copy. */
  dirty: boolean
}

/**
 * A deletion, kept rather than forgotten.
 *
 * Dropping the record outright would let another device that still has it push
 * it back and resurrect it — the deletion has to travel too.
 */
export interface Tombstone {
  entityType: SyncEntityType
  entityId: Id
  updatedAt: string
}

/** `"{entityType}:{entityId}"` — unique across the carnet, and stable. */
export function syncKey(entityType: SyncEntityType, entityId: Id): string {
  return `${entityType}:${entityId}`
}
