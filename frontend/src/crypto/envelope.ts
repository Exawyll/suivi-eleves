import { base64ToBytes, bytesToBase64 } from '@/crypto/base64'

/**
 * One encrypted record, as the server stores it.
 *
 * The additional data binds the ciphertext to the record it belongs to, so a
 * server that moved an envelope from one entity to another would produce
 * something that no longer decrypts, rather than a silent substitution.
 */

const NONCE_BYTES = 12

export interface Envelope {
  ciphertext: string
  nonce: string
}

function additionalData(entityType: string, entityId: string): Uint8Array {
  return new TextEncoder().encode(`${entityType}:${entityId}`)
}

export async function sealRecord(
  dek: CryptoKey,
  entityType: string,
  entityId: string,
  entity: unknown,
): Promise<Envelope> {
  const nonce = crypto.getRandomValues(new Uint8Array(NONCE_BYTES))
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: nonce as BufferSource,
      additionalData: additionalData(entityType, entityId) as BufferSource,
    },
    dek,
    new TextEncoder().encode(JSON.stringify(entity)),
  )
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), nonce: bytesToBase64(nonce) }
}

/** Throws if the envelope was tampered with, or does not belong to this record. */
export async function openRecord<T>(
  dek: CryptoKey,
  entityType: string,
  entityId: string,
  envelope: Envelope,
): Promise<T> {
  const plaintext = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: base64ToBytes(envelope.nonce) as BufferSource,
      additionalData: additionalData(entityType, entityId) as BufferSource,
    },
    dek,
    base64ToBytes(envelope.ciphertext) as BufferSource,
  )
  return JSON.parse(new TextDecoder().decode(plaintext)) as T
}
