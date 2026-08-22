import { resolveDefaultStorage } from '@/store/memoryStorage'
import type { DomainState } from '@/store/useAppStore'

/**
 * The carnet written before accounts existed, in plain text under a single
 * global key.
 *
 * A teacher who has been using the app has real notes in there. Signing up
 * must adopt them rather than replace them with a demo — and once they are
 * safely inside the encrypted vault, the plain copy has to go, or it sits on
 * the device for ever, readable, defeating the point.
 */

export const LEGACY_STORAGE_KEY = 'suivi-eleves:v1'

interface PersistedEnvelope {
  state?: Partial<DomainState>
}

function isNonEmpty(state: Partial<DomainState>): boolean {
  return (
    (state.etablissements?.length ?? 0) > 0 ||
    (state.classes?.length ?? 0) > 0 ||
    (state.eleves?.length ?? 0) > 0 ||
    (state.events?.length ?? 0) > 0
  )
}

/** Returns the previous carnet, or null if there is nothing worth adopting. */
export function readLegacyCarnet(): DomainState | null {
  // Through the resolver rather than the global: `localStorage` is not always
  // there to be touched, and Node exposes an experimental Web Storage global
  // that reads as undefined.
  let raw: string | null
  try {
    raw = resolveDefaultStorage().getItem(LEGACY_STORAGE_KEY)
  } catch {
    return null
  }
  if (raw === null) return null

  let parsed: PersistedEnvelope
  try {
    parsed = JSON.parse(raw) as PersistedEnvelope
  } catch {
    return null
  }

  const state = parsed.state
  if (!state || !isNonEmpty(state)) return null

  return {
    etablissements: state.etablissements ?? [],
    classes: state.classes ?? [],
    eleves: state.eleves ?? [],
    tagCategories: state.tagCategories ?? [],
    tags: state.tags ?? [],
    events: state.events ?? [],
    hasSeeded: true,
    activeClasseId: state.activeClasseId ?? state.classes?.[0]?.id ?? null,
    principalClasseId: state.principalClasseId ?? null,
  }
}

/** Call only once the same carnet is safely inside the encrypted vault. */
export function discardLegacyCarnet(): void {
  try {
    resolveDefaultStorage().removeItem(LEGACY_STORAGE_KEY)
  } catch {
    // Nothing to do: if it cannot be removed it could not have been read.
  }
}
