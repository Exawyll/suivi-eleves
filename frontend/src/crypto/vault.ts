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

export async function wrapDataKey(dek: CryptoKey, kek: CryptoKey): Promise<WrappedDataKey> {
  const nonce = crypto.getRandomValues(new Uint8Array(DEK_NONCE_BYTES))
  const wrapped = await crypto.subtle.wrapKey('raw', dek, kek, {
    name: 'AES-GCM',
    iv: nonce as BufferSource,
  })
  return { wrappedDek: bytesToBase64(new Uint8Array(wrapped)), dekNonce: bytesToBase64(nonce) }
}

/** Throws if the password was wrong: AES-GCM authentication fails, loudly. */
export async function unwrapDataKey(wrapped: WrappedDataKey, kek: CryptoKey): Promise<CryptoKey> {
  return crypto.subtle.unwrapKey(
    'raw',
    base64ToBytes(wrapped.wrappedDek) as BufferSource,
    kek,
    { name: 'AES-GCM', iv: base64ToBytes(wrapped.dekNonce) as BufferSource },
    { name: 'AES-GCM' },
    // Not extractable from here on: nothing in the app needs the raw bytes
    // again, and a key that cannot be read cannot be exfiltrated by a script.
    false,
    DEK_USAGES,
  )
}
