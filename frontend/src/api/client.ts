/**
 * The only place in the app that calls `fetch`.
 *
 * Two things live here that must not be scattered: the bearer token, and the
 * single-flight refresh. Without the latter, a screen firing three requests
 * with an expired token would run three rotations at once, and rotation
 * revokes the token it was given — so two of the three would sign the user out.
 */

const API_BASE = '/api/v1'

export class ApiError extends Error {
  // Declared and assigned rather than as constructor parameter properties,
  // which `erasableSyntaxOnly` rejects: they emit code rather than erasing.
  readonly status: number
  readonly detail: string

  constructor(status: number, detail: string) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
  }
}

/** The network, not the server, said no. Never a reason to sign out. */
export class OfflineError extends Error {
  constructor() {
    super('Pas de connexion.')
    this.name = 'OfflineError'
  }
}

export interface AuthHooks {
  accessToken: () => string | null
  refreshToken: () => string | null
  onRefreshed: (tokens: { accessToken: string; refreshToken: string }) => void
  onSessionLost: () => void
}

let hooks: AuthHooks | null = null
let refreshInFlight: Promise<string | null> | null = null

export function configureApiAuth(next: AuthHooks | null): void {
  hooks = next
  // Any rotation still in flight belongs to the account being replaced. Left
  // alone, it would resolve after the switch and hand the *new* session the
  // old account's tokens — the one crossing of accounts this file could
  // produce on its own.
  refreshInFlight = null
}

/**
 * A successful status is not a promise of a JSON body: a proxy or a
 * maintenance page can answer 200 with HTML. Without this, that surfaces as a
 * raw SyntaxError from somewhere deep in the call, rather than as an error the
 * caller can act on.
 */
async function parseJson<T>(response: Response): Promise<T> {
  try {
    return (await response.json()) as T
  } catch {
    throw new ApiError(response.status, 'Réponse inattendue du serveur.')
  }
}

async function parseDetail(response: Response): Promise<string> {
  try {
    const body: unknown = await response.json()
    if (body && typeof body === 'object' && 'detail' in body) {
      const { detail } = body as { detail: unknown }
      if (typeof detail === 'string') return detail
    }
  } catch {
    // A non-JSON error body is still an error; fall through to the default.
  }
  return 'Une erreur est survenue.'
}

/**
 * A 200 is not a promise of the right shape. Trusting it would put `undefined`
 * in the token slots — every later request going out as `Bearer undefined`,
 * and that unusable pair written into the vault over the refresh token that
 * still worked.
 */
function isTokenPair(body: unknown): body is { accessToken: string; refreshToken: string } {
  if (body === null || typeof body !== 'object') return false
  const { accessToken, refreshToken } = body as Record<string, unknown>
  return (
    typeof accessToken === 'string' &&
    accessToken !== '' &&
    typeof refreshToken === 'string' &&
    refreshToken !== ''
  )
}

async function refreshOnce(): Promise<string | null> {
  // Captured up front and checked again below: `hooks` may be replaced while
  // the request is in the air.
  const owner = hooks
  const token = owner?.refreshToken() ?? null
  if (token === null) return null

  let response: Response
  try {
    response = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ refreshToken: token }),
    })
  } catch {
    // A rotation that could not be attempted is not a rotation that was
    // refused. Letting the raw TypeError escape would surface as an unknown
    // failure; calling onSessionLost would be worse still, telling a teacher
    // on a train that their session expired.
    throw new OfflineError()
  }

  if (hooks !== owner) return null

  if (!response.ok) {
    // Only a refusal means the session is gone. A 500 or a 502 means the
    // server is having a bad minute, and signing the teacher out over it would
    // throw away a perfectly valid session — and their place in the app.
    if (response.status === 401 || response.status === 403) {
      owner?.onSessionLost()
      return null
    }
    throw new ApiError(response.status, await parseDetail(response))
  }

  const session = await parseJson<unknown>(response)
  // Not a session loss: a malformed body means the server is misbehaving, the
  // same as the 500 above. The refresh token in hand may well still be good.
  if (!isTokenPair(session)) throw new ApiError(response.status, 'Réponse inattendue du serveur.')

  // Checked again, after the last await. The token store behind these hooks is
  // shared, so handing the old account's tokens to whoever is signed in now
  // would put one teacher's credentials on another's session.
  if (hooks !== owner) return null

  owner?.onRefreshed(session)
  return session.accessToken
}

function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight !== null) return refreshInFlight

  // Everyone waits on the same rotation, and the slot clears whatever happens
  // — leaving it set would wedge every later request behind a settled promise.
  // It clears only if it still holds *this* rotation: an account switch drops
  // the slot mid-flight, and a finished rotation must not then wipe out the
  // new one that took its place.
  //
  // Left untested on purpose. Reproducing the interleaving takes enough
  // choreography that the test would be measuring the microtask scheduler
  // rather than this guard — and a test that passes for the wrong reason is
  // worse than none.
  const rotation: Promise<string | null> = refreshOnce().finally(() => {
    if (refreshInFlight === rotation) refreshInFlight = null
  })
  refreshInFlight = rotation
  return rotation
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Sign-in and sign-up carry no bearer and must not trigger a refresh. */
  anonymous?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = options
  // Whose request this is. Someone else may sign in while it is in the air,
  // and a failure belonging to one account must never be reported against
  // another's session.
  const owner = hooks

  const send = async (token: string | null): Promise<Response> => {
    const headers: Record<string, string> = {}
    if (body !== undefined) headers['content-type'] = 'application/json'
    if (token !== null) headers.authorization = `Bearer ${token}`

    try {
      return await fetch(`${API_BASE}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    } catch {
      throw new OfflineError()
    }
  }

  let response = await send(anonymous ? null : (owner?.accessToken() ?? null))

  if (response.status === 401 && !anonymous) {
    // Someone signed in while this request was in the air, so it has outlived
    // the session that made it. Rotating now would mint a token for the *new*
    // account and replay one teacher's request under another's identity —
    // reading or writing the wrong carnet. A rotation started before the
    // switch is already covered: `refreshOnce` drops its result rather than
    // hand it across accounts, and this call then gets `null`.
    if (hooks !== owner) throw new ApiError(401, await parseDetail(response))

    const refreshed = await refreshAccessToken()
    if (refreshed === null) throw new ApiError(401, await parseDetail(response))

    response = await send(refreshed)
    // Refused again, with a token minted seconds ago: the account is gone, or
    // the server no longer accepts it. Silence here would leave the client
    // retrying for ever against a session that is not coming back.
    if (response.status === 401 && hooks === owner) owner?.onSessionLost()
  }

  if (!response.ok) throw new ApiError(response.status, await parseDetail(response))
  if (response.status === 204) return undefined as T
  return parseJson<T>(response)
}
