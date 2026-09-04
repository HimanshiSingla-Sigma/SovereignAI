import { useCompatibilityReport, useHardwareProfile, useModelRegistry } from '@/hooks/useApi'
import { num } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, Panel, Stat } from '@/components/ui'

export default function HardwareTab() {
  const profile = useHardwareProfile()
  const models = useModelRegistry()
  const compatibility = useCompatibilityReport()

  return (
    <div className="space-y-4">
      <Panel title="Hardware capability" subtitle="Detected on this host at startup">
        {profile.isPending && <Loading label="Probing hardware…" />}
        {profile.isError && <ErrorState error={profile.error} onRetry={() => profile.refetch()} />}
        {profile.data && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              <Stat label="Hardware tier" value={profile.data.hardware_tier} severity="info" />
              <Stat label="Acceleration" value={profile.data.acceleration} severity={profile.data.has_dedicated_gpu ? 'ok' : 'muted'} />
              <Stat label="Total RAM" value={num(profile.data.total_ram_gb)} unit="GB" severity="muted" hint={`${num(profile.data.available_ram_gb)} GB free`} />
              <Stat label="Model budget" value={num(profile.data.max_safe_model_ram_gb)} unit="GB" severity="warn" hint="safe allocation" />
            </div>

            <dl className="mt-4 grid gap-3 text-xs sm:grid-cols-2 lg:grid-cols-3">
              {[
                ['CPU', profile.data.cpu_model],
                ['Cores', `${profile.data.physical_cores} physical / ${profile.data.logical_cores} logical`],
                ['GPU', profile.data.gpu_name],
                ['GPU vendor', profile.data.gpu_vendor],
                ['Dedicated GPU', profile.data.has_dedicated_gpu ? 'yes' : 'no'],
                ['GPU memory', `${num(profile.data.gpu_memory_mb, 0)} MB`],
                ['Operating system', profile.data.operating_system],
              ].map(([k, v]) => (
                <div key={k} className="rounded-ctl border border-hairline bg-raised px-3 py-2">
                  <dt className="label-xs">{k}</dt>
                  <dd className="tnum mt-1 truncate text-ink" title={String(v)}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
      </Panel>

      <Panel title="Model registry" subtitle="Auto-selected against the detected hardware" bodyClass="p-0">
        {models.isPending && <Loading label="Evaluating models…" />}
        {models.isError && <ErrorState error={models.error} onRetry={() => models.refetch()} />}
        {models.data?.length === 0 && <EmptyState label="No models in the registry." />}
        {models.data && models.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="label-xs px-4 py-2.5">Model</th>
                  <th className="label-xs px-4 py-2.5">Params</th>
                  <th className="label-xs px-4 py-2.5">Quant</th>
                  <th className="label-xs px-4 py-2.5">RAM</th>
                  <th className="label-xs px-4 py-2.5">VRAM</th>
                  <th className="label-xs px-4 py-2.5">Tier</th>
                  <th className="label-xs px-4 py-2.5 text-right">Fit</th>
                </tr>
              </thead>
              <tbody>
                {models.data.map((m) => (
                  <tr key={m.model_id} className="border-b border-hairline/60 last:border-0 hover:bg-raised/60">
                    <td className="px-4 py-3">
                      <div className="tnum text-ink">{m.model_id}</div>
                      <div className="truncate text-[10px] text-muted" title={m.description}>
                        {m.description}
                      </div>
                    </td>
                    <td className="tnum px-4 py-3 text-muted">{m.parameters}</td>
                    <td className="tnum px-4 py-3 text-muted">{m.quantization}</td>
                    <td className="tnum px-4 py-3 text-muted">{num(m.ram_required_gb)} GB</td>
                    <td className="tnum px-4 py-3 text-muted">{m.vram_required_gb ? `${num(m.vram_required_gb)} GB` : '—'}</td>
                    <td className="tnum px-4 py-3 text-muted">{m.recommended_tier}</td>
                    <td className="px-4 py-3 text-right">
                      <Badge severity={m.is_compatible ? 'ok' : 'crit'}>{m.is_compatible ? 'COMPATIBLE' : 'NEEDS GPU'}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      <Panel title="Compatibility evaluation" subtitle="Per-model reasoning from the compatibility checker">
        {compatibility.isPending && <Loading label="Loading report…" />}
        {compatibility.isError && <ErrorState error={compatibility.error} onRetry={() => compatibility.refetch()} />}
        {compatibility.data && compatibility.data.model_evaluations.length === 0 && <EmptyState label="No evaluations returned." />}
        {compatibility.data && compatibility.data.model_evaluations.length > 0 && (
          <ul className="space-y-2">
            {compatibility.data.model_evaluations.map((ev) => (
              <li
                key={ev.model_id}
                className={`rounded-ctl border px-3 py-2 text-xs ${
                  ev.is_compatible ? 'border-ok/35 bg-ok/5' : 'border-hairline bg-raised'
                }`}
              >
                <div className="flex flex-wrap items-center gap-2">
                  <span className="tnum text-ink">{ev.model_id}</span>
                  <Badge severity={ev.is_compatible ? 'ok' : 'muted'}>{ev.is_compatible ? 'RUNS HERE' : 'BLOCKED'}</Badge>
                </div>
                {ev.reason && <p className="mt-1 text-[11px] text-muted">{ev.reason}</p>}
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  )
}
