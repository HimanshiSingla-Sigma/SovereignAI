import React, { useState, useEffect } from 'react';
import { Users, UserPlus, Shield, Cpu, HardDrive, FileText, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { apiClient } from '../../services/api';
import { UserProfile, HardwareProfile, ModelRegistryItem, AuditLogItem } from '../../types';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [hardware, setHardware] = useState<HardwareProfile | null>(null);
  const [models, setModels] = useState<ModelRegistryItem[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogItem[]>([]);

  // Create User Form state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('ENGINEER');
  const [formError, setFormError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [usersRes, hwRes, modRes, auditRes] = await Promise.all([
        apiClient.get('/users'),
        apiClient.get('/hardware/profile'),
        apiClient.get('/hardware/models'),
        apiClient.get('/audit/logs?limit=15'),
      ]);
      setUsers(usersRes.data);
      setHardware(hwRes.data);
      setModels(modRes.data);
      setAuditLogs(auditRes.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    try {
      await apiClient.post('/users', {
        username: newUsername,
        email: newEmail,
        full_name: newFullName,
        password: newPassword,
        role: newRole
      });
      setShowCreateModal(false);
      setNewUsername('');
      setNewEmail('');
      setNewFullName('');
      setNewPassword('');
      await fetchData();
    } catch (err: any) {
      setFormError(err.response?.data?.detail || 'Failed to create user account.');
    }
  };

  const handleToggleActive = async (user: UserProfile) => {
    try {
      await apiClient.put(`/users/${user.id}`, {
        is_active: !user.is_active
      });
      await fetchData();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Status update failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">SYSTEM ADMINISTRATION & PLATFORM GOVERNANCE</h2>
          <p className="text-xs text-slate-400">Strict RBAC Administration, Hardware Capabilities, Model Gateway & Audit Trails</p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition shadow-sm"
        >
          <UserPlus className="w-4 h-4" />
          <span>Provision New User Account</span>
        </button>
      </div>

      {/* Hardware Profile & Safe Budget Card */}
      {hardware && (
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Cpu className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">MEASURED HARDWARE CAPABILITY LAYER</h3>
            </div>
            <span className="text-xs font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
              {hardware.hardware_tier}
            </span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
            <div className="p-3 rounded-lg bg-industrial-950 border border-industrial-800">
              <span className="text-slate-500 text-[10px]">CPU MODEL & TOPOLOGY</span>
              <div className="text-slate-200 font-bold mt-1 truncate">{hardware.cpu_model}</div>
              <div className="text-slate-400 text-[11px]">{hardware.physical_cores} Physical Cores / {hardware.logical_cores} Threads</div>
            </div>

            <div className="p-3 rounded-lg bg-industrial-950 border border-industrial-800">
              <span className="text-slate-500 text-[10px]">HOST RAM ALLOCATION</span>
              <div className="text-slate-200 font-bold mt-1">{hardware.available_ram_gb} GB Avail / {hardware.total_ram_gb} GB Total</div>
              <div className="text-cyan-400 text-[11px]">Safe AI Budget: &lt; {hardware.max_model_ram_gb} GB</div>
            </div>

            <div className="p-3 rounded-lg bg-industrial-950 border border-industrial-800">
              <span className="text-slate-500 text-[10px]">GPU ACCELERATION</span>
              <div className="text-slate-200 font-bold mt-1">{hardware.gpu_name}</div>
              <div className="text-slate-400 text-[11px]">VRAM: {hardware.gpu_memory_mb} MB ({hardware.has_dedicated_gpu ? 'Dedicated' : 'Integrated'})</div>
            </div>

            <div className="p-3 rounded-lg bg-industrial-950 border border-industrial-800">
              <span className="text-slate-500 text-[10px]">HOST OPERATING ENVIRONMENT</span>
              <div className="text-slate-200 font-bold mt-1 truncate">{hardware.operating_system}</div>
              <div className="text-emerald-400 text-[11px]">Mode: Air-Gapped Compliant</div>
            </div>
          </div>
        </div>
      )}

      {/* Model Gateway Compatibility Matrix */}
      <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800">
        <h3 className="text-sm font-bold text-white tracking-wide mb-3">MODEL REGISTRY & HARDWARE COMPATIBILITY EVALUATION</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-industrial-800 text-slate-400 text-left">
                <th className="p-2">Model ID</th>
                <th className="p-2">Name</th>
                <th className="p-2">Params</th>
                <th className="p-2">Quant</th>
                <th className="p-2">RAM Req</th>
                <th className="p-2">Compatibility</th>
                <th className="p-2">Recommended Tier</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => (
                <tr key={m.model_id} className="border-b border-industrial-800/40 hover:bg-industrial-800/20">
                  <td className="p-2 text-cyan-400 font-semibold">{m.model_id}</td>
                  <td className="p-2 text-slate-200">{m.name}</td>
                  <td className="p-2 text-slate-300">{m.parameters}</td>
                  <td className="p-2 text-slate-400">{m.quantization}</td>
                  <td className="p-2 text-slate-300">{m.ram_required_gb} GB</td>
                  <td className="p-2">
                    {m.is_compatible ? (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-emerald-900/50 text-emerald-300 border border-emerald-700">
                        COMPATIBLE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[10px] bg-rose-900/50 text-rose-300 border border-rose-700">
                        INSUFFICIENT VRAM/RAM
                      </span>
                    )}
                  </td>
                  <td className="p-2 text-slate-400">{m.recommended_tier}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* User Management Table */}
      <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-cyan-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">USER ACCOUNTS & ROLE ASSIGNMENTS</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">{users.length} Active Accounts</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-industrial-800 text-slate-400 text-left">
                <th className="p-2">Username</th>
                <th className="p-2">Full Name</th>
                <th className="p-2">Email</th>
                <th className="p-2">Assigned Role</th>
                <th className="p-2">MFA Status</th>
                <th className="p-2">Account State</th>
                <th className="p-2">Action</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-industrial-800/40 hover:bg-industrial-800/20">
                  <td className="p-2 text-cyan-400 font-bold">{u.username}</td>
                  <td className="p-2 text-slate-200">{u.full_name || '—'}</td>
                  <td className="p-2 text-slate-300">{u.email}</td>
                  <td className="p-2">
                    <span className="px-2 py-0.5 rounded bg-industrial-950 text-slate-300 border border-industrial-800 text-[10px]">
                      {u.role}
                    </span>
                  </td>
                  <td className="p-2">
                    <span className="text-emerald-400 font-semibold">ENFORCED (TOTP)</span>
                  </td>
                  <td className="p-2">
                    {u.is_active ? (
                      <span className="text-emerald-400">ACTIVE</span>
                    ) : (
                      <span className="text-rose-400">DISABLED</span>
                    )}
                  </td>
                  <td className="p-2">
                    {u.username !== 'admin' && (
                      <button
                        onClick={() => handleToggleActive(u)}
                        className={`text-[10px] px-2 py-1 rounded font-bold transition ${
                          u.is_active
                            ? 'bg-rose-900/30 text-rose-300 hover:bg-rose-900/60'
                            : 'bg-emerald-900/30 text-emerald-300 hover:bg-emerald-900/60'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white tracking-wide mb-1">PROVISION NEW OPERATOR / USER ACCOUNT</h3>
            <p className="text-xs text-slate-400 mb-4">Admin-only authorization. All accounts enforce TOTP MFA.</p>

            {formError && (
              <div className="mb-4 p-2.5 rounded bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleCreateUser} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Username</label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                  placeholder="e.g. engineer2"
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="e.g. Senior Controls Specialist"
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  required
                  placeholder="user@sovereign.local"
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Temporary Initial Password</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1">Assigned Industrial Role</label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value)}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-cyan-400 font-bold focus:outline-none focus:border-cyan-500"
                >
                  <option value="OPERATOR">OPERATOR</option>
                  <option value="ENGINEER">ENGINEER</option>
                  <option value="SAFETY_OFFICER">SAFETY_OFFICER</option>
                  <option value="ADMINISTRATOR">ADMINISTRATOR</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="flex-1 px-3 py-2 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-400 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold transition shadow-sm"
                >
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
