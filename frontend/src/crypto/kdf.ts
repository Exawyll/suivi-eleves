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
