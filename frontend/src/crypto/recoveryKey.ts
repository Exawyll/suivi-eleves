/**
 * The recovery key itself: 256 bits of randomness, generated once and shown to
 * the teacher exactly once, in a form meant to be written down or copied — not
 * memorised like a password.
 *
 * Encoded as Crockford-ish base32 (RFC 4648 alphabet, no padding) rather than
 * base64: it excludes characters that are easy to transpose by hand (no
 * `0`/`O`, `1`/`I`/`l`), and is case-insensitive so retyping it from paper
 * cannot fail on capitalisation alone.
 */

export const RECOVERY_KEY_BYTES = 32
const GROUP_SIZE = 5
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const ALPHABET_INDEX = new Map(Array.from(ALPHABET).map((char, i) => [char, i]))

export function randomRecoveryKey(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(RECOVERY_KEY_BYTES))
}

/** `XXXXX-XXXXX-…`, all uppercase — the form shown to the teacher and printed. */
export function encodeRecoveryKey(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let letters = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      bits -= 5
      letters += ALPHABET[(value >>> bits) & 0x1f]
    }
  }
  if (bits > 0) {
    letters += ALPHABET[(value << (5 - bits)) & 0x1f]
  }

  const groups = []
  for (let i = 0; i < letters.length; i += GROUP_SIZE) {
    groups.push(letters.slice(i, i + GROUP_SIZE))
  }
  return groups.join('-')
}

/**
 * The inverse of `encodeRecoveryKey`. Throws on anything that cannot possibly
 * be a recovery key this app generated — wrong length or a character outside
 * the alphabet — so a typo is caught here rather than sent to the server as a
 * doomed guess.
 */
export function decodeRecoveryKey(text: string): Uint8Array {
  const letters = text.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (letters.length !== Math.ceil((RECOVERY_KEY_BYTES * 8) / 5)) {
    throw new Error('Clé de récupération invalide.')
  }

  const bytes: number[] = []
  let bits = 0
  let value = 0
  for (const letter of letters) {
    const index = ALPHABET_INDEX.get(letter)
    if (index === undefined) throw new Error('Clé de récupération invalide.')
    value = (value << 5) | index
    bits += 5
    if (bits >= 8) {
      bits -= 8
      bytes.push((value >>> bits) & 0xff)
    }
  }

  if (bytes.length !== RECOVERY_KEY_BYTES) {
    throw new Error('Clé de récupération invalide.')
  }
  return new Uint8Array(bytes)
}
