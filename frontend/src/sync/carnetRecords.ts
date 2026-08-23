import type { DomainState } from '@/store/useAppStore'
import type { SyncEntityType } from '@/store/syncMeta'
import type { Classe, Eleve, Etablissement, EventItem, Id, Tag, TagCategory } from '@/types/domain'

/**
 * The one place that knows how a record of the carnet maps onto a record of
 * the server, in both directions.
 *
 * Kept out of the engine so the engine can be read as what it is — a loop over
 * pages and batches — and so this table can be exercised on its own.
 */

/** The carnet's single settings record: what is open, what is pinned. */
export interface PreferenceRecord {
  activeClasseId: Id | null
  principalClasseId: Id | null
  hasSeeded: boolean
}

/** The list a record lives in, by kind. Every kind but the preference has one. */
const COLLECTIONS = {
  etablissement: 'etablissements',
  classe: 'classes',
  eleve: 'eleves',
  tagCategory: 'tagCategories',
  tag: 'tags',
  event: 'events',
} as const

type CollectionType = keyof typeof COLLECTIONS
type CollectionItem = Etablissement | Classe | Eleve | TagCategory | Tag | EventItem

/**
 * The list this kind lives in, or null when it has none.
 *
 * Looked up in the table rather than deduced from "anything but the
 * preference": a kind that is in neither — one a newer client wrote — would
 * otherwise be read as a collection, index the table to `undefined`, and throw
 * on the list that name points at. That throw travels up through the pull and
 * fails the whole round, and it fails every round after it, since the same
 * record comes back on the next page. Unknown kinds are inert instead.
 */
function collectionOf(entityType: SyncEntityType): CollectionType | null {
  return Object.hasOwn(COLLECTIONS, entityType) ? (entityType as CollectionType) : null
}

/** What to encrypt for this record, or null if it is not in the carnet. */
export function readRecord(
  state: DomainState,
  entityType: SyncEntityType,
  entityId: Id,
): unknown | null {
  if (entityType === 'preference') {
    return {
      activeClasseId: state.activeClasseId,
      principalClasseId: state.principalClasseId,
      hasSeeded: state.hasSeeded,
    } satisfies PreferenceRecord
  }
  const key = collectionOf(entityType)
  if (key === null) return null
  const items: CollectionItem[] = state[COLLECTIONS[key]]
  return items.find((item) => item.id === entityId) ?? null
}

/**
 * Writes a record that arrived from the server into the carnet.
 *
 * The id comes from the envelope rather than from the decrypted body: the
 * envelope's identity is what the encryption is bound to, so it is the half
 * that cannot have been swapped underneath.
 */
export function applyRecord(
  state: DomainState,
  entityType: SyncEntityType,
  entityId: Id,
  value: unknown,
): Partial<DomainState> {
  if (entityType === 'preference') {
    const preference = value as Partial<PreferenceRecord>
    return {
      activeClasseId: preference.activeClasseId ?? null,
      principalClasseId: preference.principalClasseId ?? null,
      hasSeeded: preference.hasSeeded ?? true,
    }
  }

  const collection = collectionOf(entityType)
  if (collection === null) return {}
  const key = COLLECTIONS[collection]
  const items: CollectionItem[] = state[key]
  const incoming = { ...(value as object), id: entityId } as CollectionItem
  const at = items.findIndex((item) => item.id === entityId)
  const next =
    at === -1 ? [...items, incoming] : items.map((item, index) => (index === at ? incoming : item))
  return { [key]: next } as Partial<DomainState>
}

/** Removes a record the server says is gone. */
export function removeRecord(
  state: DomainState,
  entityType: SyncEntityType,
  entityId: Id,
): Partial<DomainState> {
  // A carnet always has its preference record; there is nothing to delete.
  if (entityType === 'preference') return {}

  const collection = collectionOf(entityType)
  if (collection === null) return {}
  const key = COLLECTIONS[collection]
  const items: CollectionItem[] = state[key]
  const patch = { [key]: items.filter((item) => item.id !== entityId) } as Partial<DomainState>

  // A deleted classe must not stay pointed at, or the Classes screen opens a
  // divider that is no longer there.
  if (entityType === 'classe') {
    if (state.activeClasseId === entityId) patch.activeClasseId = null
    if (state.principalClasseId === entityId) patch.principalClasseId = null
  }
  return patch
}
