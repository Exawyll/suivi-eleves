import { OfflineError } from '@/api/client'
import {
  MAX_RECORDS_PER_PUSH,
  pullChanges,
  pushChanges,
  type PushRecord,
  type RecordEnvelope,
} from '@/api/sync'
import { openRecord, sealRecord } from '@/crypto/envelope'
import { recallDataKey } from '@/crypto/deviceKeyStore'
import { syncKey, type SyncEntityType, type SyncRecordMeta } from '@/store/syncMeta'
import { useAppStore, type AppState } from '@/store/useAppStore'
import { useAuthStore } from '@/store/useAuthStore'
import { applyRecord, readRecord, removeRecord } from '@/sync/carnetRecords'
import { useSyncStore } from '@/sync/useSyncStore'

/**
 * One round of synchronisation: pull what changed elsewhere, apply it, push
 * what this device owes, repeat while either side still has more.
 *
 * Pulling first is deliberate. Applying other devices' work before pushing
 * means fewer records reach the server already outranked, so fewer come back
 * as conflicts — and a conflict, however well handled, is a change the teacher
 * made that something else overwrote.
 */

/** A round that keeps finding more work eventually stops. See `runOnce`. */
const MAX_ROUNDS = 20

interface Decoded {
  entityType: SyncEntityType
  entityId: string
  revision: number
  clientUpdatedAt: string
  deleted: boolean
  /** The decrypted body. Absent on a tombstone, and on anything unreadable. */
  value?: unknown
  readable: boolean
}

async function decode(dek: CryptoKey, envelope: RecordEnvelope): Promise<Decoded> {
  const { entityType, entityId, revision, clientUpdatedAt, deleted } = envelope
  const head = { entityType, entityId, revision, clientUpdatedAt, deleted }
  if (deleted) return { ...head, readable: true }
  if (envelope.ciphertext === null || envelope.nonce === null) return { ...head, readable: false }

  try {
    const value = await openRecord<unknown>(dek, entityType, entityId, {
      ciphertext: envelope.ciphertext,
      nonce: envelope.nonce,
    })
    return { ...head, value, readable: true }
  } catch {
    // Wrong key, or an envelope that does not belong to this record. Applying
    // anything here would be guessing at a teacher's data.
    return { ...head, readable: false }
  }
}

/**
 * Writes a decoded page into the carnet, in one go.
 *
 * Read the whole thing as one rule: **the newest write wins, and a local
 * change that has not been sent yet is never thrown away silently.** The
 * comparison happens inside `setState`, against the state as it is at that
 * instant — which is what makes a mutation the teacher made while the page was
 * in flight survive it.
 */
function applyDecoded(decoded: Decoded[], cursor: number | null): void {
  useAppStore.setState((state) => {
    let patch: Partial<AppState> = {}
    const syncMeta: Record<string, SyncRecordMeta> = { ...state.syncMeta }
    const tombstones = { ...state.tombstones }
    let merged: AppState = state

    for (const record of decoded) {
      const key = syncKey(record.entityType, record.entityId)
      const local = syncMeta[key]

      // Unreadable: leave the carnet alone, and leave anything owed still
      // owed. The revision is not recorded either — this device cannot claim
      // to hold a version it could not read.
      if (!record.readable) continue

      // A local change newer than the server's stays, and stays owed. The
      // revision is taken all the same: it is what the next push sends as
      // `baseRevision`, and with it the server accepts the overwrite outright
      // instead of arbitrating a conflict it would lose anyway.
      if (local?.dirty === true && local.updatedAt > record.clientUpdatedAt) {
        syncMeta[key] = { ...local, revision: record.revision }
        continue
      }

      const change = record.deleted
        ? removeRecord(merged, record.entityType, record.entityId)
        : applyRecord(merged, record.entityType, record.entityId, record.value)
      merged = { ...merged, ...change }
      patch = { ...patch, ...change }

      syncMeta[key] = {
        updatedAt: record.clientUpdatedAt,
        revision: record.revision,
        dirty: false,
      }
      // The deletion is on the server now; this device has nothing left to
      // tell anyone about it.
      delete tombstones[key]
    }

    return {
      ...patch,
      syncMeta,
      tombstones,
      ...(cursor === null ? {} : { cursor }),
    }
  })
}

/** Everything this device owes, oldest change first, capped to one push. */
function owedRecords(state: AppState): Array<{ key: string; meta: SyncRecordMeta }> {
  return Object.entries(state.syncMeta)
    .filter(([, meta]) => meta.dirty)
    .sort(([, a], [, b]) => a.updatedAt.localeCompare(b.updatedAt))
    .slice(0, MAX_RECORDS_PER_PUSH)
    .map(([key, meta]) => ({ key, meta }))
}

function pendingCount(state: AppState): number {
  return Object.values(state.syncMeta).filter((meta) => meta.dirty).length
}

