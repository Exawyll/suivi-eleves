import { apiRequest } from '@/api/client'

/** Typed calls to the account API. No component ever calls `fetch` itself. */

export interface ApiUser {
  id: string
  email: string
  firstName: string
  lastName: string
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

export interface SignupPayload extends ApiCryptoMaterial {
  email: string
  firstName: string
  lastName: string
  authSecret: string
}

export function signupRequest(payload: SignupPayload): Promise<ApiSession> {
  return apiRequest<ApiSession>('/auth/signup', {
    method: 'POST',
    body: payload,
    anonymous: true,
  })
}

export function loginRequest(email: string, authSecret: string): Promise<ApiSession> {
  return apiRequest<ApiSession>('/auth/login', {
    method: 'POST',
    body: { email, authSecret },
    anonymous: true,
  })
}

export function logoutRequest(refreshToken: string): Promise<void> {
  return apiRequest<void>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
    anonymous: true,
  })
}
