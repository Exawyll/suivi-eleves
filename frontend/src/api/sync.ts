import { ApiError, apiRequest } from '@/api/client'
import type { SyncEntityType } from '@/store/syncMeta'

/**
 * The synchronisation endpoints.
 *
 * The server stores opaque envelopes and arbitrates on plaintext metadata
 * alone — a revision, a client timestamp, a tombstone flag. It never sees a
 * name, a note or a tag.
 */

/** Server-side ceilings. Exceeding one is a 422, so the engine batches to them. */
export const MAX_RECORDS_PER_PUSH = 500
export const PULL_PAGE_SIZE = 200

export interface PushRecord {
  entityType: SyncEntityType
  entityId: string
  /** The revision this device last saw. Null on a record it believes is new. */
  baseRevision: number | null
  clientUpdatedAt: string
  deleted: boolean
  ciphertext?: string
  nonce?: string
}

export interface RecordEnvelope {
  entityType: SyncEntityType
  entityId: string
  revision: number
  clientUpdatedAt: string
  deleted: boolean
  ciphertext: string | null
  nonce: string | null
}

export interface AppliedRecord {
  entityType: SyncEntityType
  entityId: string
  revision: number
}

export interface PullResponse {
  records: RecordEnvelope[]
  nextCursor: number
  hasMore: boolean
}

export interface PushResponse {
  applied: AppliedRecord[]
  conflicts: RecordEnvelope[]
}

export interface SyncStatus {
  serverRevision: number
  recordCount: number
}

/**
 * Checked rather than cast, because these responses drive destructive local
 * writes: an envelope read as a tombstone deletes a record, and a cursor read
 * as a number decides which records this device will never ask for again. A
 * malformed body has to fail loudly, before any of that.
 */
function isEnvelope(value: unknown): value is RecordEnvelope {
  if (value === null || typeof value !== 'object') return false
  const { entityType, entityId, revision, clientUpdatedAt, deleted } = value as Record<
    string,
    unknown
  >
  return (
    typeof entityType === 'string' &&
    typeof entityId === 'string' &&
    entityId !== '' &&
    typeof revision === 'number' &&
    typeof clientUpdatedAt === 'string' &&
    typeof deleted === 'boolean'
  )
}

function isApplied(value: unknown): value is AppliedRecord {
  if (value === null || typeof value !== 'object') return false
  const { entityType, entityId, revision } = value as Record<string, unknown>
  return (
    typeof entityType === 'string' && typeof entityId === 'string' && typeof revision === 'number'
  )
}

function malformed(): never {
  throw new ApiError(502, 'Réponse de synchronisation inattendue.')
}

export async function pullChanges(since: number, limit = PULL_PAGE_SIZE): Promise<PullResponse> {
  const body = await apiRequest<unknown>(`/sync/changes?since=${since}&limit=${limit}`)
  if (body === null || typeof body !== 'object') malformed()
  const { records, nextCursor, hasMore } = body as Record<string, unknown>
  if (!Array.isArray(records) || !records.every(isEnvelope)) malformed()
  if (typeof nextCursor !== 'number' || typeof hasMore !== 'boolean') malformed()
  return { records, nextCursor, hasMore }
}

export async function pushChanges(records: PushRecord[]): Promise<PushResponse> {
  const body = await apiRequest<unknown>('/sync/changes', { method: 'POST', body: { records } })
  if (body === null || typeof body !== 'object') malformed()
  const { applied, conflicts } = body as Record<string, unknown>
  if (!Array.isArray(applied) || !applied.every(isApplied)) malformed()
  if (!Array.isArray(conflicts) || !conflicts.every(isEnvelope)) malformed()
  return { applied, conflicts }
}

export function fetchSyncStatus(): Promise<SyncStatus> {
  return apiRequest<SyncStatus>('/sync/status')
}
