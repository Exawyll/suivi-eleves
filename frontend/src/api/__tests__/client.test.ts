import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError, OfflineError, apiRequest, configureApiAuth } from '@/api/client'

type Fetch = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

interface Hooks {
  onRefreshed: ReturnType<typeof vi.fn<(next: { accessToken: string }) => void>>
  onSessionLost: ReturnType<typeof vi.fn<() => void>>
}

let tokens: { access: string | null; refresh: string | null }
let hooks: Hooks

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve: () => void = () => {}
  const promise = new Promise<void>((r) => {
    resolve = r
  })
  return { promise, resolve }
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })
}

beforeEach(() => {
  tokens = { access: 'expiré', refresh: 'refresh-1' }
  hooks = {
    onRefreshed: vi.fn<(next: { accessToken: string }) => void>(),
    onSessionLost: vi.fn<() => void>(),
  }
  configureApiAuth({
    accessToken: () => tokens.access,
    refreshToken: () => tokens.refresh,
    onRefreshed: (next) => {
      tokens.access = next.accessToken
      tokens.refresh = next.refreshToken
      hooks.onRefreshed(next)
    },
    onSessionLost: () => {
      tokens.access = null
      tokens.refresh = null
      hooks.onSessionLost()
    },
  })
})

afterEach(() => {
  configureApiAuth(null)
  vi.unstubAllGlobals()
})

