import type { StateStorage } from 'zustand/middleware'
import { base64ToBytes, bytesToBase64 } from '@/crypto/base64'

/**
 * A `StateStorage` that encrypts everything it writes with the account's data
 * key.
 *
 * Without this the end-to-end encryption would be theatre: the server would
 * hold unreadable envelopes while the whole carnet sat in plain text in
 * localStorage, readable from the devtools by anyone holding the device — and
 * by the *other* account sharing the browser.
 */

const NONCE_BYTES = 12
const SEPARATOR = '.'

export function createEncryptedStorage(dek: CryptoKey, backing: StateStorage): StateStorage {
  return {
    async getItem(name) {
      const stored = await backing.getItem(name)
      if (stored === null) return null

      const [nonce, ciphertext] = stored.split(SEPARATOR)
      if (nonce === undefined || ciphertext === undefined) return null

      try {
        const plaintext = await crypto.subtle.decrypt(
          { name: 'AES-GCM', iv: base64ToBytes(nonce) as BufferSource },
          dek,
          base64ToBytes(ciphertext) as BufferSource,
        )
        return new TextDecoder().decode(plaintext)
      } catch {
        // Wrong key, or a corrupted blob. Reporting "nothing stored" lets the
        // app start; deliberately without removing the blob, so a later
        // unlock with the right key can still recover it.
        return null
      }
    },

    async setItem(name, value) {
      const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: nonce as BufferSource },
        dek,
        new TextEncoder().encode(value),
      )
      await backing.setItem(
        name,
        `${bytesToBase64(nonce)}${SEPARATOR}${bytesToBase64(new Uint8Array(ciphertext))}`,
      )
    },

    async removeItem(name) {
      await backing.removeItem(name)
    },
  }
}
