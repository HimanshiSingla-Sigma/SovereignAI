import { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Topbar from './Topbar'
import WarRoom from './WarRoom'
import { useEmergencyAudio, usePlantWatch } from '@/hooks/usePlantWatch'
import { useEmergencyActive } from '@/store/alertStore'
import { useSettingsStore, applyTheme } from '@/store/settingsStore'

export default function AppShell() {
  const [navOpen, setNavOpen] = useState(false)
  const emergency = useEmergencyActive()
  const theme = useSettingsStore((s) => s.theme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // Plant-wide live watch + klaxon, mounted once for the whole session.
  usePlantWatch()
  useEmergencyAudio()

  return (
    <div className="flex min-h-screen">
      <Sidebar open={navOpen} onClose={() => setNavOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar onOpenNav={() => setNavOpen(true)} />
        <main
          className={`flex-1 px-3 py-4 sm:px-5 sm:py-6 safe-bottom ${
            // Clear the fixed lockdown banner so it never covers the page.
            emergency ? 'pt-[168px] sm:pt-[156px]' : ''
          }`}
        >
          <Outlet />
        </main>
      </div>

      <WarRoom />
    </div>
  )
}