describe('rafraîchissement du jeton', () => {
  it('ne fait tourner qu’une seule rotation pour plusieurs 401 simultanés', async () => {
    // The trap: rotation revokes the token it was given, so three concurrent
    // rotations would leave two of them holding a token the server just killed
    // — and sign the teacher out mid-sentence.
    let refreshCalls = 0
    const fetchMock = vi.fn<Fetch>(async (input) => {
      const url = String(input)
      if (url.endsWith('/auth/refresh')) {
        refreshCalls += 1
        await new Promise((resolve) => setTimeout(resolve, 10))
        return json(200, { accessToken: 'frais', refreshToken: 'refresh-2' })
      }
      return tokens.access === 'frais' ? json(200, { ok: true }) : json(401, { detail: 'non' })
    })
    vi.stubGlobal('fetch', fetchMock)

    const results = await Promise.all([
      apiRequest('/sync/status'),
      apiRequest('/sync/status'),
      apiRequest('/sync/status'),
    ])

    expect(refreshCalls).toBe(1)
    expect(results).toEqual([{ ok: true }, { ok: true }, { ok: true }])
    expect(hooks.onRefreshed).toHaveBeenCalledTimes(1)
  })

  it('rouvre une rotation après la précédente plutôt que de rester bloqué', async () => {
    // The in-flight flag has to clear whatever happens, or every later request
    // waits for ever on a promise that already settled. Both rounds succeed on
    // purpose: a failed retry would clear the tokens and there would be nothing
    // left to rotate, which would hide the very thing being tested.
    let refreshCalls = 0
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(async (input) => {
        if (String(input).endsWith('/auth/refresh')) {
          refreshCalls += 1
          return json(200, { accessToken: 'frais', refreshToken: `refresh-${refreshCalls + 1}` })
        }
        return tokens.access === 'frais' ? json(200, { ok: true }) : json(401, { detail: 'non' })
      }),
    )

    await expect(apiRequest('/sync/status')).resolves.toEqual({ ok: true })

    // The access token ages out again, exactly as it would in the app.
    tokens.access = 'expiré'
    await expect(apiRequest('/sync/status')).resolves.toEqual({ ok: true })

    expect(refreshCalls).toBe(2)
    expect(hooks.onSessionLost).not.toHaveBeenCalled()
  })

  it('traite une coupure réseau pendant la rotation comme une coupure, pas comme une expiration', async () => {
    // Telling a teacher on a train that their session expired would be both
    // wrong and alarming.
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(async (input) => {
        if (String(input).endsWith('/auth/refresh')) throw new TypeError('Failed to fetch')
        return json(401, { detail: 'non' })
      }),
    )

    await expect(apiRequest('/sync/status')).rejects.toBeInstanceOf(OfflineError)
    expect(hooks.onSessionLost).not.toHaveBeenCalled()
  })

  it('signale la session perdue quand le serveur refuse la rotation', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(async (input) =>
        String(input).endsWith('/auth/refresh')
          ? json(401, { detail: 'Session expirée' })
          : json(401, { detail: 'non' }),
      ),
    )

    await expect(apiRequest('/sync/status')).rejects.toBeInstanceOf(ApiError)
    expect(hooks.onSessionLost).toHaveBeenCalledTimes(1)
  })

  it('signale la session perdue quand un jeton tout neuf est refusé', async () => {
    // A token minted seconds ago and rejected means the account is gone.
    // Staying silent would leave the client retrying against nothing.
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(async (input) =>
        String(input).endsWith('/auth/refresh')
          ? json(200, { accessToken: 'frais', refreshToken: 'r' })
          : json(401, { detail: 'non' }),
      ),
    )

    await expect(apiRequest('/sync/status')).rejects.toBeInstanceOf(ApiError)
    expect(hooks.onSessionLost).toHaveBeenCalledTimes(1)
  })

  it('ne déconnecte pas parce que le serveur a une mauvaise minute', async () => {
    // A 500 from the refresh endpoint is not an expired session. Signing the
    // teacher out over it would throw away a session that is perfectly valid.
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(async (input) =>
        String(input).endsWith('/auth/refresh')
          ? json(503, { detail: 'Maintenance' })
          : json(401, { detail: 'non' }),
      ),
    )

    await expect(apiRequest('/sync/status')).rejects.toBeInstanceOf(ApiError)
    expect(hooks.onSessionLost).not.toHaveBeenCalled()
  })

  it('refuse une rotation dont le corps n’a pas la bonne forme', async () => {
    // A 200 carrying the wrong JSON would otherwise store `undefined` as the
    // pair: every later request goes out as `Bearer undefined`, and the vault
    // gets that written over a refresh token that still worked.
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(async (input) =>
        String(input).endsWith('/auth/refresh')
          ? json(200, { message: 'ok' })
          : json(401, { detail: 'non' }),
      ),
    )

    await expect(apiRequest('/sync/status')).rejects.toBeInstanceOf(ApiError)
    // The tokens in hand are untouched — the server misbehaved, the session
    // did not expire.
    expect(hooks.onRefreshed).not.toHaveBeenCalled()
    expect(hooks.onSessionLost).not.toHaveBeenCalled()
    expect(tokens.refresh).toBe('refresh-1')
  })

  it('rend une réponse non-JSON comme une erreur, pas comme un plantage', async () => {
    // A proxy or a maintenance page can answer 200 with HTML.
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(
        async () =>
          new Response('<html>maintenance</html>', {
            status: 200,
            headers: { 'content-type': 'text/html' },
          }),
      ),
    )

    await expect(apiRequest('/sync/status')).rejects.toBeInstanceOf(ApiError)
  })

  it('ne rafraîchit jamais sur un appel anonyme', async () => {
    // Sign-in answering 401 means "wrong password", not "expired session".
    const fetchMock = vi.fn<Fetch>(async () =>
      json(401, { detail: 'Adresse ou mot de passe incorrect.' }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      apiRequest('/auth/login', { method: 'POST', body: {}, anonymous: true }),
    ).rejects.toThrow('Adresse ou mot de passe incorrect.')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(hooks.onSessionLost).not.toHaveBeenCalled()
  })

  it('ne rejoue pas la requête d’un compte avec le jeton de celui qui vient de se connecter', async () => {
    // A request belongs to whoever made it. If someone else signs in while it
    // is in the air, the rotation that follows would mint a token for the *new*
    // account — and replaying with it would read or write the wrong teacher's
    // carnet.
    const inFlight = deferred()
    const switched = deferred()
    const sent: Array<{ url: string; authorization: string | undefined }> = []

    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(async (input, init) => {
        const url = String(input)
        const headers = (init?.headers ?? {}) as Record<string, string>
        sent.push({ url, authorization: headers.authorization })

        if (url.endsWith('/auth/refresh')) {
          return json(200, { accessToken: 'jeton-de-b', refreshToken: 'refresh-b2' })
        }
        // Only the first business call waits: it is the one that outlives its
        // session.
        if (sent.filter((call) => !call.url.endsWith('/auth/refresh')).length === 1) {
          inFlight.resolve()
          await switched.promise
          return json(401, { detail: 'non' })
        }
        return json(200, { ok: true })
      }),
    )

    const pending = apiRequest('/sync/status')
    await inFlight.promise

    // A second teacher signs in on the same device.
    const other = { access: 'expiré-b', refresh: 'refresh-b' }
    configureApiAuth({
      accessToken: () => other.access,
      refreshToken: () => other.refresh,
      onRefreshed: (next) => {
        other.access = next.accessToken
        other.refresh = next.refreshToken
      },
      onSessionLost: () => {},
    })
    switched.resolve()

    await expect(pending).rejects.toBeInstanceOf(ApiError)
    // The two halves of the rule: nothing was replayed under the new account,
    // and the new account's session was never touched to do it.
    expect(sent.some((call) => call.authorization === 'Bearer jeton-de-b')).toBe(false)
    expect(sent.some((call) => call.url.endsWith('/auth/refresh'))).toBe(false)
    expect(other.refresh).toBe('refresh-b')
  })

  it('rend une coupure réseau lisible plutôt qu’un TypeError', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<Fetch>(() => {
        throw new TypeError('Failed to fetch')
      }),
    )

    await expect(apiRequest('/sync/status')).rejects.toBeInstanceOf(OfflineError)
  })
})
