import type { ReactNode } from 'react'
import { useAuthStore } from '@/store/authStore'
import { PermissionNotice } from '@/components/ui'

/**
 * Route guard. Frontend gating is UX only — the backend re-checks the same
 * permission on every call — but it keeps operators out of screens that would
 * only render 403s.
 */
export default function RequirePermission({ permission, children }: { permission: string; children: ReactNode }) {
  const allowed = useAuthStore((s) => s.permissions.includes(permission))
  if (!allowed) return <PermissionNotice permission={permission} />
  return <>{children}</>
}
