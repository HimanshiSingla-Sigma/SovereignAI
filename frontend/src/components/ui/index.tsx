import type { ReactNode } from 'react'
import { AlertTriangle, Inbox, Loader2, Lock, ShieldAlert } from 'lucide-react'
import { ApiError } from '@/lib/apiClient'
import { severityBg, severityText, type Severity } from '@/lib/format'

// ---------------------------------------------------------------- containers

export function Panel({
  title,
  subtitle,
  right,
  children,
  className = '',
  bodyClass = 'p-4',
}: {
  title?: ReactNode
  subtitle?: ReactNode
  right?: ReactNode
  children: ReactNode
  className?: string
  bodyClass?: string
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <header className="panel-head">
          <div className="min-w-0">
            {title && <h2 className="truncate text-sm font-semibold text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 truncate text-xs text-muted">{subtitle}</p>}
          </div>
          {right && <div className="flex shrink-0 items-center gap-2">{right}</div>}
        </header>
      )}
      <div className={bodyClass}>{children}</div>
    </section>
  )
}

export function PageHeader({
  title,
  subtitle,
  right,
}: {
  title: string
  subtitle?: ReactNode
  right?: ReactNode
}) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight text-ink sm:text-xl">{title}</h1>
        {subtitle && <p className="mt-1 text-xs text-muted sm:text-sm">{subtitle}</p>}
      </div>
      {right && <div className="flex flex-wrap items-center gap-2">{right}</div>}
    </div>
  )
}

// -------------------------------------------------------------------- atoms

export function StatusDot({
  severity,
  pulse = false,
  size = 8,
}: {
  severity: Severity
  pulse?: boolean
  size?: number
}) {
  return (
    <span
      className={`inline-block shrink-0 rounded-full ${severityBg[severity]} ${pulse ? 'animate-beacon-blink' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden
    />
  )
}

export function Badge({
  children,
  severity = 'muted',
  className = '',
}: {
  children: ReactNode
  severity?: Severity
  className?: string
}) {
  const tone: Record<Severity, string> = {
    ok: 'border-ok/40 bg-ok/10 text-ok',
    warn: 'border-warn/45 bg-warn/10 text-warn',
    crit: 'border-crit/50 bg-crit/10 text-crit',
    info: 'border-info/40 bg-info/10 text-info',
    muted: 'border-hairline bg-raised text-muted',
  }
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium ${tone[severity]} ${className}`}
    >
      {children}
    </span>
  )
}

export function Stat({
  label,
  value,
  unit,
  severity = 'muted',
  hint,
  className = '',
}: {
  label: string
  value: ReactNode
  unit?: string
  severity?: Severity
  hint?: ReactNode
  className?: string
}) {
  return (
    <div className={`rounded-ctl border border-hairline bg-raised px-3 py-2.5 ${className}`}>
      <div className="label-xs">{label}</div>
      <div className={`mt-1 flex items-baseline gap-1 ${severityText[severity]}`}>
        <span className="tnum text-xl font-semibold sm:text-2xl">{value}</span>
        {unit && <span className="text-xs text-muted">{unit}</span>}
      </div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-muted">{hint}</div>}
    </div>
  )
}

export function Bar({ value, severity }: { value: number; severity: Severity }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[#0b0e13]">
      <div
        className={`h-full rounded-full ${severityBg[severity]} transition-[width] duration-500`}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  )
}

// ------------------------------------------------------------------- states

export function Loading({ label = 'Loading…', className = '' }: { label?: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center gap-2 py-10 text-sm text-muted ${className}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </div>
  )
}

export function EmptyState({ label, hint, icon }: { label: string; hint?: string; icon?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
      <div className="text-muted">{icon ?? <Inbox className="h-6 w-6" />}</div>
      <p className="text-sm text-ink">{label}</p>
      {hint && <p className="max-w-sm text-xs text-muted">{hint}</p>}
    </div>
  )
}

/**
 * One renderer for every failure mode. A 403 is a normal outcome of the RBAC
 * matrix, so it reads as an explanation rather than a crash.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const apiErr = error instanceof ApiError ? error : null

  if (apiErr?.isForbidden) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
        <Lock className="h-6 w-6 text-warn" />
        <p className="text-sm font-medium text-ink">Your role does not have access to this data</p>
        <p className="max-w-md text-xs text-muted">{apiErr.detail}</p>
      </div>
    )
  }

  const message =
    apiErr?.detail ?? (error instanceof Error ? error.message : 'An unexpected error occurred.')

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center">
      <AlertTriangle className="h-6 w-6 text-crit" />
      <div>
        <p className="text-sm font-medium text-ink">Request failed</p>
        <p className="mt-1 max-w-md text-xs text-muted">{message}</p>
      </div>
      {onRetry && (
        <button type="button" className="btn btn-sm" onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}

export function PermissionNotice({ permission }: { permission: string }) {
  return (
    <div className="panel flex flex-col items-center gap-3 px-6 py-14 text-center">
      <ShieldAlert className="h-7 w-7 text-warn" />
      <div>
        <p className="text-sm font-semibold text-ink">No permission for this screen</p>
        <p className="mt-1 text-xs text-muted">
          This area requires <span className="tnum text-accent">{permission}</span>, which is not granted to your role.
        </p>
      </div>
    </div>
  )
}

/**
 * Wraps a query result so every screen gets the same loading / error / empty
 * handling without repeating it.
 */
export function QueryBoundary<T>({
  query,
  children,
  emptyWhen,
  empty,
  loadingLabel,
}: {
  query: { data: T | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => void }
  children: (data: T) => ReactNode
  emptyWhen?: (data: T) => boolean
  empty?: ReactNode
  loadingLabel?: string
}) {
  if (query.isPending) return <Loading label={loadingLabel} />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (query.data === undefined) return <EmptyState label="No data returned." />
  if (emptyWhen?.(query.data)) return <>{empty ?? <EmptyState label="Nothing to show yet." />}</>
  return <>{children(query.data)}</>
}
