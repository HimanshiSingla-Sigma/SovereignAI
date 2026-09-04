import React, { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle2, XCircle, AlertTriangle, Power, Clock, FileCheck } from 'lucide-react';
import { apiClient } from '../../services/api';
import { SafetyStatus, SafetyRule, ApprovalItem } from '../../types';

export const SafetyOfficerDashboard: React.FC = () => {
  const [safetyStatus, setSafetyStatus] = useState<SafetyStatus | null>(null);
  const [rules, setRules] = useState<SafetyRule[]>([]);
  const [approvals, setApprovals] = useState<ApprovalItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [actionReason, setActionReason] = useState('Authorized by Chief Safety Officer upon review.');

  const fetchData = async () => {
    try {
      const [statusRes, rulesRes, appRes] = await Promise.all([
        apiClient.get('/safety/status'),
        apiClient.get('/safety/rules'),
        apiClient.get('/approvals'),
      ]);
      setSafetyStatus(statusRes.data);
      setRules(rulesRes.data);
      setApprovals(appRes.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleDecision = async (requestId: string, decision: 'APPROVED' | 'REJECTED') => {
    setLoading(true);
    try {
      await apiClient.post(`/approvals/${requestId}/decide`, {
        decision,
        reason: actionReason
      });
      await fetchData();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Decision recording failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDirectShutdown = async () => {
    const machineId = prompt('Enter target Machine ID to execute Emergency Shutdown (e.g. Machine-002):', 'Machine-002');
    if (!machineId) return;

    try {
      const res = await apiClient.post('/safety/emergency-shutdown', {
        machine_id: machineId,
        justification: 'Manual ESD triggered from Safety Officer Console.'
      });
      alert(res.data.message || 'Emergency Shutdown Executed.');
      await fetchData();
    } catch (e: any) {
      alert(e.response?.data?.detail || 'ESD failed.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">CHIEF SAFETY OFFICER CONSOLE</h2>
          <p className="text-xs text-slate-400">Deterministic Interlock Supervision & Human-in-the-Loop Actuator Governance</p>
        </div>

        <button
          onClick={handleDirectShutdown}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs tracking-wider transition shadow-lg shadow-rose-600/30"
        >
          <Power className="w-4 h-4" />
          <span>MANUAL EMERGENCY SHUTDOWN (ESD)</span>
        </button>
      </div>

      {/* Safety Status Cards */}
      {safetyStatus && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <span className="text-xs text-slate-400">SYSTEM SAFETY STATE</span>
            <div className={`text-2xl font-mono font-bold mt-1 ${
              safetyStatus.system_safety_state === 'EMERGENCY' ? 'text-rose-500 animate-pulse' :
              safetyStatus.system_safety_state === 'CRITICAL' ? 'text-rose-400' :
              safetyStatus.system_safety_state === 'WARNING' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {safetyStatus.system_safety_state}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Deterministic interlock evaluation</p>
          </div>

          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <span className="text-xs text-slate-400">ACTIVE INTERLOCKS</span>
            <div className="text-2xl font-mono font-bold text-slate-200 mt-1">
              {safetyStatus.active_interlocks}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Breached safety parameters</p>
          </div>

          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <span className="text-xs text-slate-400">PENDING APPROVALS</span>
            <div className={`text-2xl font-mono font-bold mt-1 ${safetyStatus.pending_approvals > 0 ? 'text-amber-400' : 'text-slate-200'}`}>
              {safetyStatus.pending_approvals}
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Awaiting Human-in-the-Loop review</p>
          </div>

          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <span className="text-xs text-slate-400">SAFETY RULES ENFORCED</span>
            <div className="text-2xl font-mono font-bold text-cyan-400 mt-1">
              {safetyStatus.safety_rules_count} Rules
            </div>
            <p className="text-[10px] text-slate-500 mt-1">Non-negotiable threshold policies</p>
          </div>
        </div>
      )}

      {/* Human-in-the-Loop Approval Queue */}
      <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">HUMAN-IN-THE-LOOP APPROVAL QUEUE</h3>
          </div>
          <span className="text-xs font-mono text-slate-400">
            {approvals.filter(a => a.status === 'PENDING').length} Action(s) Pending
          </span>
        </div>

        {approvals.length === 0 ? (
          <div className="p-6 text-center text-slate-500 text-xs">
            No active approval requests in queue.
          </div>
        ) : (
          <div className="space-y-3">
            {approvals.map((app) => (
              <div
                key={app.request_id}
                className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold font-mono text-cyan-400">{app.request_id}</span>
                    <span className="text-xs font-bold text-slate-200">{app.action_type}</span>
                    <span className={`text-[10px] font-mono px-2 py-0.5 rounded ${
                      app.status === 'PENDING' ? 'bg-amber-900/50 text-amber-300 border border-amber-700' :
                      app.status === 'APPROVED' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' :
                      'bg-rose-900/50 text-rose-300 border border-rose-700'
                    }`}>
                      {app.status}
                    </span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    Target: <span className="text-slate-200 font-semibold">{app.target_resource}</span> | Requested by: <span className="text-slate-300">{app.requested_by}</span>
                  </div>
                  <p className="text-xs text-slate-300 mt-1 italic bg-industrial-900/60 p-2 rounded border border-industrial-800/60">
                    "{app.justification}"
                  </p>
                </div>

                {app.status === 'PENDING' && (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleDecision(app.request_id, 'APPROVED')}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-sm"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>AUTHORIZE</span>
                    </button>
                    <button
                      onClick={() => handleDecision(app.request_id, 'REJECTED')}
                      disabled={loading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>REJECT</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Deterministic Safety Rules Table */}
      <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800">
        <h3 className="text-sm font-bold text-white tracking-wide mb-3">ENFORCED SAFETY RULES & THRESHOLDS</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-industrial-800 text-slate-400 text-left">
                <th className="p-2">Rule ID</th>
                <th className="p-2">Rule Name</th>
                <th className="p-2">Parameter</th>
                <th className="p-2">Threshold</th>
                <th className="p-2">Severity</th>
                <th className="p-2">Required Action</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => (
                <tr key={r.rule_id} className="border-b border-industrial-800/40 hover:bg-industrial-800/20">
                  <td className="p-2 text-cyan-400 font-bold">{r.rule_id}</td>
                  <td className="p-2 text-slate-200">{r.name}</td>
                  <td className="p-2 text-slate-300">{r.parameter}</td>
                  <td className="p-2 text-amber-300 font-bold">{r.operator} {r.threshold}</td>
                  <td className="p-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] ${
                      r.severity === 'EMERGENCY' ? 'bg-rose-900/60 text-rose-300' :
                      r.severity === 'CRITICAL' ? 'bg-rose-900/40 text-rose-300' : 'bg-amber-900/40 text-amber-300'
                    }`}>
                      {r.severity}
                    </span>
                  </td>
                  <td className="p-2 text-slate-400">{r.action_required}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
