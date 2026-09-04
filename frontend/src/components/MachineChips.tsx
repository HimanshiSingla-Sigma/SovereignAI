import type { MachineResponse } from '@/types/api'
import { useAlertStore } from '@/store/alertStore'
import { useSound } from '@/hooks/useSound'
import { severityOf } from '@/lib/format'
import { StatusDot } from '@/components/ui'

/**
 * Machine selector chips with a live status dot per machine.
 * The dot follows the WebSocket stream when a frame has arrived, and falls back
 * to the REST status otherwise.
 */
export default function MachineChips({
  machines,
  selected,
  onSelect,
}: {
  machines: MachineResponse[]
  selected: string | null
  onSelect: (machineId: string) => void
}) {
  const live = useAlertStore((s) => s.live)
  const { play } = useSound()

  return (
    <div className="flex flex-wrap gap-2">
      {machines.map((m) => {
        const status = live[m.machine_id]?.status ?? m.status
        const severity = severityOf(status)
        const isActive = selected === m.machine_id
        return (
          <button
            key={m.machine_id}
            type="button"
            onClick={() => {
              play('click')
              onSelect(m.machine_id)
            }}
            className={`chip ${isActive ? 'chip-active' : ''}`}
            title={`${m.name} · ${status}`}
          >
            <StatusDot severity={severity} pulse={severity === 'warn' || severity === 'crit'} />
            <span className="tnum">{m.machine_id}</span>
          </button>
        )
      })}
    </div>
  )
}
