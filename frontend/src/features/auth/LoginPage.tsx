import { useEffect, useRef, useState, type FormEvent } from 'react'
import { KeyRound, Loader2, ShieldCheck, Wand2, WifiOff, Zap } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { ApiError } from '@/lib/apiClient'
import { DEV_MODE } from '@/lib/env'
import { useSound } from '@/hooks/useSound'
import type { MFASetupResponse } from '@/types/api'

const CODE_LENGTH = 6

/** Six single-character boxes that behave like one field (paste + arrows work). */
function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  disabled?: boolean
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([])

  const setDigit = (index: number, digit: string) => {
    const next = value.split('')
    next[index] = digit
    const joined = next.join('').replace(/\D/g, '').slice(0, CODE_LENGTH)
    onChange(joined)
    if (digit && index < CODE_LENGTH - 1) refs.current[index + 1]?.focus()
    if (joined.length === CODE_LENGTH) onComplete?.(joined)
  }

  return (
    <div className="flex justify-between gap-2">
      {Array.from({ length: CODE_LENGTH }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el
          }}
          value={value[i] ?? ''}
          disabled={disabled}
          inputMode="numeric"
          autoComplete="one-time-code"
          aria-label={`TOTP digit ${i + 1}`}
          maxLength={1}
          onChange={(e) => setDigit(i, e.target.value.replace(/\D/g, '').slice(-1))}
          onKeyDown={(e) => {
            if (e.key === 'Backspace' && !value[i] && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
            if (e.key === 'ArrowRight' && i < CODE_LENGTH - 1) refs.current[i + 1]?.focus()
          }}
          onPaste={(e) => {
            e.preventDefault()
            const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
            if (!pasted) return
            onChange(pasted)
            if (pasted.length === CODE_LENGTH) onComplete?.(pasted)
            refs.current[Math.min(pasted.length, CODE_LENGTH - 1)]?.focus()
          }}
          className="tnum h-[52px] w-full min-w-0 rounded-ctl border border-hairline bg-[#0b0e13] text-center text-lg
            text-ink focus:border-accent/70 focus:outline-none disabled:opacity-50"
        />
      ))}
    </div>
  )
}

export default function LoginPage() {
  const { stage, login, verifyMfa, loadMfaSetup, fetchDevTotp, backToCredentials, username: sessionUser } = useAuthStore()
  const { play } = useSound()

  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupData, setSetupData] = useState<MFASetupResponse | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)

  // Step 2: pull the enrolment QR as soon as the backend asks for setup.
  useEffect(() => {
    if (stage !== 'mfa-setup') return
    let cancelled = false
    setSetupError(null)
    loadMfaSetup()
      .then((data) => {
        if (!cancelled) setSetupData(data)
      })
      .catch((err) => {
        if (!cancelled) setSetupError(err instanceof ApiError ? err.detail : 'Unable to load MFA enrolment data.')
      })
    return () => {
      cancelled = true
    }
  }, [stage, loadMfaSetup])

  const submitCredentials = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setBusy(true)
    try {
      await login(username.trim(), password)
      play('click')
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Sign-in failed.')
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async (candidate?: string) => {
    const value = (candidate ?? code).trim()
    if (value.length !== CODE_LENGTH) {
      setError('Enter all six digits of the TOTP code.')
      return
    }
    setError(null)
    setBusy(true)
    try {
      await verifyMfa(value)
      play('toggle')
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'MFA verification failed.')
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  const autofillTotp = async () => {
    setError(null)
    setBusy(true)
    try {
      const res = await fetchDevTotp()
      setCode(res.code)
      play('click')
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : 'Dev TOTP helper unavailable.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="panel px-6 py-8 sm:px-8">
          <div className="flex flex-col items-center text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-ctl bg-accent text-[#20160a] shadow-glowaccent">
              <Zap className="h-6 w-6" />
            </div>
            <h1 className="mt-4 text-lg font-semibold text-ink">Sovereign AI Workbench</h1>
            <p className="mt-1 text-xs text-muted">Secure operator sign-in</p>
          </div>

          {stage === 'credentials' && (
            <form className="mt-7 space-y-4" onSubmit={submitCredentials}>
              <div>
                <label className="label-xs" htmlFor="username">
                  Username
                </label>
                <input
                  id="username"
                  className="field mt-1.5"
                  value={username}
                  autoComplete="username"
                  autoCapitalize="none"
                  spellCheck={false}
                  onChange={(e) => setUsername(e.target.value)}
                  required
                />
              </div>
              <div>
                <label className="label-xs" htmlFor="password">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="field mt-1.5"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>

              {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}

              <button type="submit" className="btn btn-primary w-full" disabled={busy || !username || !password}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                Sign in
              </button>
            </form>
          )}

          {stage === 'mfa-setup' && (
            <div className="mt-7 space-y-4">
              <div className="rounded-ctl border border-accent/40 bg-accent/5 px-3 py-2 text-xs text-accent">
                First-time enrolment for <span className="tnum">{sessionUser}</span>. Scan this code with an offline
                authenticator app, then continue.
              </div>

              {setupError && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{setupError}</p>}

              {!setupData && !setupError && (
                <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" /> Generating enrolment secret…
                </div>
              )}

              {setupData && (
                <>
                  <div className="flex justify-center">
                    {/* Data URI produced by the backend — nothing is fetched. */}
                    <img
                      src={setupData.qr_code_data_uri}
                      alt="TOTP enrolment QR code"
                      className="h-44 w-44 rounded-ctl border border-hairline bg-white p-2"
                    />
                  </div>
                  <div>
                    <div className="label-xs">Manual entry key</div>
                    <div className="tnum mt-1.5 select-all break-all rounded-ctl border border-hairline bg-[#0b0e13] px-3 py-2 text-xs text-ink">
                      {setupData.manual_entry_key}
                    </div>
                  </div>
                  <button type="button" className="btn btn-primary w-full" onClick={() => useAuthStore.setState({ stage: 'mfa-code' })}>
                    <ShieldCheck className="h-4 w-4" /> I've enrolled — enter code
                  </button>
                </>
              )}

              <button type="button" className="btn w-full" onClick={backToCredentials}>
                Back
              </button>
            </div>
          )}

          {stage === 'mfa-code' && (
            <div className="mt-7 space-y-4">
              <div>
                <label className="label-xs">TOTP code (6-digit)</label>
                <div className="mt-1.5">
                  <CodeInput value={code} onChange={setCode} onComplete={(v) => void submitCode(v)} disabled={busy} />
                </div>
              </div>

              {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}

              <button
                type="button"
                className="btn btn-primary w-full"
                disabled={busy || code.length !== CODE_LENGTH}
                onClick={() => void submitCode()}
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                Verify &amp; enter
              </button>

              {DEV_MODE && (
                <button
                  type="button"
                  className="flex w-full items-center justify-center gap-1.5 text-[11px] text-accent hover:underline"
                  onClick={() => void autofillTotp()}
                  disabled={busy}
                >
                  <Wand2 className="h-3 w-3" /> Autofill TOTP (dev mode) · offline
                </button>
              )}

              <button type="button" className="btn w-full" onClick={backToCredentials}>
                Back
              </button>
            </div>
          )}
        </div>

        <p className="mt-4 flex items-center justify-center gap-1.5 text-[11px] text-muted">
          <WifiOff className="h-3 w-3" /> Air-gapped · zero cloud · zero external calls
        </p>
      </div>
    </div>
  )
}
