/**
 * Runtime endpoint resolution.
 *
 * Nothing here may hardcode `localhost`: the same bundle is opened from a
 * workstation, from an iPad over the LAN, and from behind the nginx container.
 * When the env vars are blank we resolve against the origin the browser
 * actually used, which is correct in all three cases.
 */

const rawApi = (import.meta.env.VITE_API_BASE ?? '').trim()
const rawWs = (import.meta.env.VITE_WS_BASE ?? '').trim()

const stripTrailingSlash = (v: string) => v.replace(/\/+$/, '')

/** Base for REST calls, e.g. `http://192.168.1.24:8000` or '' for same-origin. */
export const API_BASE = stripTrailingSlash(rawApi)

/** Base for WebSocket calls, e.g. `ws://192.168.1.24:8000`. */
export const WS_BASE = (() => {
  if (rawWs) return stripTrailingSlash(rawWs)
  if (API_BASE) return stripTrailingSlash(API_BASE.replace(/^http/, 'ws'))
  if (typeof window === 'undefined') return ''
  const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${proto}//${window.location.host}`
})()

/** Dev-only affordances (TOTP autofill). Off unless explicitly enabled. */
export const DEV_MODE = String(import.meta.env.VITE_DEV_MODE ?? '').toLowerCase() === 'true'

/** Absolute URL for a REST path such as `/api/machines`. */
export const apiUrl = (path: string) => `${API_BASE}${path.startsWith('/') ? path : `/${path}`}`

/** Absolute URL for a WS path such as `/ws/telemetry/Machine-002`. */
export const wsUrl = (path: string) => `${WS_BASE}${path.startsWith('/') ? path : `/${path}`}`
