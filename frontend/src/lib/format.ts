import type { SafetyState } from '@/types/api'

export const num = (v: number | null | undefined, digits = 1) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : v.toFixed(digits)

export const int = (v: number | null | undefined) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : Math.round(v).toString()

export function bytes(n: number): string {
  if (!n) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(Math.floor(Math.log(n) / Math.log(1024)), units.length - 1)
  return `${(n / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function clockTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleTimeString([], { hour12: false })
}

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return `${d.toLocaleDateString()} ${d.toLocaleTimeString([], { hour12: false })}`
}

export function countdown(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export type Severity = 'ok' | 'warn' | 'crit' | 'info' | 'muted'

/** Maps every status string the backend emits onto one visual severity. */
export function severityOf(status: string | null | undefined): Severity {
  const s = (status ?? '').toUpperCase()
  if (['EMERGENCY', 'CRITICAL', 'FAILURE', 'SHUTDOWN', 'FAILED', 'BLOCKED', 'DENIED', 'REJECTED'].includes(s)) return 'crit'
  if (['WARNING', 'DEGRADED', 'PENDING', 'STRESS', 'SENSOR_ANOMALY', 'ATTENTION'].includes(s)) return 'warn'
  if (['NORMAL', 'OPERATIONAL', 'HEALTHY', 'PASSED', 'SUCCESS', 'APPROVED', 'EXECUTED', 'INTACT', 'ONLINE'].includes(s)) return 'ok'
  if (['INFO', 'MAINTENANCE', 'IDLE'].includes(s)) return 'info'
  return 'muted'
}

export const severityText: Record<Severity, string> = {
  ok: 'text-ok',
  warn: 'text-warn',
  crit: 'text-crit',
  info: 'text-info',
  muted: 'text-muted',
}

export const severityBg: Record<Severity, string> = {
  ok: 'bg-ok',
  warn: 'bg-warn',
  crit: 'bg-crit',
  info: 'bg-info',
  muted: 'bg-muted',
}

export const severityBorder: Record<Severity, string> = {
  ok: 'border-ok/40',
  warn: 'border-warn/45',
  crit: 'border-crit/55',
  info: 'border-info/40',
  muted: 'border-hairline',
}

/** Ordering used to pick the worst state across many machines. */
export const SAFETY_RANK: Record<SafetyState, number> = {
  NORMAL: 0,
  WARNING: 1,
  CRITICAL: 2,
  EMERGENCY: 3,
}

export function worstState(a: SafetyState, b: SafetyState): SafetyState {
  return SAFETY_RANK[a] >= SAFETY_RANK[b] ? a : b
}

/** Health/anomaly colouring for gauges and bars. */
export function healthSeverity(health: number): Severity {
  if (health >= 85) return 'ok'
  if (health >= 60) return 'warn'
  return 'crit'
}

export function anomalySeverity(score: number): Severity {
  if (score >= 80) return 'crit'
  if (score >= 45) return 'warn'
  return 'ok'
}
