import { NavLink } from 'react-router-dom'
import { X, Zap } from 'lucide-react'
import { GROUP_LABELS, NAV_ITEMS, type NavItem } from './nav'
import { useAuthStore } from '@/store/authStore'
import { useAlertStore } from '@/store/alertStore'
import { useSound } from '@/hooks/useSound'
import { severityOf } from '@/lib/format'
import { StatusDot } from '@/components/ui'

function NavRow({ item, onNavigate }: { item: NavItem; onNavigate: () => void }) {
  const { play } = useSound()
  const Icon = item.icon
  return (
    <NavLink
      to={item.to}
      onClick={() => {
        play('click')
        onNavigate()
      }}
      className={({ isActive }) =>
        `flex min-h-[44px] items-center gap-3 rounded-ctl px-3 text-sm transition-colors ${
          isActive
            ? 'border border-accent/30 bg-accent/10 text-accent'
            : 'border border-transparent text-muted hover:bg-raised hover:text-ink'
        }`
      }
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{item.label}</span>
    </NavLink>
  )
}

export default function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const permissions = useAuthStore((s) => s.permissions)
  const systemState = useAlertStore((s) => s.systemState)
  const emergency = useAlertStore((s) => s.emergency)

  const visible = NAV_ITEMS.filter((item) => permissions.includes(item.permission))
  const groups = (['OPERATIONS', 'INTELLIGENCE', 'GOVERNANCE'] as const).filter((g) =>
    visible.some((i) => i.group === g),
  )

  const state = emergency ? 'EMERGENCY' : systemState

  return (
    <>
      {/* Scrim for the mobile drawer */}
      {open && (
        <button
          type="button"
          aria-label="Close navigation"
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-[264px] flex-col border-r border-hairline bg-sidebar
          transition-transform duration-200 lg:static lg:z-auto lg:translate-x-0
          ${open ? 'translate-x-0' : '-translate-x-full'}`}
      >
        <div className="flex items-center gap-2.5 border-b border-hairline px-4 py-3.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-ctl bg-accent text-[#20160a]">
            <Zap className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold text-ink">Sovereign AI</div>
            <div className="truncate text-[10px] uppercase tracking-[0.14em] text-muted">Industrial Workbench</div>
          </div>
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-ctl text-muted lg:hidden"
            onClick={onClose}
            aria-label="Close navigation"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
          {groups.map((group) => (
            <div key={group}>
              <div className="label-xs px-3 pb-2">{GROUP_LABELS[group]}</div>
              <div className="space-y-1">
                {visible
                  .filter((i) => i.group === group)
                  .map((item) => (
                    <NavRow key={item.to} item={item} onNavigate={onClose} />
                  ))}
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-hairline px-4 py-3 safe-bottom">
          <div className="flex items-center gap-2 text-xs">
            <StatusDot severity={severityOf(state)} pulse={state !== 'NORMAL'} />
            <span className="text-muted">Plant state</span>
            <span className="tnum ml-auto font-medium text-ink">{state}</span>
          </div>
        </div>
      </aside>
    </>
  )
}
