import { useState } from 'react'
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from 'lucide-react'
import { useApprovals, useDecideApproval } from '@/hooks/useApi'
import { useAuthStore } from '@/store/authStore'
import { useSound } from '@/hooks/useSound'
import { ApiError } from '@/lib/apiClient'
import { dateTime, severityOf } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel } from '@/components/ui'

export default function ApprovalsPage() {
  const approvals = useApprovals()
  const canApprove = useAuthStore((s) => s.permissions.includes('safety:approve'))
  const decide = useDecideApproval()
  const { play } = useSound()

  const [reasons, setReasons] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [activeId, setActiveId] = useState<string | null>(null)

  const submit = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    const reason = (reasons[requestId] ?? '').trim()
    if (!reason) {
      setError('A decision reason is required — it is written to the immutable audit chain.')
      setActiveId(requestId)
      return
    }
    setError(null)
    setNotice(null)
    setActiveId(requestId)
    try {
      const res = await decide.mutateAsync({ requestId, decision, reason })
      // Hydraulic "psssh-clank" fires when an approval actually actuates.
      play(decision === 'APPROVED' ? 'hydraulic' : 'denied')
      setNotice(
        decision === 'APPROVED'
          ? `${requestId} approved — actuator command ${res.actuator_result ? 'dispatched' : 'recorded'}.`
          : `${requestId} rejected. No actuator command was issued.`,
      )
      setReasons((r) => ({ ...r, [requestId]: '' }))
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Decision failed.')
    } finally {
      setActiveId(null)
    }
  }

  const pending = approvals.data?.filter((a) => a.status === 'PENDING') ?? []
  const decided = approvals.data?.filter((a) => a.status !== 'PENDING') ?? []

  return (
    <div className="space-y-4">
      <PageHeader
        title="Human-in-the-loop approvals"
        subtitle="Sensitive actuator commands require an authorized human decision"
        right={<Badge severity={pending.length ? 'warn' : 'ok'}>{pending.length} pending</Badge>}
      />

      {approvals.isPending && <Loading label="Loading approval queue…" />}
      {approvals.isError && <ErrorState error={approvals.error} onRetry={() => approvals.refetch()} />}

      {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}
      {notice && <p className="rounded-ctl border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{notice}</p>}

      {approvals.data && (
        <>
          <Panel title="Pending" subtitle={canApprove ? 'Your role can authorize these' : 'Read-only for your role'} bodyClass="p-3 sm:p-4">
            {pending.length === 0 ? (
              <EmptyState icon={<ShieldCheck className="h-6 w-6" />} label="Nothing awaiting authorization" />
            ) : (
              <ul className="space-y-3">
                {pending.map((a) => (
                  <li key={a.request_id} className="rounded-ctl border border-warn/40 bg-warn/5 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge severity="warn">{a.action_type}</Badge>
                      <span className="tnum text-xs text-ink">{a.target_resource}</span>
                      <span className="tnum ml-auto text-[10px] text-muted">{a.request_id}</span>
                    </div>
                    <p className="mt-2 text-xs leading-relaxed text-ink">{a.justification}</p>
                    <div className="tnum mt-1.5 flex flex-wrap gap-x-3 text-[10px] text-muted">
                      <span>by {a.requested_by}</span>
                      <span>requires {a.required_role}</span>
                      <span>{dateTime(a.created_at)}</span>
                    </div>

                    {canApprove ? (
                      <div className="mt-3 space-y-2">
                        <input
                          className="field"
                          placeholder="Decision reason (required, audited)"
                          value={reasons[a.request_id] ?? ''}
                          onChange={(e) => setReasons((r) => ({ ...r, [a.request_id]: e.target.value }))}
                        />
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="btn flex-1 border-ok/50 text-ok hover:border-ok hover:text-ok"
                            onClick={() => void submit(a.request_id, 'APPROVED')}
                            disabled={decide.isPending && activeId === a.request_id}
                          >
                            {decide.isPending && activeId === a.request_id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            Approve
                          </button>
                          <button
                            type="button"
                            className="btn btn-danger flex-1"
                            onClick={() => void submit(a.request_id, 'REJECTED')}
                            disabled={decide.isPending && activeId === a.request_id}
                          >
                            <XCircle className="h-4 w-4" /> Reject
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-2 text-[11px] text-muted">Requires safety:approve to decide.</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel title="Decision history" bodyClass="p-0">
            {decided.length === 0 ? (
              <EmptyState label="No decisions recorded yet." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-xs">
                  <thead>
                    <tr className="border-b border-hairline">
                      <th className="label-xs px-4 py-2.5">Request</th>
                      <th className="label-xs px-4 py-2.5">Action</th>
                      <th className="label-xs px-4 py-2.5">Target</th>
                      <th className="label-xs px-4 py-2.5">Requested by</th>
                      <th className="label-xs px-4 py-2.5">Status</th>
                      <th className="label-xs px-4 py-2.5">Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decided.map((a) => (
                      <tr key={a.request_id} className="border-b border-hairline/60 last:border-0 hover:bg-raised/60">
                        <td className="tnum px-4 py-2.5 text-muted">{a.request_id}</td>
                        <td className="px-4 py-2.5 text-ink">{a.action_type}</td>
                        <td className="tnum px-4 py-2.5 text-muted">{a.target_resource}</td>
                        <td className="tnum px-4 py-2.5 text-muted">{a.requested_by}</td>
                        <td className="px-4 py-2.5">
                          <Badge severity={severityOf(a.status)}>{a.status}</Badge>
                        </td>
                        <td className="tnum px-4 py-2.5 text-muted">{dateTime(a.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
