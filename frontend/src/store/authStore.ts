import { create } from 'zustand'
import { api, configureApiClient } from '@/lib/apiClient'
import { telemetrySockets } from '@/lib/wsManager'
import type { LoginResponse, MeResponse, MFASetupResponse, TokenResponse, CurrentTotpResponse } from '@/types/api'

const TOKEN_KEY = 'siaw.token'

/** Where the 3-step login handshake currently stands. */
export type AuthStage = 'credentials' | 'mfa-setup' | 'mfa-code' | 'authenticated'

interface AuthState {
  token: string | null
  tempToken: string | null
  username: string | null
  role: string | null
  permissions: string[]
  stage: AuthStage
  /** True until the stored token has been checked against /auth/me. */
  hydrating: boolean

  login: (username: string, password: string) => Promise<void>
  loadMfaSetup: () => Promise<MFASetupResponse>
  fetchDevTotp: () => Promise<CurrentTotpResponse>
  verifyMfa: (code: string) => Promise<void>
  hydrate: () => Promise<void>
  logout: () => void
  backToCredentials: () => void
  has: (permission: string) => boolean
}

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function writeStoredToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* private-mode browsers still work, just without session persistence */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: readStoredToken(),
  tempToken: null,
  username: null,
  role: null,
  permissions: [],
  stage: readStoredToken() ? 'authenticated' : 'credentials',
  hydrating: Boolean(readStoredToken()),

  async login(username, password) {
    const res = await api.post<LoginResponse>('/api/auth/login', { username, password }, { token: null })

    // Accounts without MFA get a full token straight away.
    if (!res.mfa_required && res.access_token) {
      writeStoredToken(res.access_token)
      set({ token: res.access_token, tempToken: null, username: res.username, role: res.role ?? null, stage: 'authenticated', hydrating: true })
      await get().hydrate()
      return
    }

    set({
      tempToken: res.temp_token ?? null,
      username: res.username,
      role: res.role ?? null,
      stage: res.mfa_setup_required ? 'mfa-setup' : 'mfa-code',
    })
  },

  async loadMfaSetup() {
    const { tempToken } = get()
    return api.get<MFASetupResponse>('/api/auth/mfa-setup', { token: tempToken })
  },

  async fetchDevTotp() {
    const { tempToken } = get()
    return api.get<CurrentTotpResponse>('/api/auth/current-totp', { token: tempToken })
  },

  async verifyMfa(code) {
    const { tempToken } = get()
    const res = await api.post<TokenResponse>(
      '/api/auth/mfa-verify',
      { temp_token: tempToken, code },
      { token: tempToken },
    )
    writeStoredToken(res.access_token)
    set({
      token: res.access_token,
      tempToken: null,
      username: res.username,
      role: res.role,
      permissions: res.permissions ?? [],
      stage: 'authenticated',
      hydrating: false,
    })
  },

  async hydrate() {
    const { token } = get()
    if (!token) {
      set({ hydrating: false, stage: 'credentials' })
      return
    }
    try {
      const me = await api.get<MeResponse>('/api/auth/me')
      set({
        username: me.username,
        role: me.role,
        permissions: me.permissions ?? [],
        stage: 'authenticated',
        hydrating: false,
      })
    } catch {
      // Expired or revoked token: fall back to the login screen.
      writeStoredToken(null)
      set({ token: null, username: null, role: null, permissions: [], stage: 'credentials', hydrating: false })
    }
  },

  logout() {
    writeStoredToken(null)
    telemetrySockets.closeAll()
    set({ token: null, tempToken: null, username: null, role: null, permissions: [], stage: 'credentials', hydrating: false })
  },

  backToCredentials() {
    set({ tempToken: null, stage: 'credentials' })
  },

  has(permission) {
    return get().permissions.includes(permission)
  },
}))

// The API client reads the token and reports 401s back through the store.
configureApiClient({
  getToken: () => useAuthStore.getState().token,
  onUnauthorized: () => {
    if (useAuthStore.getState().token) useAuthStore.getState().logout()
  },
})
