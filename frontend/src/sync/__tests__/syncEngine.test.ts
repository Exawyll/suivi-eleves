import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PullResponse, PushRecord, PushResponse, RecordEnvelope } from '@/api/sync'
import type { SyncEntityType } from '@/store/syncMeta'

/**
 * The engine is driven through mocked endpoints and a real key: what is worth
 * testing here is the arbitration, not the transport, and the encryption has
 * to be real or the tests would not exercise the envelope binding at all.
 */

const pullChanges = vi.fn<(since: number, limit?: number) => Promise<PullResponse>>()
const pushChanges = vi.fn<(records: PushRecord[]) => Promise<PushResponse>>()

vi.mock('@/api/sync', async (original) => ({
  ...(await original<typeof import('@/api/sync')>()),
  pullChanges,
  pushChanges,
}))

const dekHolder: { key: CryptoKey | null } = { key: null }
vi.mock('@/crypto/deviceKeyStore', () => ({
  recallDataKey: vi.fn<(userId: string) => Promise<CryptoKey | null>>(async () => dekHolder.key),
  rememberDataKey: vi.fn<(userId: string, dek: CryptoKey) => Promise<void>>(async () => undefined),
  forgetDataKey: vi.fn<(userId: string) => Promise<boolean>>(async () => true),
}))

const { sealRecord } = await import('@/crypto/envelope')
const { useAppStore } = await import('@/store/useAppStore')
const { useAuthStore } = await import('@/store/useAuthStore')
const { syncKey, PREFERENCE_ID } = await import('@/store/syncMeta')
const { requestSync } = await import('@/sync/syncEngine')
const { useSyncStore } = await import('@/sync/useSyncStore')

const SESSION = {
  userId: 'camille',
  email: 'camille@ecole.fr',
  firstName: 'Camille',
  lastName: 'Roy',
  kdfSalt: 'c2Vs',
  kdfIterations: 600000,
  wrappedDek: 'd3JhcA==',
  dekNonce: 'bm9uY2U=',
}

async function anEnvelope(
  entityType: 'tag' | 'classe' | 'preference',
  entityId: string,
  value: unknown,
  revision: number,
  clientUpdatedAt: string,
): Promise<RecordEnvelope> {
  const sealed = await sealRecord(dekHolder.key as CryptoKey, entityType, entityId, value)
  return { entityType, entityId, revision, clientUpdatedAt, deleted: false, ...sealed }
}

function aTombstone(
  entityType: 'tag' | 'classe',
  entityId: string,
  revision: number,
  clientUpdatedAt: string,
): RecordEnvelope {
  return {
    entityType,
    entityId,
    revision,
    clientUpdatedAt,
    deleted: true,
    ciphertext: null,
    nonce: null,
  }
}

function emptyPull(): PullResponse {
  return { records: [], nextCursor: useAppStore.getState().cursor, hasMore: false }
}

beforeEach(async () => {
  vi.clearAllMocks()
  dekHolder.key = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
    'encrypt',
    'decrypt',
  ])
  useAuthStore.setState({ status: 'unlocked', session: SESSION, needsReauth: false, error: null })
  useAppStore.setState({
    etablissements: [{ id: 'e1', name: 'École' }],
    classes: [{ id: 'c1', etablissementId: 'e1', name: 'CM1 A', niveau: 'CM1' }],
    eleves: [],
    tagCategories: [{ id: 'k1', name: 'Comportement' }],
    tags: [{ id: 't1', categoryId: 'k1', emoji: '👏', name: 'Participation', variant: 'accent' }],
    events: [],
    hasSeeded: true,
    activeClasseId: 'c1',
    principalClasseId: null,
    syncMeta: {},
    tombstones: {},
    cursor: 0,
  })
  // An implementation, not a fixed value: `nextCursor` has to be read when the
  // call happens, or an empty pull would drag the cursor back to where it was
  // when the mock was written.
  pullChanges.mockImplementation(async () => emptyPull())
  pushChanges.mockResolvedValue({ applied: [], conflicts: [] })
})

