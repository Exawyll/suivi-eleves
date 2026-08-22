import { base64ToBytes, bytesToBase64 } from '@/crypto/base64'

/**
 * The data key: generated once per account, wrapped by the password-derived
 * key, and never sent to the server in the clear.
 *
 * Changing the password re-wraps this key and nothing else — which is why a
 * change costs one request rather than re-encrypting an entire carnet.
 */

const DEK_NONCE_BYTES = 12

export interface WrappedDataKey {
  wrappedDek: string
  dekNonce: string
}

const DEK_USAGES: KeyUsage[] = ['encrypt', 'decrypt']

export async function generateDataKey(): Promise<CryptoKey> {
  // Extractable, but only for as long as it takes to wrap it below; what is
  // stored and reloaded later is the non-extractable import.
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, DEK_USAGES)
}

/**
 * Re-wraps the data key under a key derived from a new password.
 *
 * The carnet itself is untouched: it is encrypted with the data key, which
 * does not change. This is why a password change costs one request whatever
 * the carnet weighs.
 */
export async function rewrapDataKey(
  wrapped: WrappedDataKey,
  currentKek: CryptoKey,
  nextKek: CryptoKey,
): Promise<WrappedDataKey> {
  const transient = await unwrapDataKey(wrapped, currentKek, true)
  return wrapDataKey(transient, nextKek)
}

export async function wrapDataKey(dek: CryptoKey, kek: CryptoKey): Promise<WrappedDataKey> {
  const nonce = crypto.getRandomValues(new Uint8Array(DEK_NONCE_BYTES))
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, {
    name: 'AES-GCM',
    iv: nonce as BufferSource,
  })
  return { wrappedDek: bytesToBase64(new Uint8Array(wrapped)), dekNonce: bytesToBase64(nonce) }
}

/**
 * Throws if the password was wrong: AES-GCM authentication fails, loudly.
 *
 * `extractable` is false for the key the app actually keeps — nothing needs
 * its raw bytes again, and a key that cannot be read cannot be exfiltrated by
 * a script.
 *
 * The one exception is changing the password, which has to re-wrap the data
 * key and where `crypto.subtle.wrapKey` refuses a non-extractable one. Rather
 * than keeping an extractable key for ever against that single moment,
 * `rewrapDataKey` unwraps a throwaway copy from the same stored envelope. The
 * kept key stays unreadable.
 */
export async function unwrapDataKey(
  wrapped: WrappedDataKey,
  kek: CryptoKey,
  extractable = false,
): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(wrapped.wrappedDek) as BufferSource,
    kek,
    { name: 'AES-GCM', iv: base64ToBytes(wrapped.dekNonce) as BufferSource },
    { name: 'AES-GCM' },
    extractable,
    DEK_USAGES,
  )
}
