import { Fragment, useMemo } from 'react'
import { Check } from 'lucide-react'
import { useAllPermissions, useRoles } from '@/hooks/useApi'
import { EmptyState, ErrorState, Loading, Panel } from '@/components/ui'

export default function RolesTab() {
  const roles = useRoles()
  const permissions = useAllPermissions()

  const categories = useMemo(() => {
    if (!permissions.data) return []
    const map = new Map<string, typeof permissions.data>()
    permissions.data.forEach((p) => {
      const list = map.get(p.category) ?? []
      list.push(p)
      map.set(p.category, list)
    })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [permissions.data])

  return (
    <Panel title="Role &amp; permission matrix" subtitle="The same matrix the backend enforces on every request" bodyClass="p-0">
      {(roles.isPending || permissions.isPending) && <Loading label="Loading governance matrix…" />}
      {roles.isError && <ErrorState error={roles.error} onRetry={() => roles.refetch()} />}
      {permissions.isError && <ErrorState error={permissions.error} onRetry={() => permissions.refetch()} />}
      {roles.data && permissions.data && categories.length === 0 && <EmptyState label="No permissions defined." />}

      {roles.data && permissions.data && categories.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-xs">
            <thead>
              <tr className="border-b border-hairline">
                <th className="label-xs sticky left-0 z-10 bg-card px-4 py-2.5">Permission</th>
                {roles.data.map((r) => (
                  <th key={r.name} className="label-xs px-3 py-2.5 text-center">
                    {r.name.replace('_', ' ')}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {categories.map(([category, perms]) => (
                <Fragment key={category}>
                  <tr className="bg-raised/60">
                    <td className="label-xs sticky left-0 z-10 bg-raised px-4 py-1.5 text-accent" colSpan={1}>
                      {category}
                    </td>
                    <td colSpan={roles.data.length} className="px-3 py-1.5" />
                  </tr>
                  {perms.map((p) => (
                    <tr key={p.code} className="border-b border-hairline/60 last:border-0">
                      <td className="sticky left-0 z-10 bg-card px-4 py-2.5">
                        <div className="tnum text-ink">{p.code}</div>
                        <div className="truncate text-[10px] text-muted" title={p.description}>
                          {p.description}
                        </div>
                      </td>
                      {roles.data!.map((r) => (
                        <td key={`${p.code}-${r.name}`} className="px-3 py-2.5 text-center">
                          {r.permissions.includes(p.code) ? (
                            <Check className="mx-auto h-3.5 w-3.5 text-ok" />
                          ) : (
                            <span className="text-muted/40">·</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  )
}
