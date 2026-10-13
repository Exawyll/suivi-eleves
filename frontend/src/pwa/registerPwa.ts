import { registerSW } from 'virtual:pwa-register'
import { useUpdateStore } from '@/store/useUpdateStore'
import { startUpdateChecks } from './updateChecks'

/**
 * Reloads once `worker` has taken over. Needed when the page has no
 * controlling worker — the first launch after installing the app: switching
 * workers then fires no `controllerchange`, so the plugin's own reload never
 * comes and the tap would do nothing.
 */
function reloadWhenActivated(worker: ServiceWorker): void {
  if (worker.state === 'activated') {
    window.location.reload()
    return
  }
  worker.addEventListener('statechange', () => {
    if (worker.state === 'activated') window.location.reload()
  })
}

/**
 * Registers the service worker in "prompt" mode: a new release is downloaded
 * in the background, but only takes over when the teacher taps the update
 * banner — never in the middle of a note being typed.
 */
export function registerPwa(): void {
  let registration: ServiceWorkerRegistration | undefined

  const updateSW = registerSW({
    onNeedRefresh: () => {
      useUpdateStore.getState().markUpdateReady(() => {
        if (navigator.serviceWorker.controller) {
          // The plugin skips the wait and reloads once the new worker controls the page.
          void updateSW(true)
          return
        }
        // No worker controls this page, so the old one had no clients to hold
        // the new one back: it is usually active already, and a plain reload
        // is all it takes. If it is still waiting, release it first.
        const waiting = registration?.waiting
        if (!waiting) {
          window.location.reload()
          return
        }
        reloadWhenActivated(waiting)
        void updateSW(true)
      })
    },
    onRegisteredSW: (_swUrl, registered) => {
      registration = registered
      if (registered) startUpdateChecks(registered)
    },
  })
}
