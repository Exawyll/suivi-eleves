import { createEncryptedStorage } from '@/store/encryptedStorage'
import { resolveDefaultStorage } from '@/store/memoryStorage'

/**
 * What survives a reload, and in what form.
 *
 * The session metadata is stored in the clear because a locked device needs it
 * to derive a key at all — it holds no secret: a salt, an iteration count and
 * a wrapped key that is useless without the password. The refresh token is a
 * credential, so it goes in the vault, encrypted with the data key.
 */

export const SESSION_KEY = 'carnet:session'

export interface StoredSession {
  userId: string
  email: string
  firstName: string
  lastName: string
  recoveryEnabled: boolean
  kdfSalt: string
  kdfIterations: number
  wrappedDek: string
  dekNonce: string
}

export function readSession(): StoredSession | null {
  try {
    const raw = resolveDefaultStorage().getItem(SESSION_KEY)
    return raw === null ? null : (JSON.parse(raw) as StoredSession)
  } catch {
    return null
  }
}

export function writeSession(session: StoredSession): void {
  try {
    resolveDefaultStorage().setItem(SESSION_KEY, JSON.stringify(session))
  } catch {
    // Unusable storage means no offline unlock, not a broken app.
  }
}

export function clearSession(): void {
  try {
    resolveDefaultStorage().removeItem(SESSION_KEY)
  } catch {
    // Nothing to do.
  }
}

function tokenKey(userId: string): string {
  return `carnet:tokens:${userId}`
}

export async function readRefreshToken(userId: string, dek: CryptoKey): Promise<string | null> {
  const storage = createEncryptedStorage(dek, resolveDefaultStorage())
  return storage.getItem(tokenKey(userId))
}

export async function writeRefreshToken(
  userId: string,
  dek: CryptoKey,
  refreshToken: string,
): Promise<void> {
  const storage = createEncryptedStorage(dek, resolveDefaultStorage())
  await storage.setItem(tokenKey(userId), refreshToken)
}

export async function clearRefreshToken(userId: string): Promise<void> {
  try {
    resolveDefaultStorage().removeItem(tokenKey(userId))
  } catch {
    // Nothing to do.
  }
}
