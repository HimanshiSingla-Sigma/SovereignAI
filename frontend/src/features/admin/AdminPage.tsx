import { useState } from 'react'
import { Cpu, FileCheck2, ShieldAlert, Users, KeyRound } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { useSound } from '@/hooks/useSound'
import { PageHeader, PermissionNotice } from '@/components/ui'
import UsersTab from './tabs/UsersTab'
import RolesTab from './tabs/RolesTab'
import HardwareTab from './tabs/HardwareTab'
import SecurityTab from './tabs/SecurityTab'
import AuditTab from './tabs/AuditTab'

type TabId = 'users' | 'roles' | 'hardware' | 'security' | 'audit'

const TABS: Array<{ id: TabId; label: string; icon: typeof Users; permission: string }> = [
  { id: 'users', label: 'Users', icon: Users, permission: 'users:read' },
  { id: 'roles', label: 'Roles', icon: KeyRound, permission: 'users:read' },
  { id: 'hardware', label: 'Hardware', icon: Cpu, permission: 'machines:read' },
  { id: 'security', label: 'Security', icon: ShieldAlert, permission: 'security:configure' },
  { id: 'audit', label: 'Audit', icon: FileCheck2, permission: 'audit:read' },
]

export default function AdminPage() {
  const permissions = useAuthStore((s) => s.permissions)
  const { play } = useSound()
  const visible = TABS.filter((t) => permissions.includes(t.permission))
  const [tab, setTab] = useState<TabId>(visible[0]?.id ?? 'users')

  const active = visible.find((t) => t.id === tab) ?? visible[0]

  return (
    <div className="space-y-4">
      <PageHeader title="Administration" subtitle="Identity, governance, hardware and the audit chain" />

      <div className="flex flex-wrap gap-2">
        {visible.map((t) => {
          const Icon = t.icon
          return (
            <button
              key={t.id}
              type="button"
              className={`chip ${tab === t.id ? 'chip-active' : ''}`}
              onClick={() => {
                play('click')
                setTab(t.id)
              }}
            >
              <Icon className="h-3.5 w-3.5" /> {t.label}
            </button>
          )
        })}
      </div>

      {!active && <PermissionNotice permission="users:read" />}
      {active?.id === 'users' && <UsersTab />}
      {active?.id === 'roles' && <RolesTab />}
      {active?.id === 'hardware' && <HardwareTab />}
      {active?.id === 'security' && <SecurityTab />}
      {active?.id === 'audit' && <AuditTab />}
    </div>
  )
}
