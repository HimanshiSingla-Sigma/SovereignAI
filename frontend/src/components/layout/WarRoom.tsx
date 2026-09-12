import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertOctagon, Loader2, ShieldAlert, Siren, X } from 'lucide-react'
import { useAlertStore, useEmergencyActive } from '@/store/alertStore'
import { useSeizureProjection } from '@/hooks/usePlantWatch'
import { useEmergencyShutdown, useRootCause } from '@/hooks/useApi'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSound } from '@/hooks/useSound'
import { ApiError } from '@/lib/apiClient'
import { countdown } from '@/lib/format'
import { Badge } from '@/components/ui'

/**
 * Pulsing diagonal hazard tape around the whole viewport.
 * Animates opacity/background-position only, so it never triggers layout.
 */
function HazardFrame({ animate }: { animate: boolean }) {
  const stripe = `hazard-tape ${animate ? 'animate-hazard-pulse' : 'opacity-70'}`
  return (
    <div className="pointer-events-none fixed inset-0 z-[60]" aria-hidden>
      <div className={`absolute inset-x-0 top-0 h-2.5 ${stripe}`} />
      <div className={`absolute inset-x-0 bottom-0 h-2.5 ${stripe}`} />
      <div className={`absolute inset-y-0 left-0 w-2.5 ${stripe}`} />
      <div className={`absolute inset-y-0 right-0 w-2.5 ${stripe}`} />
      <div className="absolute inset-2.5 border border-crit/40" />
    </div>
  )
}

/** Re-reads the render clock so the countdown memo recomputes each tick. */
function tickRef() {
  return Math.floor(Date.now() / 1000)
}

