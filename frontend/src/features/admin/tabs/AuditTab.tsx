import { useState } from 'react'
import { FileCheck2, RefreshCw } from 'lucide-react'
import { useAuditLogs, useAuditVerify } from '@/hooks/useApi'
import { severityOf } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, Panel } from '@/components/ui'

const RESULTS = ['', 'SUCCESS', 'FAILURE', 'DENIED', 'BLOCKED']

export default function AuditTab() {
  const [limit, setLimit] = useState(100)
  const [who, setWho] = useState('')
  const [result, setResult] = useState('')

  const logs = useAuditLogs({ limit, who: who || undefined, result: result || undefined })
  const verify = useAuditVerify()

  return (
    <div className="space-y-4">
      <Panel
        title="Chain integrity"
        subtitle="Every record is checksum-linked to the one before it"
        right={
          <button type="button" className="btn btn-sm" onClick={() => void verify.refetch()} disabled={verify.isFetching}>
            <RefreshCw className={`h-3.5 w-3.5 ${verify.isFetching ? 'animate-spin' : ''}`} /> Verify
          </button>
        }
      >
        {verify.isPending && <Loading label="Verifying chain…" />}
        {verify.isError && <ErrorState error={verify.error} onRetry={() => verify.refetch()} />}
        {verify.data && (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(verify.data).map(([k, v]) => (
              <div key={k} className="rounded-ctl border border-hairline bg-raised px-3 py-2">
                <div className="label-xs">{k.replace(/_/g, ' ')}</div>
                <div className="tnum mt-1 truncate text-sm text-ink" title={String(v)}>
                  {typeof v === 'boolean' ? (
                    <Badge severity={v ? 'ok' : 'crit'}>{v ? 'VALID' : 'BROKEN'}</Badge>
                  ) : (
                    String(v)
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <Panel
        title="Audit trail"
        subtitle="Immutable, append-only, stored locally"
        right={<FileCheck2 className="h-4 w-4 text-muted" />}
        bodyClass="p-0"
      >
        <div className="flex flex-wrap gap-2 border-b border-hairline p-3">
          <input
            className="field max-w-[200px]"
            placeholder="Filter by user"
            value={who}
            onChange={(e) => setWho(e.target.value)}
          />
          <select className="field max-w-[160px]" value={result} onChange={(e) => setResult(e.target.value)}>
            {RESULTS.map((r) => (
              <option key={r || 'all'} value={r}>
                {r || 'All results'}
              </option>
            ))}
          </select>
          <select className="field max-w-[140px]" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
            {[50, 100, 250, 500].map((n) => (
              <option key={n} value={n}>
                Last {n}
              </option>
            ))}
          </select>
        </div>

        {logs.isPending && <Loading label="Loading audit records…" />}
        {logs.isError && <ErrorState error={logs.error} onRetry={() => logs.refetch()} />}
        {logs.data?.length === 0 && <EmptyState label="No audit records match this filter." />}
        {logs.data && logs.data.length > 0 && (
          <div className="max-h-[560px] overflow-auto">
            <table className="w-full min-w-[820px] text-left text-xs">
              <thead className="sticky top-0 bg-card">
                <tr className="border-b border-hairline">
                  <th className="label-xs px-4 py-2.5">Timestamp</th>
                  <th className="label-xs px-4 py-2.5">Who</th>
                  <th className="label-xs px-4 py-2.5">What</th>
                  <th className="label-xs px-4 py-2.5">Resource</th>
                  <th className="label-xs px-4 py-2.5">Result</th>
                  <th className="label-xs px-4 py-2.5">Reason</th>
                  <th className="label-xs px-4 py-2.5">Checksum</th>
                </tr>
              </thead>
              <tbody>
                {logs.data.map((l, i) => (
                  <tr key={`${l.checksum}-${i}`} className="border-b border-hairline/60 last:border-0 hover:bg-raised/60">
                    <td className="tnum px-4 py-2.5 text-muted">{l.timestamp}</td>
                    <td className="tnum px-4 py-2.5 text-ink">{l.who}</td>
                    <td className="tnum px-4 py-2.5 text-ink">{l.what}</td>
                    <td className="tnum px-4 py-2.5 text-muted">{l.resource}</td>
                    <td className="px-4 py-2.5">
                      <Badge severity={severityOf(l.result)}>{l.result}</Badge>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-2.5 text-muted" title={l.reason}>
                      {l.reason || '—'}
                    </td>
                    <td className="tnum px-4 py-2.5 text-muted" title={l.checksum}>
                      {l.checksum.slice(0, 12)}…
                    </td>
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
