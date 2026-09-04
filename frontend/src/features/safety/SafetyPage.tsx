import { useEffect, useState } from 'react'
import { AlertOctagon, Loader2, ShieldAlert, ShieldCheck } from 'lucide-react'
import { useEmergencyShutdown, useMachines, useRootCause, useSafetyEvents, useSafetyRules, useSafetyStatus } from '@/hooks/useApi'
import { useSelectionStore } from '@/store/selectionStore'
import { useAuthStore } from '@/store/authStore'
import { useSound } from '@/hooks/useSound'
import { ApiError } from '@/lib/apiClient'
import { dateTime, num, severityOf } from '@/lib/format'
import { pickDefaultMachine } from '@/lib/pickMachine'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel, Stat, StatusDot } from '@/components/ui'
import MachineChips from '@/components/MachineChips'

export default function SafetyPage() {
  const status = useSafetyStatus()
  const rules = useSafetyRules()
  const events = useSafetyEvents(30)
  const machines = useMachines()
  const { machineId, select } = useSelectionStore()
  const canShutdown = useAuthStore((s) => s.permissions.includes('safety:shutdown'))
  const canGraph = useAuthStore((s) => s.permissions.includes('graphrag:query'))
  const role = useAuthStore((s) => s.role)
  const { play } = useSound()

  const [justification, setJustification] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [outcome, setOutcome] = useState<string | null>(null)
  const shutdown = useEmergencyShutdown()
  const rootCause = useRootCause(machineId, canGraph)

  useEffect(() => {
    if (!machineId) {
      const preferred = pickDefaultMachine(machines.data)
      if (preferred) select(preferred)
    }
  }, [machineId, machines.data, select])

  const attachRootCause = () => {
    if (!rootCause.data) return
    play('click')
    setJustification(
      `AI root cause (confidence ${(rootCause.data.confidence * 100).toFixed(0)}%): ${rootCause.data.probable_root_cause} Mitigation: ${rootCause.data.recommended_mitigation}`,
    )
  }

  const trigger = async () => {
    if (!machineId || !justification.trim()) return
    setError(null)
    setOutcome(null)
    play('toggle')
    try {
      const res = await shutdown.mutateAsync({ machine_id: machineId, justification: justification.trim() })
      play(res.status === 'EXECUTED' ? 'hydraulic' : 'click')
      setOutcome(
        res.status === 'EXECUTED'
          ? `ESD relay tripped on ${machineId}. ${res.message}`
          : `Queued for Safety Officer authorization${res.approval_request ? ` — request ${res.approval_request.request_id}` : ''}. ${res.message}`,
      )
      setJustification('')
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Emergency shutdown failed.')
    }
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="Safety &amp; interlocks"
        subtitle="Deterministic rule engine — the LLM advises, it never actuates"
        right={
          status.data && (
            <Badge severity={severityOf(status.data.system_safety_state)}>
              <StatusDot severity={severityOf(status.data.system_safety_state)} pulse={status.data.system_safety_state !== 'NORMAL'} />
              {status.data.system_safety_state}
            </Badge>
          )
        }
      />

      {status.isPending && <Loading label="Reading safety engine…" />}
      {status.isError && <ErrorState error={status.error} onRetry={() => status.refetch()} />}
      {status.data && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <Stat label="Safety state" value={status.data.system_safety_state} severity={severityOf(status.data.system_safety_state)} />
          <Stat label="Active interlocks" value={status.data.active_interlocks} severity={status.data.active_interlocks ? 'warn' : 'ok'} />
          <Stat label="Critical alerts" value={status.data.critical_alerts} severity={status.data.critical_alerts ? 'crit' : 'ok'} />
          <Stat label="Pending approvals" value={status.data.pending_approvals} severity={status.data.pending_approvals ? 'warn' : 'muted'} />
          <Stat label="Rules loaded" value={status.data.safety_rules_count} severity="info" />
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Emergency shutdown" subtitle="Human-in-the-loop actuator command">
          {!canShutdown ? (
            <EmptyState
              icon={<ShieldCheck className="h-6 w-6" />}
              label="Your role cannot trigger a shutdown"
              hint="safety:shutdown is required."
            />
          ) : (
            <div className="space-y-3">
              {machines.data && machines.data.length > 0 && (
                <div>
                  <div className="label-xs mb-2">Target asset</div>
                  <MachineChips machines={machines.data} selected={machineId} onSelect={(id) => select(id)} />
                </div>
              )}

              <div>
                <div className="flex items-baseline justify-between">
                  <label className="label-xs" htmlFor="justification">
                    Justification (recorded in the audit chain)
                  </label>
                  {canGraph && rootCause.data && (
                    <button type="button" className="text-[11px] text-accent hover:underline" onClick={attachRootCause}>
                      Attach AI root cause
                    </button>
                  )}
                </div>
                <textarea
                  id="justification"
                  className="field mt-1.5 min-h-[96px] resize-y py-2.5"
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Why is this shutdown necessary?"
                />
              </div>

              <button
                type="button"
                className="btn btn-danger w-full"
                onClick={() => void trigger()}
                disabled={shutdown.isPending || !machineId || !justification.trim()}
              >
                {shutdown.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <AlertOctagon className="h-4 w-4" />}
                Trigger emergency shutdown
              </button>

              <p className="text-[11px] text-muted">
                {role === 'SAFETY_OFFICER' || role === 'ADMINISTRATOR'
                  ? 'Your role trips the relay directly.'
                  : 'Your role raises an approval request for a Safety Officer.'}
              </p>

              {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}
              {outcome && <p className="rounded-ctl border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{outcome}</p>}
            </div>
          )}
        </Panel>

        <Panel title="Safety rules" subtitle="Deterministic interlock thresholds" bodyClass="p-0">
          {rules.isPending && <Loading label="Loading rules…" />}
          {rules.isError && <ErrorState error={rules.error} onRetry={() => rules.refetch()} />}
          {rules.data?.length === 0 && <EmptyState label="No safety rules configured." />}
          {rules.data && rules.data.length > 0 && (
            <div className="max-h-[420px] overflow-y-auto">
              <ul className="divide-y divide-hairline">
                {rules.data.map((r) => (
                  <li key={r.rule_id} className="px-4 py-2.5">
                    <div className="flex items-center gap-2">
                      <StatusDot severity={severityOf(r.severity)} />
                      <span className="min-w-0 flex-1 truncate text-xs text-ink">{r.name}</span>
                      <Badge severity={r.is_active ? 'ok' : 'muted'}>{r.is_active ? 'ACTIVE' : 'OFF'}</Badge>
                    </div>
                    <div className="tnum mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[10px] text-muted">
                      <span>{r.rule_id}</span>
                      <span>
                        {r.parameter} {r.operator} {num(r.threshold, 1)}
                      </span>
                      <span>{r.severity}</span>
                      <span>→ {r.action_required}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Safety events" subtitle="Most recent rule trips" bodyClass="p-0">
        {events.isPending && <Loading label="Loading events…" />}
        {events.isError && <ErrorState error={events.error} onRetry={() => events.refetch()} />}
        {events.data?.length === 0 && (
          <EmptyState icon={<ShieldAlert className="h-6 w-6" />} label="No safety events recorded" hint="Interlocks have not tripped in this session." />
        )}
        {events.data && events.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="label-xs px-4 py-2.5">Severity</th>
                  <th className="label-xs px-4 py-2.5">Machine</th>
                  <th className="label-xs px-4 py-2.5">Rule</th>
                  <th className="label-xs px-4 py-2.5">Parameter</th>
                  <th className="label-xs px-4 py-2.5">Trigger / threshold</th>
                  <th className="label-xs px-4 py-2.5">Action</th>
                  <th className="label-xs px-4 py-2.5">When</th>
                </tr>
              </thead>
              <tbody>
                {events.data.map((e, i) => (
                  <tr key={`${e.rule_id}-${i}`} className="border-b border-hairline/60 last:border-0 hover:bg-raised/60">
                    <td className="px-4 py-2.5">
                      <Badge severity={severityOf(e.severity)}>{e.severity}</Badge>
                    </td>
                    <td className="tnum px-4 py-2.5 text-ink">{e.machine_id}</td>
                    <td className="tnum px-4 py-2.5 text-muted">{e.rule_id}</td>
                    <td className="px-4 py-2.5 text-muted">{e.parameter}</td>
                    <td className="tnum px-4 py-2.5 text-ink">
                      {num(e.trigger_value, 1)} / {num(e.threshold_value, 1)}
                    </td>
                    <td className="px-4 py-2.5 text-muted">{e.action_taken}</td>
                    <td className="tnum px-4 py-2.5 text-muted">{dateTime(e.created_at ?? e.timestamp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