describe('pull', () => {
  it('applique un enregistrement distant et ne le redoit plus', async () => {
    const remote = await anEnvelope(
      'tag',
      't2',
      { categoryId: 'k1', emoji: '🎯', name: 'Effort', variant: 'outline' },
      7,
      '2026-03-01T10:00:00.000Z',
    )
    pullChanges.mockResolvedValueOnce({ records: [remote], nextCursor: 7, hasMore: false })

    await requestSync()

    const state = useAppStore.getState()
    expect(state.tags.find((tag) => tag.id === 't2')?.name).toBe('Effort')
    expect(state.syncMeta[syncKey('tag', 't2')]).toEqual({
      updatedAt: '2026-03-01T10:00:00.000Z',
      revision: 7,
      dirty: false,
    })
    expect(state.cursor).toBe(7)
  })

  it('applique une pierre tombale distante', async () => {
    pullChanges.mockResolvedValueOnce({
      records: [aTombstone('tag', 't1', 9, '2026-03-01T10:00:00.000Z')],
      nextCursor: 9,
      hasMore: false,
    })

    await requestSync()

    expect(useAppStore.getState().tags.find((tag) => tag.id === 't1')).toBeUndefined()
  })

  it('oublie la classe ouverte quand elle est supprimée ailleurs', async () => {
    // Otherwise the Classes screen opens a divider that no longer exists.
    pullChanges.mockResolvedValueOnce({
      records: [aTombstone('classe', 'c1', 9, '2026-03-01T10:00:00.000Z')],
      nextCursor: 9,
      hasMore: false,
    })

    await requestSync()

    expect(useAppStore.getState().activeClasseId).toBeNull()
  })

  it('garde la version locale quand elle est plus récente que celle du serveur', async () => {
    useAppStore.setState({
      syncMeta: {
        [syncKey('tag', 't1')]: { updatedAt: '2026-03-02T00:00:00.000Z', revision: 3, dirty: true },
      },
    })
    const stale = await anEnvelope(
      'tag',
      't1',
      { categoryId: 'k1', emoji: '👏', name: 'Ancien nom', variant: 'accent' },
      8,
      '2026-03-01T00:00:00.000Z',
    )
    pullChanges.mockResolvedValueOnce({ records: [stale], nextCursor: 8, hasMore: false })

    await requestSync()

    const state = useAppStore.getState()
    expect(state.tags.find((tag) => tag.id === 't1')?.name).toBe('Participation')
    // Still owed — and now carrying the server's revision, so the next push is
    // a straight overwrite rather than a conflict it would win anyway.
    expect(state.syncMeta[syncKey('tag', 't1')]).toEqual({
      updatedAt: '2026-03-02T00:00:00.000Z',
      revision: 8,
      dirty: true,
    })
  })

  it('garde la version locale quand les deux horodatages sont identiques', async () => {
    // `nextStamp()` ordonne les écritures de cet appareil, rien n'ordonne les
    // horloges de deux appareils. Une égalité est donc un autre appareil qui a
    // écrit dans la même milliseconde, pas une version déjà vue ici : céder la
    // perdrait sans trace, puisqu'elle n'a jamais été envoyée.
    const sameInstant = '2026-03-02T00:00:00.000Z'
    useAppStore.setState({
      syncMeta: {
        [syncKey('tag', 't1')]: { updatedAt: sameInstant, revision: 3, dirty: true },
      },
    })
    const other = await anEnvelope(
      'tag',
      't1',
      { categoryId: 'k1', emoji: '👏', name: 'Nom de l’autre appareil', variant: 'accent' },
      9,
      sameInstant,
    )
    pullChanges.mockResolvedValueOnce({ records: [other], nextCursor: 9, hasMore: false })

    await requestSync()

    const state = useAppStore.getState()
    expect(state.tags.find((tag) => tag.id === 't1')?.name).toBe('Participation')
    expect(state.syncMeta[syncKey('tag', 't1')]).toEqual({
      updatedAt: sameInstant,
      revision: 9,
      dirty: true,
    })
  })

  it('ignore un genre d’enregistrement inconnu sans perdre le reste de la page', async () => {
    // Ce qu'un client plus récent pousserait sur le même compte. Le carnet n'a
    // aucune liste où le ranger ; ce qui compte est que la page passe quand
    // même, et que le curseur avance — sinon la même page revient sans fin.
    const foreign = 'devoir' as SyncEntityType
    const sealed = await sealRecord(dekHolder.key as CryptoKey, foreign, 'd1', { titre: 'Poésie' })
    const known = await anEnvelope(
      'tag',
      't2',
      { categoryId: 'k1', emoji: '🎯', name: 'Effort', variant: 'outline' },
      11,
      '2026-03-01T10:00:00.000Z',
    )
    pullChanges.mockResolvedValueOnce({
      records: [
        {
          entityType: foreign,
          entityId: 'd1',
          revision: 10,
          clientUpdatedAt: '2026-03-01T09:00:00.000Z',
          deleted: false,
          ...sealed,
        },
        known,
      ],
      nextCursor: 11,
      hasMore: false,
    })

    await requestSync()

    const state = useAppStore.getState()
    expect(state.tags.find((tag) => tag.id === 't2')?.name).toBe('Effort')
    expect(state.cursor).toBe(11)
    // Rien n'est prétendu sur une version que cet appareil ne sait pas tenir.
    expect(state.syncMeta[syncKey(foreign, 'd1')]).toBeUndefined()
    expect(useSyncStore.getState().phase).toBe('idle')
  })

  it('laisse le carnet intact quand une enveloppe ne se déchiffre pas', async () => {
    // Wrong key, or an envelope moved from another record: applying it would be
    // guessing at someone's data.
    const other = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, [
      'encrypt',
      'decrypt',
    ])
    const sealed = await sealRecord(other, 'tag', 't1', { name: 'Injecté' })
    pullChanges.mockResolvedValueOnce({
      records: [
        {
          entityType: 'tag',
          entityId: 't1',
          revision: 12,
          clientUpdatedAt: '2026-03-05T00:00:00.000Z',
          deleted: false,
          ...sealed,
        },
      ],
      nextCursor: 12,
      hasMore: false,
    })

    await requestSync()

    const state = useAppStore.getState()
    expect(state.tags.find((tag) => tag.id === 't1')?.name).toBe('Participation')
    expect(state.syncMeta[syncKey('tag', 't1')]).toBeUndefined()
  })
})

