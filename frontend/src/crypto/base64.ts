/** Base64 helpers. The API speaks base64 for every byte string it exchanges. */

export function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  // Chunked rather than `String.fromCharCode(...bytes)`: spreading a large
  // carnet's worth of bytes into arguments overflows the call stack.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

export function base64ToBytes(value: string): Uint8Array {
  const binary = atob(value)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes
}
