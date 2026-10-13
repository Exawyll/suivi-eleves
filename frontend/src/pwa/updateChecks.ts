/** Hourly: a PWA left in the foreground all day still learns about a release. */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000

/** The slice of `ServiceWorkerRegistration` the checks need — kept narrow for testing. */
export interface UpdatableRegistration {
  update: () => Promise<unknown>
  installing: unknown
}

interface UpdateCheckEnv {
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>
  window: Pick<Window, 'addEventListener' | 'removeEventListener' | 'setInterval' | 'clearInterval'>
  isOnline: () => boolean
}

const browserEnv = (): UpdateCheckEnv => ({
  document,
  window,
  isOnline: () => navigator.onLine,
})

/**
 * Asks the browser to look for a new service worker whenever the app comes
 * back to the foreground, reconnects, or has stayed open for an hour.
 *
 * The browser only checks on its own when a page loads. An installed PWA on
 * iOS is resumed from memory rather than reloaded, so without this it can run
 * an old release for days.
 *
 * Returns a function that removes every listener and the timer.
 */
export function startUpdateChecks(
  registration: UpdatableRegistration,
  env: UpdateCheckEnv = browserEnv(),
): () => void {
  const check = () => {
    // Offline the request can only fail; an install in progress is already
    // the check this would trigger.
    if (!env.isOnline() || registration.installing) return
    // A failed check is retried at the next trigger; it must not surface as
    // an unhandled rejection.
    registration.update().catch(() => undefined)
  }

  const onVisibilityChange = () => {
    if (env.document.visibilityState === 'visible') check()
  }

  env.document.addEventListener('visibilitychange', onVisibilityChange)
  env.window.addEventListener('online', check)
  const timer = env.window.setInterval(check, UPDATE_CHECK_INTERVAL_MS)

  return () => {
    env.document.removeEventListener('visibilitychange', onVisibilityChange)
    env.window.removeEventListener('online', check)
    env.window.clearInterval(timer)
  }
}