describe('push', () => {
  it('envoie ce qui est dû, chiffré, et l’efface de la dette une fois accepté', async () => {
    useAppStore
      .getState()
      .createTag({ categoryId: 'k1', emoji: '🌟', name: 'Progrès', variant: 'neutral' })
    const created = useAppStore.getState().tags.at(-1)
    const key = syncKey('tag', created?.id ?? '')
    pushChanges.mockImplementationOnce(async (records) => ({
      applied: records.map((record) => ({
        entityType: record.entityType,
        entityId: record.entityId,
        revision: 21,
      })),
      conflicts: [],
    }))

    await requestSync()

    const sent = pushChanges.mock.calls[0]?.[0] ?? []
    const record = sent.find((one) => one.entityId === created?.id)
    expect(record?.deleted).toBe(false)
    expect(record?.baseRevision).toBeNull()
    // The carnet never leaves in the clear.
    expect(JSON.stringify(record)).not.toContain('Progrès')
    expect(useAppStore.getState().syncMeta[key]).toMatchObject({ revision: 21, dirty: false })
  })

  it('envoie une pierre tombale, et la retire une fois posée', async () => {
    useAppStore.setState({
      syncMeta: {
        [syncKey('tag', 't1')]: {
          updatedAt: '2026-03-01T00:00:00.000Z',
          revision: 4,
          dirty: false,
        },
      },
    })
    useAppStore.getState().deleteTag('t1')
    pushChanges.mockImplementationOnce(async (records) => ({
      applied: records.map((record) => ({
        entityType: record.entityType,
        entityId: record.entityId,
        revision: 30,
      })),
      conflicts: [],
    }))

    await requestSync()

    const sent = pushChanges.mock.calls[0]?.[0] ?? []
    expect(sent[0]).toMatchObject({
      entityType: 'tag',
      entityId: 't1',
      deleted: true,
      baseRevision: 4,
    })
    expect(sent[0]?.ciphertext).toBeUndefined()
    expect(useAppStore.getState().tombstones[syncKey('tag', 't1')]).toBeUndefined()
  })

  it('applique l’enveloppe du serveur quand il a gagné l’arbitrage', async () => {
    useAppStore.getState().updateTag('t1', { name: 'Nom local' })
    const winner = await anEnvelope(
      'tag',
      't1',
      { categoryId: 'k1', emoji: '👏', name: 'Nom du serveur', variant: 'accent' },
      40,
      '2099-01-01T00:00:00.000Z',
    )
    pushChanges.mockResolvedValueOnce({ applied: [], conflicts: [winner] })

    await requestSync()

    expect(useAppStore.getState().tags.find((tag) => tag.id === 't1')?.name).toBe('Nom du serveur')
  })

  it('ne fait jamais avancer le curseur sur un push', async () => {
    // The cursor only ever moves on a pull. Moving it here would skip every
    // record another device pushed that this one has never seen.
    useAppStore.setState({ cursor: 5 })
    useAppStore.getState().updateTag('t1', { name: 'Local' })
    const winner = await anEnvelope(
      'tag',
      't1',
      { categoryId: 'k1', emoji: '👏', name: 'Serveur', variant: 'accent' },
      900,
      '2099-01-01T00:00:00.000Z',
    )
    pushChanges.mockResolvedValueOnce({ applied: [], conflicts: [winner] })

    await requestSync()

    expect(useAppStore.getState().cursor).toBe(5)
  })
})

