import { useAppStore, type AppState } from '@/store/useAppStore'
import { refreshPendingCount, requestSync } from '@/sync/syncEngine'
import { useSyncStore } from '@/sync/useSyncStore'

/**
 * When to synchronise.
 *
 * The engine says how; this says when, and the two are kept apart because the
 * "when" is entirely about the shape of a teaching day: the app is opened,
 * used in bursts between two classes, put away, and carried through corridors
 * with no signal. So: on unlock, whenever the connection comes back, on
 * returning to the app, a few seconds after a change, and a slow heartbeat for
 * everything else.
 */

/** Long enough to gather a burst of entries into one push, short enough to feel live. */
const MUTATION_DEBOUNCE_MS = 3_000
const HEARTBEAT_MS = 5 * 60_000
const BACKOFF_BASE_MS = 5_000
const BACKOFF_CEILING_MS = 5 * 60_000

let failures = 0
let nextAttemptAt = 0
let debounce: ReturnType<typeof setTimeout> | null = null

function countOwed(state: AppState): number {
  return Object.values(state.syncMeta).filter((meta) => meta.dirty).length
}

/**
 * Runs a round unless a failed one is still cooling off.
 *
 * `force` is for the triggers that carry real news — the connection came back,
 * the teacher just unlocked — where waiting out a backoff computed from a
 * failure that is no longer true would only add delay.
 */
async function attempt(force = false): Promise<void> {
  if (!force && Date.now() < nextAttemptAt) return

  await requestSync()

  if (useSyncStore.getState().phase === 'idle') {
    failures = 0
    nextAttemptAt = 0
    return
  }
  failures += 1
  nextAttemptAt =
    Date.now() + Math.min(BACKOFF_CEILING_MS, BACKOFF_BASE_MS * 2 ** Math.min(failures - 1, 10))
}

/**
 * Starts synchronising, and returns the way to stop.
 *
 * Called when a carnet is unlocked and torn down when it is closed: a listener
 * outliving the account it belongs to would push one teacher's carnet under
 * whoever signed in next.
 */
export function startSyncTriggers(): () => void {
  let stopped = false

  const run = (force = false) => {
    if (!stopped) void attempt(force)
  }

  const onOnline = () => run(true)
  const onVisible = () => {
    if (document.visibilityState === 'visible') run()
  }

  // Only a *rise* in what is owed means the teacher wrote something. The
  // engine's own writes lower it or leave it alone, so this cannot feed itself
  // a sync every three seconds for ever.
  let owed = countOwed(useAppStore.getState())
  const unsubscribe = useAppStore.subscribe((state) => {
    const now = countOwed(state)
    const rose = now > owed
    owed = now
    refreshPendingCount()
    if (!rose) return
    if (debounce !== null) clearTimeout(debounce)
    debounce = setTimeout(() => {
      debounce = null
      run()
    }, MUTATION_DEBOUNCE_MS)
  })

  window.addEventListener('online', onOnline)
  document.addEventListener('visibilitychange', onVisible)
  const heartbeat = setInterval(() => run(), HEARTBEAT_MS)

  refreshPendingCount()
  run(true)

  return () => {
    stopped = true
    unsubscribe()
    window.removeEventListener('online', onOnline)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(heartbeat)
    if (debounce !== null) clearTimeout(debounce)
    debounce = null
    failures = 0
    nextAttemptAt = 0
  }
}
