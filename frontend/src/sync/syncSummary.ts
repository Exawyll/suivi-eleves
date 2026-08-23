import type { SyncPhase } from '@/sync/useSyncStore'

/**
 * The one sentence the app says about whether the carnet has left the device.
 *
 * Deliberately plain, and never alarming: a phone in a corridor is offline
 * most of the day, and everything written while offline is safe where it is.
 * Even a failure leads with how much is waiting, because that is the half that
 * says nothing was lost.
 *
 * A pure function, apart from the component, so the wording can be pinned down
 * by tests without rendering anything.
 */

/** Relative, because the exact second is never the question being asked. */
function sinceLabel(iso: string, now: number): string {
  const minutes = Math.floor((now - Date.parse(iso)) / 60_000)
  if (minutes < 1) return "à l'instant"
  if (minutes < 60) return `il y a ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `il y a ${hours} h`
  return `il y a ${Math.floor(hours / 24)} j`
}

function pendingLabel(count: number): string {
  return count === 1 ? '1 modification en attente' : `${count} modifications en attente`
}

export function summariseSync(
  phase: SyncPhase,
  lastSyncedAt: string | null,
  pendingCount: number,
  now: number = Date.now(),
): string {
  if (phase === 'syncing') return 'Synchronisation…'
  if (phase === 'error') {
    return pendingCount > 0
      ? `Échec — ${pendingLabel(pendingCount)}`
      : 'Échec de la dernière synchronisation'
  }
  if (phase === 'offline') {
    return pendingCount > 0 ? `Hors ligne — ${pendingLabel(pendingCount)}` : 'Hors ligne'
  }
  if (pendingCount > 0) return pendingLabel(pendingCount)
  if (lastSyncedAt === null) return 'Jamais synchronisé'
  return `À jour — ${sinceLabel(lastSyncedAt, now)}`
}
