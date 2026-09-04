import { apiUrl } from './env'

/** Error carrying the HTTP status so callers can branch on 401/403. */
export class ApiError extends Error {
  readonly status: number
  readonly detail: string
  readonly body: unknown

  constructor(status: number, detail: string, body?: unknown) {
    super(detail)
    this.name = 'ApiError'
    this.status = status
    this.detail = detail
    this.body = body
  }

  get isAuth() {
    return this.status === 401
  }

  get isForbidden() {
    return this.status === 403
  }
}

type TokenReader = () => string | null
type UnauthorizedHandler = () => void

let readToken: TokenReader = () => null
let onUnauthorized: UnauthorizedHandler = () => {}

/** Wired once from the auth store so the client stays dependency-free. */
export function configureApiClient(opts: { getToken: TokenReader; onUnauthorized: UnauthorizedHandler }) {
  readToken = opts.getToken
  onUnauthorized = opts.onUnauthorized
}

function extractDetail(body: unknown, status: number): string {
  if (body && typeof body === 'object') {
    const detail = (body as { detail?: unknown }).detail
    if (typeof detail === 'string') return detail
    // FastAPI 422 validation errors arrive as a list of objects.
    if (Array.isArray(detail)) {
      const parts = detail
        .map((d) => (d && typeof d === 'object' ? (d as { msg?: string }).msg : String(d)))
        .filter(Boolean)
      if (parts.length) return parts.join('; ')
    }
  }
  if (status === 401) return 'Session expired. Please sign in again.'
  if (status === 403) return 'You do not have permission to perform this action.'
  return `Request failed with status ${status}.`
}

interface RequestOptions {
  method?: string
  body?: unknown
  /** Bypass the stored session token (used during the MFA handshake). */
  token?: string | null
  /** Send a FormData body untouched instead of JSON. */
  formData?: FormData
  signal?: AbortSignal
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, formData, signal } = opts
  const headers: Record<string, string> = { Accept: 'application/json' }

  const bearer = token !== undefined ? token : readToken()
  if (bearer) headers.Authorization = `Bearer ${bearer}`

  let payload: BodyInit | undefined
  if (formData) {
    payload = formData // browser sets the multipart boundary
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json'
    payload = JSON.stringify(body)
  }

  let res: Response
  try {
    res = await fetch(apiUrl(path), { method, headers, body: payload, signal })
  } catch (err) {
    if ((err as Error)?.name === 'AbortError') throw err
    throw new ApiError(0, 'Cannot reach the sovereign backend. Check that the API service is running on the LAN.')
  }

  if (res.status === 204) return undefined as T

  const text = await res.text()
  let parsed: unknown = null
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }

  if (!res.ok) {
    // A 401 on a session token means the session is gone; the MFA handshake
    // passes an explicit token and handles its own 401 inline.
    if (res.status === 401 && token === undefined) onUnauthorized()
    throw new ApiError(res.status, extractDetail(parsed, res.status), parsed)
  }

  return parsed as T
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'GET' }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'POST', body }),
  put: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...opts, method: 'PUT', body }),
  del: <T>(path: string, opts?: Omit<RequestOptions, 'method' | 'body'>) => request<T>(path, { ...opts, method: 'DELETE' }),
  upload: <T>(path: string, formData: FormData) => request<T>(path, { method: 'POST', formData }),
}
