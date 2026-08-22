import { create } from 'zustand'

/**
 * What the teacher can be told about synchronisation, and nothing more.
 *
 * Separate from the carnet store on purpose: this is volatile, it is never
 * persisted, and it never travels to the server. It exists so the Settings
 * screen can say something true instead of "Bientôt".
 */

export type SyncPhase = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncState {
  phase: SyncPhase
  /** When the last full round finished, ISO. Null until one has. */
  lastSyncedAt: string | null
  /** Records this device still owes the server. */
  pendingCount: number
  /** Something to show when `phase` is 'error'. */
  error: string | null
}

export const useSyncStore = create<SyncState>()(() => ({
  phase: 'idle',
  lastSyncedAt: null,
  pendingCount: 0,
  error: null,
}))
