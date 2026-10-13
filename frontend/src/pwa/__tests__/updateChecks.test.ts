import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { startUpdateChecks, UPDATE_CHECK_INTERVAL_MS } from '@/pwa/updateChecks'

function setup({ online = true, installing = null as unknown } = {}) {
  const registration = { update: vi.fn<() => Promise<void>>(() => Promise.resolve()), installing }
  const env = { document, window, isOnline: () => online }
  const stop = startUpdateChecks(registration, env)
  return { registration, stop }
}

function setVisibility(state: DocumentVisibilityState) {
  Object.defineProperty(document, 'visibilityState', { value: state, configurable: true })
  document.dispatchEvent(new Event('visibilitychange'))
}

describe('vérification des mises à jour de la PWA', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => {
    vi.useRealTimers()
    setVisibility('visible')
  })

  it('vérifie quand l’appli revient au premier plan, pas quand elle passe en arrière-plan', () => {
    const { registration, stop } = setup()

    setVisibility('hidden')
    expect(registration.update).not.toHaveBeenCalled()

    setVisibility('visible')
    expect(registration.update).toHaveBeenCalledTimes(1)
    stop()
  })

  it('vérifie au retour du réseau', () => {
    const { registration, stop } = setup()

    window.dispatchEvent(new Event('online'))

    expect(registration.update).toHaveBeenCalledTimes(1)
    stop()
  })

  it('vérifie toutes les heures', () => {
    const { registration, stop } = setup()

    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS * 2)

    expect(registration.update).toHaveBeenCalledTimes(2)
    stop()
  })

  it('ne vérifie pas hors ligne ni pendant une installation déjà en cours', () => {
    const offline = setup({ online: false })
    const installing = setup({ installing: {} })

    setVisibility('visible')

    expect(offline.registration.update).not.toHaveBeenCalled()
    expect(installing.registration.update).not.toHaveBeenCalled()
    offline.stop()
    installing.stop()
  })

  it('avale l’échec d’une vérification sans rejet non géré', async () => {
    const registration = {
      update: vi.fn<() => Promise<void>>(() => Promise.reject(new Error('réseau'))),
      installing: null,
    }
    const stop = startUpdateChecks(registration, { document, window, isOnline: () => true })

    setVisibility('visible')
    await Promise.resolve()

    expect(registration.update).toHaveBeenCalledTimes(1)
    stop()
  })

  it('ne vérifie plus une fois arrêtée', () => {
    const { registration, stop } = setup()
    stop()

    setVisibility('visible')
    window.dispatchEvent(new Event('online'))
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS)

    expect(registration.update).not.toHaveBeenCalled()
  })
})
