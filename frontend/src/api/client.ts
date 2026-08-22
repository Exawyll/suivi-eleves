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

async function refreshOnce(): Promise<string | null> {
  const token = hooks?.refreshToken() ?? null
  if (token === null) return null

  const response = await fetch(`${API_BASE}/auth/refresh`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ refreshToken: token }),
  })
  if (!response.ok) {
    hooks?.onSessionLost()
    return null
  }

  const session = (await response.json()) as { accessToken: string; refreshToken: string }
  hooks?.onRefreshed(session)
  return session.accessToken
}

function refreshAccessToken(): Promise<string | null> {
  // Everyone waits on the same rotation, and the flag clears whatever happens
  // — leaving it set would wedge every later request behind a settled promise.
  refreshInFlight ??= refreshOnce().finally(() => {
    refreshInFlight = null
  })
  return refreshInFlight
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Sign-in and sign-up carry no bearer and must not trigger a refresh. */
  anonymous?: boolean
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = options

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

  let response = await send(anonymous ? null : (hooks?.accessToken() ?? null))

  if (response.status === 401 && !anonymous) {
    const refreshed = await refreshAccessToken()
    if (refreshed === null) throw new ApiError(401, await parseDetail(response))
    response = await send(refreshed)
  }

  if (!response.ok) throw new ApiError(response.status, await parseDetail(response))
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}
