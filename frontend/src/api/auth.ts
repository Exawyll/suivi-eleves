import { ApiError, apiRequest } from '@/api/client'

/** Typed calls to the account API. No component ever calls `fetch` itself. */

export interface ApiUser {
  id: string
  email: string
  firstName: string
  lastName: string
  recoveryEnabled: boolean
}

export interface ApiCryptoMaterial {
  kdfSalt: string
  kdfIterations: number
  wrappedDek: string
  dekNonce: string
}

export interface ApiSession {
  accessToken: string
  refreshToken: string
  tokenType: 'Bearer'
  user: ApiUser
  crypto: ApiCryptoMaterial
}

export interface ApiKdfParams {
  kdfSalt: string
  kdfIterations: number
}

export function fetchKdfParams(email: string): Promise<ApiKdfParams> {
  return apiRequest<ApiKdfParams>(`/auth/kdf-params?email=${encodeURIComponent(email)}`, {
    anonymous: true,
  })
}

/**
 * A 200 is not a promise of the right shape.
 *
 * Everything an account needs to be reopened arrives in this one response —
 * the wrapped data key, its nonce, the salt and the iteration count. A field
 * quietly missing would be written to the device as `undefined` and the carnet
 * would refuse to open afterwards, with nothing left to say why. Better to
 * fail here, before anything is stored.
 */
function isApiSession(body: unknown): body is ApiSession {
  if (body === null || typeof body !== 'object') return false
  const { accessToken, refreshToken, user, crypto: material } = body as Record<string, unknown>
  if (typeof accessToken !== 'string' || accessToken === '') return false
  if (typeof refreshToken !== 'string' || refreshToken === '') return false
  if (user === null || typeof user !== 'object') return false
  if (typeof (user as Record<string, unknown>).id !== 'string') return false
  if (material === null || typeof material !== 'object') return false
  const { kdfSalt, kdfIterations, wrappedDek, dekNonce } = material as Record<string, unknown>
  return (
    typeof kdfSalt === 'string' &&
    kdfSalt !== '' &&
    typeof kdfIterations === 'number' &&
    typeof wrappedDek === 'string' &&
    wrappedDek !== '' &&
    typeof dekNonce === 'string' &&
    dekNonce !== ''
  )
}

function asSession(body: unknown): ApiSession {
  if (!isApiSession(body)) throw new ApiError(502, 'Réponse inattendue du serveur.')
  return body
}

export interface SignupPayload extends ApiCryptoMaterial {
  email: string
  firstName: string
  lastName: string
  authSecret: string
}

export async function signupRequest(payload: SignupPayload): Promise<ApiSession> {
  return asSession(
    await apiRequest<unknown>('/auth/signup', {
      method: 'POST',
      body: payload,
      anonymous: true,
    }),
  )
}

export async function loginRequest(email: string, authSecret: string): Promise<ApiSession> {
  return asSession(
    await apiRequest<unknown>('/auth/login', {
      method: 'POST',
      body: { email, authSecret },
      anonymous: true,
    }),
  )
}

export function logoutRequest(refreshToken: string): Promise<void> {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    anonymous: true,
  })
}

export interface ApiRecoveryMaterial {
  wrappedDekRecovery: string
  dekNonceRecovery: string
}

export interface SetupRecoveryPayload {
  recoveryAuthSecret: string
  wrappedDekRecovery: string
  dekNonceRecovery: string
}

/** Requires a session — the bearer is attached the same way every other
 * authenticated call gets one, via `apiRequest`'s own hooks. */
export function setupRecoveryRequest(payload: SetupRecoveryPayload): Promise<void> {
  return apiRequest<void>('/auth/recovery/setup', { method: 'POST', body: payload })
}

export function startRecoveryRequest(
  email: string,
  recoveryAuthSecret: string,
): Promise<ApiRecoveryMaterial> {
  return apiRequest<ApiRecoveryMaterial>('/auth/recovery/start', {
    method: 'POST',
    body: { email, recoveryAuthSecret },
    anonymous: true,
  })
}

export interface CompleteRecoveryPayload {
  email: string
  recoveryAuthSecret: string
  newAuthSecret: string
  newRecoveryAuthSecret: string
  newWrappedDekRecovery: string
  newDekNonceRecovery: string
}

export async function completeRecoveryRequest(
  payload: CompleteRecoveryPayload & ApiCryptoMaterial,
): Promise<ApiSession> {
  return asSession(
    await apiRequest<unknown>('/auth/recovery/complete', {
      method: 'POST',
      body: payload,
      anonymous: true,
    }),
  )
}