describe('mutations pendant une synchronisation', () => {
  it('ne perd pas une saisie faite pendant que le push est en vol', async () => {
    // The one that matters. The server holds the version from *before* the
    // teacher's latest keystroke; calling that record synchronised would
    // strand the newer version on the device for good.
    useAppStore.getState().updateTag('t1', { name: 'Première version' })

    pushChanges.mockImplementationOnce(async (records) => {
      useAppStore.getState().updateTag('t1', { name: 'Seconde version' })
      return {
        applied: records.map((record) => ({
          entityType: record.entityType,
          entityId: record.entityId,
          revision: 55,
        })),
        conflicts: [],
      }
    })

    await requestSync()

    const meta = useAppStore.getState().syncMeta[syncKey('tag', 't1')]
    expect(useAppStore.getState().tags.find((tag) => tag.id === 't1')?.name).toBe('Seconde version')
    expect(meta?.dirty).toBe(true)
    // The revision is kept all the same: it is what the next push builds on.
    expect(meta?.revision).toBe(55)
  })

  it('ne perd pas une saisie faite pendant qu’un pull est en vol', async () => {
    pullChanges.mockImplementationOnce(async () => {
      useAppStore.getState().updateTag('t1', { name: 'Saisi pendant le pull' })
      return {
        records: [
          await anEnvelope(
            'tag',
            't1',
            { categoryId: 'k1', emoji: '👏', name: 'Version distante', variant: 'accent' },
            60,
            '2020-01-01T00:00:00.000Z',
          ),
        ],
        nextCursor: 60,
        hasMore: false,
      }
    })

    await requestSync()

    expect(useAppStore.getState().tags.find((tag) => tag.id === 't1')?.name).toBe(
      'Saisi pendant le pull',
    )
    expect(useAppStore.getState().syncMeta[syncKey('tag', 't1')]?.dirty).toBe(true)
  })
})

describe('quand il ne faut pas synchroniser', () => {
  it('ne synchronise pas une session sans jetons valides', async () => {
    // Without this the engine walks into a 401 it already knows about, on
    // every trigger, for as long as the session stays broken.
    useAuthStore.setState({ needsReauth: true })

    await requestSync()

    expect(pullChanges).not.toHaveBeenCalled()
    expect(pushChanges).not.toHaveBeenCalled()
  })

  it('ne synchronise pas un carnet verrouillé', async () => {
    useAuthStore.setState({ status: 'locked' })

    await requestSync()

    expect(pullChanges).not.toHaveBeenCalled()
  })

  it('n’en lance qu’une à la fois', async () => {
    let release: () => void = () => {}
    // Built before the call, so releasing it can never race the mock being
    // invoked — a gate that is never opened would hang every later test on the
    // same in-flight promise.
    const gate = new Promise<PullResponse>((resolve) => {
      release = () => {
        resolve(emptyPull())
      }
    })
    pullChanges.mockImplementationOnce(async () => gate)

    const first = requestSync()
    const second = requestSync()
    release()
    await Promise.all([first, second])

    expect(pullChanges).toHaveBeenCalledTimes(1)
  })

  it('signale une coupure réseau comme une coupure, pas comme une erreur', async () => {
    const { OfflineError } = await import('@/api/client')
    pullChanges.mockRejectedValueOnce(new OfflineError())

    await requestSync()

    expect(useSyncStore.getState().phase).toBe('offline')
    expect(useSyncStore.getState().error).toBeNull()
  })

  it('compte ce qui reste dû après une synchronisation', async () => {
    useAppStore.getState().updateTag('t1', { name: 'En attente' })
    pushChanges.mockRejectedValueOnce(new Error('boom'))

    await requestSync()

    expect(useSyncStore.getState().phase).toBe('error')
    expect(useSyncStore.getState().pendingCount).toBe(1)
  })
})

describe('préférence', () => {
  it('synchronise la classe ouverte comme un enregistrement à part entière', async () => {
    // `c1` est déjà la classe ouverte, et la rouvrir ne doit rien devoir :
    // c'est l'ouverture d'une autre qui estampille la préférence.
    useAppStore.setState({
      classes: [
        ...useAppStore.getState().classes,
        { id: 'c2', etablissementId: 'e1', name: 'CM1 B', niveau: 'CM1' },
      ],
    })
    useAppStore.getState().setActiveClasse('c2')
    pushChanges.mockImplementationOnce(async (records) => ({
      applied: records.map((record) => ({
        entityType: record.entityType,
        entityId: record.entityId,
        revision: 70,
      })),
      conflicts: [],
    }))

    await requestSync()

    const sent = pushChanges.mock.calls[0]?.[0] ?? []
    expect(sent[0]).toMatchObject({ entityType: 'preference', entityId: PREFERENCE_ID })
  })
})
