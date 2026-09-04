import React, { useState, useEffect } from 'react';
import { FileText, ShieldCheck, CheckCircle2, AlertTriangle, Search, Filter } from 'lucide-react';
import { apiClient } from '../../services/api';
import { AuditLogItem } from '../../types';

export const AuditLogView: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [integrity, setIntegrity] = useState<any | null>(null);
  const [filterWho, setFilterWho] = useState('');
  const [filterResult, setFilterResult] = useState('');

  const fetchLogs = async () => {
    try {
      let url = '/audit/logs?limit=50';
      if (filterWho) url += `&who=${filterWho}`;
      if (filterResult) url += `&result=${filterResult}`;
      const res = await apiClient.get(url);
      setLogs(res.data);

      const integRes = await apiClient.get('/audit/verify');
      setIntegrity(integRes.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchLogs();
  }, [filterWho, filterResult]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">IMMUTABLE SYSTEM AUDIT TRAIL</h2>
          <p className="text-xs text-slate-400">Cryptographically Signed Log of All Sensitive Operations, Auth Events, and Actuator Invocations</p>
        </div>

        {integrity && (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-xs font-mono">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span className="text-emerald-300 font-bold">INTEGRITY: {integrity.status}</span>
            <span className="text-slate-500">({integrity.valid_records} Verified Records)</span>
          </div>
        )}
      </div>

      {/* Filter Controls */}
      <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800 flex flex-wrap gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-cyan-400" />
          <span className="text-slate-300">Filter By Actor (WHO):</span>
          <input
            type="text"
            value={filterWho}
            onChange={(e) => setFilterWho(e.target.value)}
            placeholder="e.g. admin"
            className="bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1 text-slate-200 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-300">Result:</span>
          <select
            value={filterResult}
            onChange={(e) => setFilterResult(e.target.value)}
            className="bg-industrial-950 border border-industrial-800 rounded px-2.5 py-1 text-cyan-400 focus:outline-none focus:border-cyan-500"
          >
            <option value="">ALL RESULTS</option>
            <option value="SUCCESS">SUCCESS</option>
            <option value="FAILURE">FAILURE</option>
            <option value="BLOCKED">BLOCKED</option>
            <option value="DENIED">DENIED</option>
            <option value="TRIGGERED">TRIGGERED</option>
          </select>
        </div>
      </div>

      {/* Audit Table */}
      <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 overflow-x-auto">
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-industrial-800 text-slate-400 text-left">
              <th className="p-2">Timestamp (WHEN)</th>
              <th className="p-2">Actor (WHO)</th>
              <th className="p-2">Action (WHAT)</th>
              <th className="p-2">Resource</th>
              <th className="p-2">Result</th>
              <th className="p-2">Reason / Details</th>
              <th className="p-2">SHA-256 Checksum</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((log, idx) => (
              <tr key={idx} className="border-b border-industrial-800/40 hover:bg-industrial-800/20">
                <td className="p-2 text-slate-400 whitespace-nowrap">{log.timestamp.split('T')[1]?.slice(0, 8)}</td>
                <td className="p-2 text-cyan-400 font-bold">{log.who}</td>
                <td className="p-2 text-slate-200 font-semibold">{log.what}</td>
                <td className="p-2 text-slate-300 truncate max-w-xs">{log.resource}</td>
                <td className="p-2">
                  <span className={`px-2 py-0.5 rounded text-[10px] ${
                    log.result === 'SUCCESS' ? 'bg-emerald-900/50 text-emerald-300 border border-emerald-700' :
                    log.result === 'BLOCKED' || log.result === 'DENIED' ? 'bg-rose-900/50 text-rose-300 border border-rose-700' :
                    'bg-amber-900/50 text-amber-300 border border-amber-700'
                  }`}>
                    {log.result}
                  </span>
                </td>
                <td className="p-2 text-slate-400 truncate max-w-sm">{log.reason || '—'}</td>
                <td className="p-2 text-slate-600 truncate max-w-[100px] select-all">{log.checksum}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
