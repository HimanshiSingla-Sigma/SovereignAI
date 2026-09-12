import { useState, type FormEvent } from 'react'
import { Loader2, UserPlus, UserX } from 'lucide-react'
import { useCreateUser, useDeactivateUser, useUpdateUser, useUsers } from '@/hooks/useApi'
import { useAuthStore } from '@/store/authStore'
import { useSound } from '@/hooks/useSound'
import { ApiError } from '@/lib/apiClient'
import { dateTime } from '@/lib/format'
import { Badge, EmptyState, ErrorState, Loading, Panel } from '@/components/ui'

const ROLES = ['OPERATOR', 'ENGINEER', 'SAFETY_OFFICER', 'ADMINISTRATOR']

export default function UsersTab() {
  const users = useUsers()
  const canCreate = useAuthStore((s) => s.permissions.includes('users:create'))
  const canAssign = useAuthStore((s) => s.permissions.includes('roles:assign'))
  const canDisable = useAuthStore((s) => s.permissions.includes('users:disable'))
  const { play } = useSound()

  const createUser = useCreateUser()
  const updateUser = useUpdateUser()
  const deactivate = useDeactivateUser()

  const [form, setForm] = useState({ username: '', email: '', full_name: '', password: '', role: 'OPERATOR' })
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)
    try {
      const created = await createUser.mutateAsync({
        username: form.username.trim(),
        email: form.email.trim(),
        full_name: form.full_name.trim() || null,
        password: form.password,
        role: form.role,
      })
      play('hydraulic')
      setNotice(`${created.username} created with role ${form.role}. MFA enrolment is required at first sign-in.`)
      setForm({ username: '', email: '', full_name: '', password: '', role: 'OPERATOR' })
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'User creation failed.')
    }
  }

  const changeRole = async (id: number, role: string) => {
    setError(null)
    try {
      await updateUser.mutateAsync({ id, body: { role } })
      play('click')
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Role change failed.')
    }
  }

  const toggleActive = async (id: number, isActive: boolean) => {
    setError(null)
    try {
      if (isActive) await deactivate.mutateAsync(id)
      else await updateUser.mutateAsync({ id, body: { is_active: true } })
      play('toggle')
    } catch (err) {
      play('denied')
      setError(err instanceof ApiError ? err.detail : 'Update failed.')
    }
  }

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <Panel className="xl:col-span-1" title="Create user" subtitle="MFA is enforced on every new account">
        {!canCreate ? (
          <EmptyState label="users:create not granted to your role." />
        ) : (
          <form className="space-y-3" onSubmit={submit}>
            {(
              [
                { key: 'username', label: 'Username', type: 'text', required: true },
                { key: 'email', label: 'Email', type: 'email', required: true },
                { key: 'full_name', label: 'Full name', type: 'text', required: false },
                { key: 'password', label: 'Initial password', type: 'password', required: true },
              ] as const
            ).map((f) => (
              <div key={f.key}>
                <label className="label-xs" htmlFor={`u-${f.key}`}>
                  {f.label}
                </label>
                <input
                  id={`u-${f.key}`}
                  type={f.type}
                  required={f.required}
                  className="field mt-1.5"
                  value={form[f.key]}
                  autoComplete="off"
                  onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                />
              </div>
            ))}

            <div>
              <label className="label-xs" htmlFor="u-role">
                Role
              </label>
              <select
                id="u-role"
                className="field mt-1.5"
                value={form.role}
                onChange={(e) => setForm((s) => ({ ...s, role: e.target.value }))}
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <button type="submit" className="btn btn-primary w-full" disabled={createUser.isPending}>
              {createUser.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              Create user
            </button>

            {error && <p className="rounded-ctl border border-crit/40 bg-crit/10 px-3 py-2 text-xs text-crit">{error}</p>}
            {notice && <p className="rounded-ctl border border-ok/40 bg-ok/10 px-3 py-2 text-xs text-ok">{notice}</p>}
          </form>
        )}
      </Panel>

      <Panel className="xl:col-span-2" title="Accounts" subtitle={users.data ? `${users.data.length} users` : undefined} bodyClass="p-0">
        {users.isPending && <Loading label="Loading users…" />}
        {users.isError && <ErrorState error={users.error} onRetry={() => users.refetch()} />}
        {users.data && users.data.length === 0 && <EmptyState label="No users found." />}
        {users.data && users.data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead>
                <tr className="border-b border-hairline">
                  <th className="label-xs px-4 py-2.5">User</th>
                  <th className="label-xs px-4 py-2.5">Role</th>
                  <th className="label-xs px-4 py-2.5">MFA</th>
                  <th className="label-xs px-4 py-2.5">Last login</th>
                  <th className="label-xs px-4 py-2.5">Status</th>
                  <th className="label-xs px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {users.data.map((u) => (
                  <tr key={u.id} className="border-b border-hairline/60 last:border-0 hover:bg-raised/60">
                    <td className="px-4 py-3">
                      <div className="tnum text-ink">{u.username}</div>
                      <div className="truncate text-[10px] text-muted">{u.full_name || u.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      {canAssign ? (
                        <select
                          className="min-h-[38px] rounded-ctl border border-hairline bg-card px-2.5 py-1 text-xs font-medium text-ink transition-colors shadow-sm focus:border-accent focus:outline-none"
                          value={u.roles[0] ?? 'OPERATOR'}
                          onChange={(e) => void changeRole(u.id, e.target.value)}
                          disabled={updateUser.isPending}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r} className="bg-card text-ink">
                              {r}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <Badge severity="muted">{u.roles[0] ?? '—'}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <Badge severity={u.mfa_enabled ? 'ok' : 'warn'}>{u.mfa_enabled ? 'ENFORCED' : 'OFF'}</Badge>
                    </td>
                    <td className="tnum px-4 py-3 text-muted">{dateTime(u.last_login)}</td>
                    <td className="px-4 py-3">
                      <Badge severity={u.is_active ? 'ok' : 'crit'}>{u.is_active ? 'ACTIVE' : 'DISABLED'}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {canDisable && (
                        <button
                          type="button"
                          className="btn btn-sm"
                          onClick={() => void toggleActive(u.id, u.is_active)}
                          disabled={deactivate.isPending || updateUser.isPending}
                          title={u.is_active ? 'Deactivate account' : 'Reactivate account'}
                        >
                          <UserX className="h-3.5 w-3.5" />
                          {u.is_active ? 'Disable' : 'Enable'}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
