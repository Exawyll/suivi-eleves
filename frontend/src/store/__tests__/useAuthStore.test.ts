import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * The device key store is mocked because the failure that matters here cannot
 * be provoked otherwise: jsdom has no IndexedDB, and the case being tested is
 * a delete that the database accepted and then refused to commit.
 */
const forgetDataKey = vi.fn<(userId: string) => Promise<boolean>>()

vi.mock('@/crypto/deviceKeyStore', () => ({
  forgetDataKey,
  rememberDataKey: vi.fn<(userId: string, dek: CryptoKey) => Promise<void>>(async () => undefined),
  recallDataKey: vi.fn<(userId: string) => Promise<CryptoKey | null>>(async () => null),
}))

const { useAuthStore } = await import('@/store/useAuthStore')
const { readSession, writeSession } = await import('@/store/authPersistence')

const SESSION = {
  userId: 'camille',
  email: 'camille@ecole.fr',
  firstName: 'Camille',
  lastName: 'Roy',
  kdfSalt: 'c2Vs',
  kdfIterations: 600000,
  wrappedDek: 'd3JhcA==',
  dekNonce: 'bm9uY2U=',
}

beforeEach(() => {
  forgetDataKey.mockReset()
  writeSession(SESSION)
  useAuthStore.setState({ status: 'unlocked', session: SESSION, needsReauth: false, error: null })
})

describe('verrouillage', () => {
  it('garde le carnet réouvrable hors ligne quand la clé a bien été effacée', async () => {
    forgetDataKey.mockResolvedValue(true)

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState().status).toBe('locked')
    // The session metadata is what lets the password reopen the carnet with no
    // network at all.
    expect(readSession()?.email).toBe(SESSION.email)
  })

  it('ne fait pas semblant de verrouiller quand la clé n’a pas pu être effacée', async () => {
    // The key is still on the device: left as `locked`, the next launch would
    // recall it and reopen the carnet without ever asking for the password —
    // on a browser the teacher may well be sharing.
    forgetDataKey.mockResolvedValue(false)

    await useAuthStore.getState().logout()

    expect(useAuthStore.getState().status).toBe('anonymous')
    expect(useAuthStore.getState().session).toBeNull()
    // No account left to recall a key for: the lock is real again.
    expect(readSession()).toBeNull()
  })
})