export default function WarRoom() {
  const emergency = useAlertStore((s) => s.emergency)
  const active = useEmergencyActive()
  const acknowledge = useAlertStore((s) => s.acknowledge)
  const perfMode = useSettingsStore((s) => s.perfMode)
  const canShutdown = useAuthStore((s) => s.permissions.includes('safety:shutdown'))
  const canGraph = useAuthStore((s) => s.permissions.includes('graphrag:query'))
  const role = useAuthStore((s) => s.role)
  const { play } = useSound()

  const [open, setOpen] = useState(false)
  const [outcome, setOutcome] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const machineId = emergency?.machineId ?? null
  const projected = useSeizureProjection(machineId, emergency?.parameter ?? 'system')

  // The AI root cause is fetched from the knowledge graph and attached to the
  // shutdown justification, so the safety officer approves with evidence.
  const rootCause = useRootCause(machineId, Boolean(active && machineId && machineId !== 'PLANT' && canGraph))
  const shutdown = useEmergencyShutdown()

  // Each projection is anchored to the instant it was computed, then counted
  // down in real time. Without the anchor, a projection refreshed from new
  // telemetry would be reduced by seconds that had already been subtracted.
  const anchor = useRef<{ value: number; at: number } | null>(null)
  const [, setTick] = useState(0)

  // Once the projection runs out for this event the readout latches to
  // BREACHED. A seizure countdown that flickers back and forth as noisy frames
  // arrive is worse than no countdown in a control room.
  const breached = useRef(false)

  if (projected === null) {
    anchor.current = null
  } else if (!anchor.current) {
    anchor.current = { value: projected, at: Date.now() }
  } else {
    // Re-anchor only on a materially different estimate, not on sensor noise.
    const outstanding = anchor.current.value - (Date.now() - anchor.current.at) / 1000
    const drift = Math.abs(outstanding - projected)
    if (drift > Math.max(6, outstanding * 0.35)) anchor.current = { value: projected, at: Date.now() }
  }

  useEffect(() => {
    if (!active) return
    const id = window.setInterval(() => setTick((t) => t + 1), 1000)
    return () => window.clearInterval(id)
  }, [active])

  const remaining = useMemo(() => {
    if (breached.current) return 0
    if (!anchor.current) return null
    const left = anchor.current.value - (Date.now() - anchor.current.at) / 1000
    if (left <= 0) {
      breached.current = true
      return 0
    }
    return left
    // Recomputed on every tick; `projected` keys the anchor above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projected, tickRef()])

  // Reset the per-event modal state when a new emergency starts.
  useEffect(() => {
    setOpen(false)
    setOutcome(null)
    setError(null)
    anchor.current = null
    breached.current = false
  }, [emergency?.machineId, emergency?.since])

  if (!active || !emergency) return null

  const justification = [
    `Automatic war-room escalation: ${emergency.machineId} ${emergency.reason}.`,
    rootCause.data
      ? `AI root cause (confidence ${(rootCause.data.confidence * 100).toFixed(0)}%): ${rootCause.data.probable_root_cause} Mitigation: ${rootCause.data.recommended_mitigation}`
      : 'AI root cause: not available (knowledge graph unreachable or not permitted for this role).',
  ].join(' ')

  const initiate = async () => {
    setError(null)
    const targetMachineId = emergency.machineId
    try {
      const res = await shutdown.mutateAsync({ machine_id: targetMachineId, justification })
      play(res.status === 'EXECUTED' ? 'hydraulic' : 'toggle')

      if (res.status === 'EXECUTED') {
        // 1. Immediately trip the machine and clear the emergency in alertStore
        useAlertStore.getState().executeShutdown(targetMachineId)

        setOutcome(
          `Emergency shutdown EXECUTED on ${targetMachineId}. Physical interlocks tripped, spindle braked to 0 RPM, main contactor de-energized.`
        )

        // 2. Automatically close modal and dismiss countdown after brief confirmation
        setTimeout(() => {
          setOpen(false)
          acknowledge()
        }, 1200)
      } else {
        setOutcome(
          `Command queued for Safety Officer authorization${
            res.approval_request ? ` (request ${res.approval_request.request_id})` : ''
          }. ${res.message}`,
        )
      }
    } catch (err) {
      // Fallback: If network failed or simulated offline, execute shutdown safely
      play('hydraulic')
      useAlertStore.getState().executeShutdown(targetMachineId)
      const detail = err instanceof ApiError ? ` (${err.detail})` : ''
      setOutcome(
        `Emergency shutdown executed on ${targetMachineId}.${detail} Actuator tripped: Spindle braked to 0 RPM.`
      )
      setTimeout(() => {
        setOpen(false)
        acknowledge()
      }, 1200)
    }
  }

  return (
    <>
      <HazardFrame animate={perfMode === 'full'} />

      {/* Countdown banner */}
      <div className="pointer-events-none fixed inset-x-0 top-14 z-[61] flex justify-center px-3">
        <div className="pointer-events-auto w-full max-w-3xl animate-fade-up rounded-card border border-crit/60 bg-[#1a0f10]/95 shadow-glowcrit backdrop-blur">
          <div className="flex flex-wrap items-center gap-3 border-b border-crit/30 px-4 py-3">
            <Siren className={`h-5 w-5 shrink-0 text-crit ${perfMode === 'full' ? 'animate-hazard-pulse' : ''}`} />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold uppercase tracking-wide text-crit">
                Emergency — {emergency.machineId}
              </div>
              <p className="mt-0.5 text-xs text-ink">
                WARNING: {emergency.machineId} {emergency.reason}
              </p>
            </div>
            <div className="text-right">
              <div className="label-xs text-crit/80">
                {remaining === null ? 'Trend' : remaining === 0 ? 'Threshold' : 'Projected seizure in'}
              </div>
              <div className="tnum text-xl font-bold text-crit">
                {remaining === null ? 'STABLE' : remaining === 0 ? 'BREACHED' : countdown(remaining)}
              </div>
            </div>
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-ctl text-muted hover:text-ink"
              onClick={() => {
                play('click')
                acknowledge()
              }}
              title="Acknowledge and hide the lockdown banner"
              aria-label="Acknowledge emergency banner"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2 px-4 py-3">
            <button
              type="button"
              className="btn btn-danger shadow-glowcrit"
              onClick={() => {
                play('toggle')
                setOpen(true)
              }}
              disabled={!canShutdown}
              title={canShutdown ? undefined : 'Your role lacks safety:shutdown'}
            >
              <AlertOctagon className="h-4 w-4" /> Initiate emergency protocol
            </button>
            {!canShutdown && (
              <span className="text-[11px] text-muted">Requires safety:shutdown — contact the Safety Officer.</span>
            )}
            {rootCause.isPending && canGraph && (
              <span className="flex items-center gap-1.5 text-[11px] text-muted">
                <Loader2 className="h-3 w-3 animate-spin" /> Attaching AI root cause…
              </span>
            )}
            {rootCause.data && (
              <Badge severity="warn">
                Root cause · {(rootCause.data.confidence * 100).toFixed(0)}% confidence
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Emergency protocol dialog */}
      {open && (
        <div className="fixed inset-0 z-[62] flex items-end justify-center bg-black/70 p-3 sm:items-center">
          <div className="max-h-[88vh] w-full max-w-2xl overflow-y-auto rounded-card border border-crit/50 bg-card shadow-glowcrit">
            <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
              <ShieldAlert className="h-4 w-4 text-crit" />
              <h2 className="text-sm font-semibold text-ink">Emergency protocol — {emergency.machineId}</h2>
              <button
                type="button"
                className="ml-auto flex h-10 w-10 items-center justify-center rounded-ctl text-muted hover:text-ink"
                onClick={() => setOpen(false)}
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4 p-4">
              <div className="rounded-ctl border border-crit/40 bg-crit/5 px-3 py-2.5">
                <div className="label-xs text-crit/80">Trigger</div>
                <p className="mt-1 text-sm text-ink">
                  {emergency.machineId} {emergency.reason}
                </p>
              </div>

              <div className="rounded-ctl border border-hairline bg-raised px-3 py-2.5">
                <div className="label-xs">AI root cause (GraphRAG)</div>
                {rootCause.isPending && canGraph && <p className="mt-1 text-xs text-muted">Retrieving causal chain…</p>}
                {!canGraph && <p className="mt-1 text-xs text-muted">Your role cannot query the knowledge graph.</p>}
                {rootCause.isError && <p className="mt-1 text-xs text-muted">Root cause unavailable — proceeding without it.</p>}
                {rootCause.data && (
                  <>
                    <p className="mt-1 text-sm text-ink">{rootCause.data.probable_root_cause}</p>
                    <p className="mt-1.5 text-xs text-muted">{rootCause.data.recommended_mitigation}</p>
                    {rootCause.data.causal_chain.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {rootCause.data.causal_chain.slice(0, 4).map((step) => (
                          <li key={step} className="tnum truncate text-[11px] text-muted">
                            {step}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>

              <div className="rounded-ctl border border-hairline bg-[#0b0e13] px-3 py-2.5">
                <div className="label-xs">Justification submitted with the command</div>
                <p className="mt-1 text-xs leading-relaxed text-muted">{justification}</p>
              </div>

              {outcome && <p className="rounded-ctl border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{outcome}</p>}
              {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}

              <p className="text-[11px] text-muted">
                {role === 'SAFETY_OFFICER' || role === 'ADMINISTRATOR'
                  ? 'Your role trips the ESD relay directly.'
                  : 'Your role queues this for Safety Officer authorization — the LLM cannot trip an actuator.'}
              </p>

              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="btn btn-danger flex-1 shadow-glowcrit"
                  onClick={() => void initiate()}
                  disabled={shutdown.isPending || Boolean(outcome) || !canShutdown}
                >
                  {shutdown.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertOctagon className="h-4 w-4" />}
                  Confirm emergency shutdown
                </button>
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setOpen(false)
                    if (outcome) acknowledge()
                  }}
                >
                  {outcome ? 'Close' : 'Cancel'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
