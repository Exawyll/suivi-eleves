import { createJSONStorage } from 'zustand/middleware'
import { createEncryptedStorage } from '@/store/encryptedStorage'
import { createMemoryStorage, resolveDefaultStorage } from '@/store/memoryStorage'
import { emptyDomainState, useAppStore, vaultKeyFor, type DomainState } from '@/store/useAppStore'

/**
 * Where the carnet store is pointed, and — more delicately — where it stops
 * being pointed.
 *
 * Kept apart from the auth store because the detach is the single most
 * destructive line in the feature: resetting the state while persistence still
 * aims at the account's vault writes the empty state straight over the carnet,
 * so signing out would destroy the notes it exists to protect. Here it can be
 * tested directly.
 */

const SIGNED_OUT_KEY = 'carnet:vault:signed-out'
const WRITE_CONFIRM_ATTEMPTS = 50

/**
 * Waits for the store's first write to actually reach the device.
 *
 * Persistence writes on state change but exposes no promise for it, and
 * encrypting is asynchronous — so the write is still in flight when
 * `setState` returns. Sign-up deletes the plain-text carnet immediately
 * afterwards: doing that on the strength of a write that had not landed would
 * lose a real teacher's notes if the tab closed in between.
 */
async function confirmVaultWritten(userId: string, dek: CryptoKey): Promise<boolean> {
  const storage = createEncryptedStorage(dek, resolveDefaultStorage())
  for (let attempt = 0; attempt < WRITE_CONFIRM_ATTEMPTS; attempt += 1) {
    if ((await storage.getItem(vaultKeyFor(userId))) !== null) return true
    await new Promise((resolve) => setTimeout(resolve, 10))
  }
  return false
}

/**
 * Opens one account's vault. `initial` is passed only when there is nothing to
 * read yet — a new account, starting from the demo carnet or from the one
 * adopted from before accounts existed.
 */
export async function attachVault(
  userId: string,
  dek: CryptoKey,
  initial?: DomainState,
): Promise<boolean> {
  useAppStore.persist.setOptions({
    name: vaultKeyFor(userId),
    storage: createJSONStorage(() => createEncryptedStorage(dek, resolveDefaultStorage())),
  })

  if (initial === undefined) {
    await useAppStore.persist.rehydrate()
    return true
  }

  useAppStore.setState(initial)
  // Reported rather than assumed: the caller decides what to do about a vault
  // that did not get written, and only one caller has anything at stake.
  return confirmVaultWritten(userId, dek)
}

/**
 * Closes the vault and empties the screen.
 *
 * The order is the whole point: persistence is aimed at a throwaway store
 * *before* the state is cleared, so the write that follows lands nowhere. The
 * encrypted carnet stays on the device, unreadable until the password reopens
 * it.
 */
export function detachVault(): void {
  useAppStore.persist.setOptions({
    name: SIGNED_OUT_KEY,
    storage: createJSONStorage(() => createMemoryStorage()),
  })
  useAppStore.setState(emptyDomainState())
}
