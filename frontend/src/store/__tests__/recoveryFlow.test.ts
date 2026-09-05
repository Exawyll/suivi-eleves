import { beforeEach, describe, expect, it, vi } from 'vitest'
import type {
  ApiCryptoMaterial,
  ApiRecoveryMaterial,
  ApiSession,
  CompleteRecoveryPayload,
} from '@/api/auth'

type FakeCompleteRecoveryRequest = CompleteRecoveryPayload & ApiCryptoMaterial

/**
 * The network and the on-device key store are mocked; the crypto is real,
 * the same choice `syncEngine.test.ts` makes — what is worth testing here is
 * the wiring between the two recovery calls, not WebCrypto itself.
 */

const setupRecoveryRequest = vi.fn<() => Promise<void>>()
const startRecoveryRequest =
  vi.fn<(email: string, secret: string) => Promise<ApiRecoveryMaterial>>()
const completeRecoveryRequest =
  vi.fn<(payload: FakeCompleteRecoveryRequest) => Promise<ApiSession>>()

vi.mock('@/api/auth', async (original) => ({
  ...(await original<typeof import('@/api/auth')>()),
  setupRecoveryRequest,
  startRecoveryRequest,
  completeRecoveryRequest,
}))

vi.mock('@/crypto/deviceKeyStore', () => ({
  rememberDataKey: vi.fn<(userId: string, dek: CryptoKey) => Promise<void>>(async () => undefined),
  recallDataKey: vi.fn<(userId: string) => Promise<CryptoKey | null>>(async () => null),
  forgetDataKey: vi.fn<(userId: string) => Promise<boolean>>(async () => true),
}))

const { useAuthStore } = await import('@/store/useAuthStore')
const { generateDataKey, wrapDataKey } = await import('@/crypto/vault')
const { deriveRecoveryCredentials } = await import('@/crypto/kdf')
const { encodeRecoveryKey, randomRecoveryKey } = await import('@/crypto/recoveryKey')

beforeEach(() => {
  setupRecoveryRequest.mockReset()
  startRecoveryRequest.mockReset()
  completeRecoveryRequest.mockReset()
  useAuthStore.setState({
    status: 'anonymous',
    session: null,
    error: null,
    busy: false,
    needsReauth: false,
    pendingRecoveryKey: null,
    recoveryEmail: null,
  })
})

describe('récupération de compte', () => {
  it('refuse une clé mal formée sans jamais appeler le serveur', async () => {
    await expect(
      useAuthStore.getState().startRecovery('prof@ecole.fr', 'ceci-nest-pas-une-cle'),
    ).rejects.toThrow('invalide')

    expect(startRecoveryRequest).not.toHaveBeenCalled()
    expect(useAuthStore.getState().error).toBe('Clé de récupération invalide.')
  })

  it('ne complète rien sans un `startRecovery` réussi avant', async () => {
    await useAuthStore.getState().completeRecovery('nouveau mot de passe')

    expect(completeRecoveryRequest).not.toHaveBeenCalled()
    expect(useAuthStore.getState().error).toBe('Aucune récupération en cours.')
  })

  it('déverrouille le carnet et fournit une nouvelle clé après une récupération complète', async () => {
    const recoveryKeyBytes = randomRecoveryKey()
    const { kek: recoveryKek } = await deriveRecoveryCredentials(recoveryKeyBytes)
    const dek = await generateDataKey()
    const wrapped = await wrapDataKey(dek, recoveryKek)

    startRecoveryRequest.mockResolvedValue({
      wrappedDekRecovery: wrapped.wrappedDek,
      dekNonceRecovery: wrapped.dekNonce,
    })
    completeRecoveryRequest.mockImplementation(async (payload: FakeCompleteRecoveryRequest) => ({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
      tokenType: 'Bearer' as const,
      user: {
        id: 'u1',
        email: payload.email,
        firstName: 'Camille',
        lastName: 'Roy',
        recoveryEnabled: true,
      },
      crypto: {
        kdfSalt: payload.kdfSalt,
        kdfIterations: payload.kdfIterations,
        wrappedDek: payload.wrappedDek,
        dekNonce: payload.dekNonce,
      },
    }))

    await useAuthStore
      .getState()
      .startRecovery('Prof@Ecole.fr', encodeRecoveryKey(recoveryKeyBytes))
    expect(useAuthStore.getState().recoveryEmail).toBe('prof@ecole.fr')
    expect(useAuthStore.getState().error).toBeNull()

    const recoveryKeyUsed = encodeRecoveryKey(recoveryKeyBytes)
    await useAuthStore.getState().completeRecovery('nouveau mot de passe')

    const state = useAuthStore.getState()
    expect(completeRecoveryRequest).toHaveBeenCalledTimes(1)
    expect(state.status).toBe('unlocked')
    expect(state.recoveryEmail).toBeNull()
    expect(state.session?.email).toBe('prof@ecole.fr')
    expect(state.session?.recoveryEnabled).toBe(true)
    // The recovery key that was just spent is rotated: what is shown next is
    // not the one that was just typed in.
    expect(state.pendingRecoveryKey).not.toBeNull()
    expect(state.pendingRecoveryKey).not.toBe(recoveryKeyUsed)
  })
})
