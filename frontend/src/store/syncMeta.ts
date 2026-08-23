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
export const SYNC_ENTITY_TYPES = [
  'etablissement',
  'classe',
  'eleve',
  'tagCategory',
  'tag',
  'event',
  'preference',
] as const

export type SyncEntityType = (typeof SYNC_ENTITY_TYPES)[number]

/**
 * Whether a kind read off the wire is one this version of the app knows.
 *
 * A kind is a plaintext label chosen by whatever wrote the record, so a newer
 * client — or a tampered response — can name one that means nothing here. It
 * has to be recognised at the door: the carnet has no list to put such a
 * record in, and the code that looks that list up would fail on it.
 */
export function isSyncEntityType(value: unknown): value is SyncEntityType {
  return typeof value === 'string' && (SYNC_ENTITY_TYPES as readonly string[]).includes(value)
}

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

/**
 * A timestamp for a local write, guaranteed to differ from the last one.
 *
 * The wall clock is not enough. Two writes to the same record inside the same
 * millisecond — a teacher correcting a name, an action firing twice — would
 * carry the identical stamp, and the engine reads "same stamp" as "not touched
 * since I sent it". It would then mark the record synchronised while holding
 * the older of the two versions, and the newer one would never leave the
 * device. Strictly increasing costs a millisecond of drift under a burst and
 * makes local writes totally ordered, which is what the arbitration needs.
 */
let lastStamp = ''

export function nextStamp(): string {
  const now = new Date().toISOString()
  lastStamp = now > lastStamp ? now : new Date(Date.parse(lastStamp) + 1).toISOString()
  return lastStamp
}
