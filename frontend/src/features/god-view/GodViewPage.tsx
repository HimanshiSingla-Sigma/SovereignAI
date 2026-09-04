import { Suspense, lazy, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Boxes, Maximize2 } from 'lucide-react'
import { useMachines } from '@/hooks/useApi'
import { useAlertStore } from '@/store/alertStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSelectionStore } from '@/store/selectionStore'
import { useSound } from '@/hooks/useSound'
import { num, severityOf } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, PageHeader, Panel, StatusDot } from '@/components/ui'
import IsoFloor2D from './IsoFloor2D'
import { BAYS, buildFloor } from './bays'

// Three.js only enters the bundle graph when Full mode actually renders it.
const Floor3D = lazy(() => import('./Floor3D'))

export default function GodViewPage() {
  const machines = useMachines()
  const live = useAlertStore((s) => s.live)
  const perfMode = useSettingsStore((s) => s.perfMode)
  const select = useSelectionStore((s) => s.select)
  const { play } = useSound()
  const navigate = useNavigate()

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [zooming, setZooming] = useState<string | null>(null)

  const floor = useMemo(() => buildFloor(machines.data ?? [], live), [machines.data, live])

  // Click a machine → brief zoom flourish, then land on its digital twin.
  const zoomInto = (machineId: string) => {
    play('toggle')
    setSelectedId(machineId)
    setZooming(machineId)
    window.setTimeout(() => {
      select(machineId, 'god-view')
      navigate('/digital-twin')
    }, 420)
  }

  const counts = useMemo(() => {
    const c = { steady: 0, blink: 0, strobe: 0 }
    floor.forEach((f) => {
      c[f.beacon] += 1
    })
    return c
  }, [floor])

  return (
    <div className="space-y-4">
      <PageHeader
        title="Plant floor"
        subtitle="Every asset in its bay, beacons driven by the live telemetry stream"
        right={
          <>
            <Badge severity="ok">
              <StatusDot severity="ok" /> {counts.steady} normal
            </Badge>
            <Badge severity="warn">
              <StatusDot severity="warn" pulse /> {counts.blink} warning
            </Badge>
            <Badge severity="crit">
              <StatusDot severity="crit" pulse /> {counts.strobe} critical
            </Badge>
          </>
        }
      />

      {machines.isPending && <Loading label="Loading plant layout…" />}
      {machines.isError && <ErrorState error={machines.error} onRetry={() => machines.refetch()} />}
      {machines.data && machines.data.length === 0 && <EmptyState label="No assets to place on the floor." />}

      {machines.data && machines.data.length > 0 && (
        <>
          <Panel
            title={perfMode === 'full' ? 'Isometric floor — 3D' : 'Isometric floor — Lite'}
            subtitle="Tap a machine to zoom into its digital twin · drag to rotate"
            right={
              <Badge severity="info">
                <Maximize2 className="h-3 w-3" /> {perfMode === 'full' ? 'Full' : 'Lite'}
              </Badge>
            }
            bodyClass="p-0"
          >
            <div
              className={`relative h-[340px] overflow-hidden rounded-b-card bg-[#0b0e13] transition-transform duration-300 sm:h-[460px]
                ${zooming ? 'scale-[1.06] opacity-70' : 'scale-100'}`}
            >
              {perfMode === 'full' ? (
                <Suspense fallback={<Loading label="Initialising 3D floor…" />}>
                  <Floor3D floor={floor} onSelect={zoomInto} selectedId={selectedId} />
                </Suspense>
              ) : (
                <IsoFloor2D floor={floor} onSelect={zoomInto} selectedId={selectedId} />
              )}
            </div>
          </Panel>

          {/* Bay roster — the same live data as a list, and the touch fallback */}
          <div className="grid gap-4 lg:grid-cols-3">
            {BAYS.map((bay) => {
              const inBay = floor.filter((f) => f.bay === bay)
              return (
                <Panel key={bay} title={bay} subtitle={`${inBay.length} assets`} bodyClass="p-3">
                  {inBay.length === 0 ? (
                    <EmptyState label="Bay empty" icon={<Boxes className="h-5 w-5" />} />
                  ) : (
                    <ul className="space-y-2">
                      {inBay.map((f) => (
                        <li key={f.machine.machine_id}>
                          <button
                            type="button"
                            onClick={() => zoomInto(f.machine.machine_id)}
                            className="flex w-full min-h-[44px] items-center gap-2.5 rounded-ctl border border-hairline bg-raised
                              px-3 py-2 text-left transition-colors hover:border-accent/40"
                          >
                            <span
                              className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                                f.beacon === 'strobe'
                                  ? 'animate-beacon-strobe'
                                  : f.beacon === 'blink'
                                    ? 'animate-beacon-blink'
                                    : ''
                              }`}
                              style={{ background: f.color }}
                            />
                            <span className="min-w-0 flex-1">
                              <span className="tnum block truncate text-xs text-ink">{f.machine.machine_id}</span>
                              <span className="block truncate text-[10px] text-muted">{f.machine.name}</span>
                            </span>
                            <span className="shrink-0 text-right">
                              <span className={`block text-[10px] ${severityOf(f.status) === 'crit' ? 'text-crit' : severityOf(f.status) === 'warn' ? 'text-warn' : 'text-ok'}`}>
                                {f.status}
                              </span>
                              <span className="tnum block text-[10px] text-muted">anom {num(f.anomaly, 1)}</span>
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </Panel>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