async function buildPush(dek: CryptoKey, state: AppState): Promise<PushRecord[]> {
  const records: PushRecord[] = []

  for (const { key, meta } of owedRecords(state)) {
    const tombstone = state.tombstones[key]
    if (tombstone !== undefined) {
      records.push({
        entityType: tombstone.entityType,
        entityId: tombstone.entityId,
        baseRevision: meta.revision,
        clientUpdatedAt: meta.updatedAt,
        deleted: true,
      })
      continue
    }

    const separator = key.indexOf(':')
    const entityType = key.slice(0, separator) as SyncEntityType
    const entityId = key.slice(separator + 1)
    const entity = readRecord(state, entityType, entityId)
    // Owed but no longer in the carnet and with no tombstone either: nothing
    // to send, and nothing to say about it. Skipped rather than guessed at.
    if (entity === null) continue

    const envelope = await sealRecord(dek, entityType, entityId, entity)
    records.push({
      entityType,
      entityId,
      baseRevision: meta.revision,
      clientUpdatedAt: meta.updatedAt,
      deleted: false,
      ...envelope,
    })
  }

  return records
}

/**
 * Records the server's verdict on what was just pushed.
 *
 * The one thing this must never do is clear `dirty` on a record the teacher
 * changed again while the push was in the air: the server holds the version
 * from before that change, and calling it synchronised would strand the newer
 * one on the device for good. So a record is only marked clean if it still
 * carries the exact timestamp that was sent.
 */
function applyPushResult(sent: PushRecord[], assigned: Map<string, number>): void {
  useAppStore.setState((state) => {
    const syncMeta = { ...state.syncMeta }
    const tombstones = { ...state.tombstones }

    for (const record of sent) {
      const key = syncKey(record.entityType, record.entityId)
      const revision = assigned.get(key)
      if (revision === undefined) continue

      const local = syncMeta[key]
      if (local === undefined) continue

      if (local.updatedAt !== record.clientUpdatedAt) {
        // Touched again since. The server's revision is still the truth about
        // what it holds, so keep it — the next push builds on it.
        syncMeta[key] = { ...local, revision }
        continue
      }

      syncMeta[key] = { updatedAt: local.updatedAt, revision, dirty: false }
      if (record.deleted) delete tombstones[key]
    }

    return { syncMeta, tombstones }
  })
}

/** Pulls page after page until the server says there is nothing left. */
async function pullEverything(dek: CryptoKey): Promise<void> {
  for (let page = 0; page < MAX_ROUNDS; page += 1) {
    const since = useAppStore.getState().cursor
    const response = await pullChanges(since)
    const decoded = await Promise.all(response.records.map((one) => decode(dek, one)))
    applyDecoded(decoded, response.nextCursor)
    if (!response.hasMore) return
  }
}

/** Pushes batch after batch until nothing is owed, or until it stops helping. */
async function pushEverything(dek: CryptoKey): Promise<void> {
  for (let batch = 0; batch < MAX_ROUNDS; batch += 1) {
    const before = pendingCount(useAppStore.getState())
    if (before === 0) return

    const records = await buildPush(dek, useAppStore.getState())
    if (records.length === 0) return

    const response = await pushChanges(records)
    const assigned = new Map(
      response.applied.map((one) => [syncKey(one.entityType, one.entityId), one.revision]),
    )
    applyPushResult(records, assigned)

    // The server kept its own version of these: apply them, which is the whole
    // of what "the client resolves the conflict" means here.
    const decoded = await Promise.all(response.conflicts.map((one) => decode(dek, one)))
    // No cursor: a push never moves it. Doing so would skip every record
    // another device pushed that this one has not pulled yet.
    applyDecoded(decoded, null)

    if (pendingCount(useAppStore.getState()) >= before) return
  }
}

let inFlight: Promise<void> | null = null

/**
 * Runs one round, unless one is already running.
 *
 * A single round at a time is not a nicety: two rounds racing would each build
 * a push from a carnet the other is halfway through writing, and the later one
 * would clear `dirty` on records whose newer version the earlier one never
 * sent.
 */
export function requestSync(): Promise<void> {
  inFlight ??= runOnce().finally(() => {
    inFlight = null
  })
  return inFlight
}

async function runOnce(): Promise<void> {
  const auth = useAuthStore.getState()
  // Nothing to sync to. `needsReauth` is the important one: without it the
  // engine would spend every trigger walking into a 401 it already knows about.
  if (auth.status !== 'unlocked' || auth.session === null || auth.needsReauth) return

  const dek = await recallDataKey(auth.session.userId)
  // The carnet is open but the key is not on this device — nothing here can be
  // encrypted or read.
  if (dek === null) return

  useSyncStore.setState({ phase: 'syncing', error: null })

  try {
    await pullEverything(dek)
    await pushEverything(dek)
    useSyncStore.setState({
      phase: 'idle',
      lastSyncedAt: new Date().toISOString(),
      pendingCount: pendingCount(useAppStore.getState()),
      error: null,
    })
  } catch (error) {
    // Offline is not a failure worth alarming anyone about: the carnet is
    // whole, the changes are kept, and they leave on the next connection.
    useSyncStore.setState({
      phase: error instanceof OfflineError ? 'offline' : 'error',
      pendingCount: pendingCount(useAppStore.getState()),
      error: error instanceof OfflineError ? null : 'La synchronisation a échoué.',
    })
  }
}

/** Exposed for the triggers and the tests; the engine keeps it current itself. */
export function refreshPendingCount(): void {
  useSyncStore.setState({ pendingCount: pendingCount(useAppStore.getState()) })
}
