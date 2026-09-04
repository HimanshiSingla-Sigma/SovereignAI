import { useEffect, useMemo, useState } from 'react'
import { CheckCircle2, Globe, Network, ShieldOff } from 'lucide-react'
import { useNetworkEgress } from '@/hooks/useApi'
import { bytes, clockTime } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel, Stat } from '@/components/ui'

const HISTORY_LIMIT = 40

export default function NetworkPage() {
  const egress = useNetworkEgress()
  const [series, setSeries] = useState<Array<{ t: string; external: number }>>([])

  // Build the sparkline from successive polls of the real egress check.
  useEffect(() => {
    if (!egress.data) return
    setSeries((prev) =>
      [...prev, { t: egress.data!.checked_at, external: egress.data!.external_connections }].slice(-HISTORY_LIMIT),
    )
  }, [egress.data])

  const airGapped = egress.data?.air_gapped ?? false

  // The host can hold several sockets to the same remote address; collapse them
  // so the list stays readable (and keyed uniquely).
  const endpointCounts = useMemo(() => {
    const counts = new Map<string, number>()
    ;(egress.data?.external_endpoints ?? []).forEach((ep) => counts.set(ep, (counts.get(ep) ?? 0) + 1))
    return counts
  }, [egress.data])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Network sovereignty"
        subtitle="Live evidence that nothing leaves this machine"
        right={
          egress.data && (
            <Badge severity={airGapped ? 'ok' : 'crit'}>
              <Network className="h-3 w-3" /> {airGapped ? 'AIR-GAPPED' : 'EGRESS DETECTED'}
            </Badge>
          )
        }
      />

      {egress.isPending && <Loading label="Probing host network…" />}
      {egress.isError && <ErrorState error={egress.error} onRetry={() => egress.refetch()} />}

      {egress.data && (
        <>
          <Panel bodyClass="p-4 sm:p-6">
            <div
              className={`flex flex-col items-center gap-3 rounded-card border px-4 py-8 text-center sm:flex-row sm:justify-center sm:text-left ${
                airGapped ? 'border-ok/40 bg-ok/5' : 'border-crit/50 bg-crit/5'
              }`}
            >
              {airGapped ? (
                <CheckCircle2 className="h-10 w-10 shrink-0 text-ok" />
              ) : (
                <ShieldOff className="h-10 w-10 shrink-0 text-crit" />
              )}
              <div>
                <div className={`tnum text-xl font-bold sm:text-2xl ${airGapped ? 'text-ok' : 'text-crit'}`}>
                  OUTBOUND CONNECTIONS: {egress.data.external_connections}
                </div>
                <p className="mt-1 text-xs text-muted">
                  {airGapped ? 'AIR-GAPPED · no route to internet' : 'An internet-routable socket is open on this host'}
                </p>
                <p className="tnum mt-1 text-[11px] text-muted">
                  egress test: {egress.data.egress_test} ({egress.data.egress_target}) · internal (LAN/loopback):{' '}
                  {egress.data.internal_connections}
                </p>
              </div>
            </div>
          </Panel>

          <Panel title="External connections over time" subtitle={`Sampled every 5 s · last check ${clockTime(egress.data.checked_at)}`}>
            <div className="flex h-28 items-end gap-[3px]">
              {series.length === 0 ? (
                <div className="flex h-full w-full items-center justify-center text-xs text-muted">Collecting samples…</div>
              ) : (
                series.map((s, i) => (
                  <div
                    key={`${s.t}-${i}`}
                    className={`min-w-[3px] flex-1 rounded-t ${s.external === 0 ? 'bg-ok/70' : 'bg-crit'}`}
                    style={{ height: s.external === 0 ? '3px' : `${Math.min(100, 12 + s.external * 18)}%` }}
                    title={`${clockTime(s.t)} — ${s.external} external`}
                  />
                ))
              )}
            </div>
            <div className="mt-2 flex justify-between text-[10px] text-muted">
              <span className="tnum">0</span>
              <span>{series.length} samples</span>
            </div>
          </Panel>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Stat label="External" value={egress.data.external_connections} severity={egress.data.external_connections ? 'crit' : 'ok'} hint="internet-routable sockets" />
            <Stat label="Internal" value={egress.data.internal_connections} severity="info" hint="LAN / loopback sockets" />
            <Stat label="Out bytes" value={bytes(egress.data.outbound_bytes)} severity="muted" hint="host NIC counter" />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="External endpoints" subtitle="Any socket leaving the local network">
              {egress.data.external_endpoints.length === 0 ? (
                <EmptyState
                  icon={<Globe className="h-6 w-6" />}
                  label="No external endpoints"
                  hint="Every open socket terminates on loopback or the plant LAN."
                />
              ) : (
                <ul className="space-y-2">
                  {[...endpointCounts.entries()].map(([ep, count]) => (
                    <li
                      key={ep}
                      className="tnum flex items-center gap-2 rounded-ctl border border-crit/40 bg-crit/5 px-3 py-2 text-xs text-crit"
                    >
                      <span className="min-w-0 flex-1 truncate">{ep}</span>
                      {count > 1 && <span className="shrink-0 text-[10px] text-muted">×{count}</span>}
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            <Panel title="Host interfaces" subtitle={egress.data.detail}>
              {egress.data.interfaces.length === 0 ? (
                <EmptyState label="Interface enumeration unavailable on this host." />
              ) : (
                <ul className="space-y-2">
                  {egress.data.interfaces.map((iface) => (
                    <li key={iface.name} className="rounded-ctl border border-hairline bg-raised px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className="tnum text-xs text-ink">{iface.name}</span>
                        {iface.is_loopback && <Badge severity="muted">loopback</Badge>}
                      </div>
                      <div className="tnum mt-1 flex flex-wrap gap-x-3 text-[10px] text-muted">
                        {iface.addresses.length ? iface.addresses.map((a) => <span key={a}>{a}</span>) : <span>no address</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>
          </div>
        </>
      )}
    </div>
  )
}
