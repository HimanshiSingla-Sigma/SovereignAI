import { useMemo } from 'react'
import { useLocation } from 'react-router-dom'
import { Cpu, LogOut, Menu, Volume2, VolumeX, WifiOff, Zap, ZapOff } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { useSound } from '@/hooks/useSound'
import { NAV_ITEMS } from './nav'
import { Badge } from '@/components/ui'

const ROLE_TONE: Record<string, 'ok' | 'warn' | 'crit' | 'info' | 'muted'> = {
  ADMINISTRATOR: 'crit',
  SAFETY_OFFICER: 'warn',
  ENGINEER: 'info',
  OPERATOR: 'ok',
}

export default function Topbar({ onOpenNav }: { onOpenNav: () => void }) {
  const { pathname } = useLocation()
  const { username, role, logout } = useAuthStore()
  const { perfMode, muted, togglePerfMode, toggleMuted } = useSettingsStore()
  const { play } = useSound()

  const title = useMemo(() => NAV_ITEMS.find((i) => pathname.startsWith(i.to))?.label ?? 'Workbench', [pathname])
  const initials = (username ?? '?').slice(0, 2).toUpperCase()

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-hairline bg-base/95 px-3 backdrop-blur sm:px-4">
      <button
        type="button"
        className="flex h-11 w-11 items-center justify-center rounded-ctl text-muted hover:text-ink lg:hidden"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <h1 className="min-w-0 truncate text-sm font-semibold text-ink">{title}</h1>

      <Badge severity="ok" className="ml-1 hidden sm:inline-flex">
        <WifiOff className="h-3 w-3" /> Air-gapped
      </Badge>

      <div className="ml-auto flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => {
            togglePerfMode()
            play('toggle')
          }}
          className="flex min-h-[44px] items-center gap-1.5 rounded-ctl border border-hairline bg-raised px-2.5 text-[11px]
            text-muted transition-colors hover:border-accent/50 hover:text-accent sm:px-3"
          title={perfMode === 'full' ? 'Switch to Lite (disables 3D + heavy animation)' : 'Switch to Full (3D enabled)'}
        >
          {perfMode === 'full' ? <Zap className="h-3.5 w-3.5" /> : <ZapOff className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">{perfMode === 'full' ? 'Full' : 'Lite'}</span>
        </button>

        <button
          type="button"
          onClick={() => {
            // Play the relay click before muting so the action is audible.
            if (!muted) play('click')
            toggleMuted()
            if (muted) play('click')
          }}
          className="flex h-11 w-11 items-center justify-center rounded-ctl border border-hairline bg-raised text-muted
            transition-colors hover:border-accent/50 hover:text-accent"
          title={muted ? 'Unmute alarms and relay FX' : 'Mute alarms and relay FX'}
          aria-pressed={muted}
        >
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </button>

        <Badge severity={ROLE_TONE[role ?? ''] ?? 'muted'} className="hidden md:inline-flex">
          <Cpu className="h-3 w-3" /> {role ?? '—'}
        </Badge>

        <div
          className="flex h-9 w-9 items-center justify-center rounded-full border border-hairline bg-raised text-[11px]
            font-semibold text-accent"
          title={`${username ?? 'unknown'} · ${role ?? 'no role'}`}
        >
          {initials}
        </div>

        <button
          type="button"
          onClick={() => {
            play('toggle')
            logout()
          }}
          className="flex h-11 w-11 items-center justify-center rounded-ctl text-muted transition-colors hover:text-crit"
          title="Sign out"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </header>
  )
}
