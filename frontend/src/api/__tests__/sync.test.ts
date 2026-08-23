import { beforeEach, describe, expect, it, vi } from 'vitest'

/**
 * What the transport does with a body it did not expect.
 *
 * Two different verdicts, and the difference matters: a body that is not
 * shaped like a sync response has to fail loudly, because acting on it writes
 * to a carnet. A record of a kind this version does not know is not that — it
 * is well-formed, it just has nowhere to go here, and refusing the page over
 * it would block every record beside it for good.
 */

const apiRequest = vi.fn<(path: string, options?: unknown) => Promise<unknown>>()

vi.mock('@/api/client', async (original) => ({
  ...(await original<typeof import('@/api/client')>()),
  apiRequest,
}))

const { ApiError } = await import('@/api/client')
const { pullChanges, pushChanges } = await import('@/api/sync')

const TAG = {
  entityType: 'tag',
  entityId: 't1',
  revision: 4,
  clientUpdatedAt: '2026-03-01T10:00:00.000Z',
  deleted: false,
  ciphertext: 'Y2hpZmZyZQ==',
  nonce: 'bm9uY2U=',
}

const FOREIGN = { ...TAG, entityType: 'devoir', entityId: 'd1', revision: 5 }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('pullChanges', () => {
  it('écarte un genre inconnu et rend le reste de la page', async () => {
    apiRequest.mockResolvedValueOnce({ records: [FOREIGN, TAG], nextCursor: 5, hasMore: false })

    const page = await pullChanges(0)

    expect(page.records).toEqual([TAG])
    // Le curseur du serveur, inchangé : le retenir ferait relire la même page
    // tant que l'enregistrement écarté existe.
    expect(page.nextCursor).toBe(5)
  })

  it('refuse une page dont un enregistrement d’un genre connu est malformé', async () => {
    apiRequest.mockResolvedValueOnce({
      records: [{ ...TAG, revision: 'quatre' }],
      nextCursor: 5,
      hasMore: false,
    })

    await expect(pullChanges(0)).rejects.toBeInstanceOf(ApiError)
  })

  it('refuse une réponse qui n’a pas la forme d’une page', async () => {
    apiRequest.mockResolvedValueOnce({ records: [TAG], nextCursor: null, hasMore: false })

    await expect(pullChanges(0)).rejects.toBeInstanceOf(ApiError)
  })
})

describe('pushChanges', () => {
  it('écarte un genre inconnu des deux listes de la réponse', async () => {
    apiRequest.mockResolvedValueOnce({
      applied: [{ entityType: 'devoir', entityId: 'd1', revision: 6 }],
      conflicts: [FOREIGN, TAG],
    })

    const result = await pushChanges([])

    expect(result.applied).toEqual([])
    expect(result.conflicts).toEqual([TAG])
  })

  it('refuse une réponse dont une entrée acceptée est malformée', async () => {
    apiRequest.mockResolvedValueOnce({
      applied: [{ entityType: 'tag', entityId: 't1' }],
      conflicts: [],
    })

    await expect(pushChanges([])).rejects.toBeInstanceOf(ApiError)
  })
})
