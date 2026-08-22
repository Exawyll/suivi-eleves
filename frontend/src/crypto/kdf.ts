import { base64ToBytes, bytesToBase64 } from '@/crypto/base64'

/**
 * Key derivation, entirely in the browser.
 *
 * A password yields a master key, and the master key yields two values that
 * must never be confusable: the secret the server stores a hash of, and the
 * key that unwraps the carnet. Deriving both from the same master with
 * different HKDF info strings means a server that holds one learns nothing
 * about the other.
 */

export const DEFAULT_KDF_ITERATIONS = 600_000
export const MAX_KDF_ITERATIONS = 10_000_000
export const KDF_SALT_BYTES = 16

const AUTH_INFO = 'carnet:auth:v1'
const KEK_INFO = 'carnet:kek:v1'

export function randomKdfSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(KDF_SALT_BYTES))
}

async function deriveMasterKey(password: string, salt: Uint8Array, iterations: number) {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits', 'deriveKey'],
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as BufferSource, iterations, hash: 'SHA-256' },
    material,
    256,
  )
  // Re-imported for HKDF: the master key is never used directly to encrypt.
  return crypto.subtle.importKey('raw', bits, 'HKDF', false, ['deriveBits', 'deriveKey'])
}

async function expand(masterKey: CryptoKey, info: string, bits: number): Promise<ArrayBuffer> {
  return crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      // The PBKDF2 salt already carries the randomness; HKDF's own salt adds
      // nothing here and would have to be stored as well.
      salt: new Uint8Array(0),
      info: new TextEncoder().encode(info),
    },
    masterKey,
    bits,
  )
}

export interface DerivedCredentials {
  /** Sent to the server, which re-hashes it with argon2id. */
  authSecret: string
  /** Never leaves this device. Wraps and unwraps the data key. */
  kek: CryptoKey
}

/**
 * Refuses key-derivation parameters that would weaken or stall the client.
 *
 * The iteration count arrives from the server, and the client cannot verify
 * that it is the one the account was created with. A server answering `1`
 * would get an authSecret derived in microseconds — cheap enough to brute-force
 * back to the password, and from the password it could derive the real KEK. So
 * the floor is enforced here, where the server has no say. The ceiling is the
 * mirror image: a huge count would simply hang the browser.
 */
export function assertUsableKdfParams(iterations: number, salt?: Uint8Array): void {
  if (!Number.isInteger(iterations)) {
    throw new Error('Paramètres de chiffrement invalides.')
  }
  if (iterations < DEFAULT_KDF_ITERATIONS || iterations > MAX_KDF_ITERATIONS) {
    throw new Error('Paramètres de chiffrement refusés par sécurité.')
  }
  // A short or empty salt is the same attack from the other side: it makes the
  // derivation precomputable, so the authSecret this device sends could be
  // looked up rather than cracked.
  if (salt !== undefined && salt.length < KDF_SALT_BYTES) {
    throw new Error('Paramètres de chiffrement refusés par sécurité.')
  }
}

/**
 * Deliberately does not enforce the bounds above: it is the primitive, and the
 * tests exercise it with a cheap count on purpose. The check belongs where the
 * untrusted value enters — see `useAuthStore`, which validates everything the
 * server hands over before deriving anything from it.
 */
export async function deriveCredentials(
  password: string,
  salt: Uint8Array,
  iterations: number = DEFAULT_KDF_ITERATIONS,
): Promise<DerivedCredentials> {
  const masterKey = await deriveMasterKey(password, salt, iterations)
  const authBits = await expand(masterKey, AUTH_INFO, 256)
  const kekBits = await expand(masterKey, KEK_INFO, 256)
  const kek = await crypto.subtle.importKey('raw', kekBits, { name: 'AES-GCM' }, false, [
    'wrapKey',
    'unwrapKey',
    'encrypt',
    'decrypt',
  ])
  return { authSecret: bytesToBase64(new Uint8Array(authBits)), kek }
}

export { base64ToBytes, bytesToBase64 }
