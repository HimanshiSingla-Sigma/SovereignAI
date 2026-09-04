import React, { useState, useEffect } from 'react';
import { ShieldCheck, HardDrive, Cpu, AlertTriangle, Radio } from 'lucide-react';
import { apiClient } from '../../services/api';
import { HardwareProfile, SafetyStatus } from '../../types';

export const Header: React.FC = () => {
  const [hw, setHw] = useState<HardwareProfile | null>(null);
  const [safety, setSafety] = useState<SafetyStatus | null>(null);

  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const hwRes = await apiClient.get('/hardware/profile');
        setHw(hwRes.data);
        const sfRes = await apiClient.get('/safety/status');
        setSafety(sfRes.data);
      } catch (e) {
        // Handled silently
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, []);

  const getSafetyBadge = (state?: string) => {
    switch (state) {
      case 'EMERGENCY':
        return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-rose-900/70 text-rose-300 border border-rose-600 animate-pulse font-mono">EMERGENCY TRIP</span>;
      case 'CRITICAL':
        return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-rose-900/50 text-rose-300 border border-rose-700 font-mono">CRITICAL INTERLOCK</span>;
      case 'WARNING':
        return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-900/50 text-amber-300 border border-amber-700 font-mono">WARNING</span>;
      default:
        return <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-emerald-900/40 text-emerald-300 border border-emerald-700 font-mono">SAFETY NORMAL</span>;
    }
  };

  return (
    <header className="h-14 bg-industrial-900 border-b border-industrial-800 px-6 flex items-center justify-between text-xs">
      <div className="flex items-center gap-4">
        {/* Air-gapped status */}
        <div className="flex items-center gap-2 px-2.5 py-1 rounded bg-industrial-950 border border-industrial-800 text-slate-300">
          <Radio className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
          <span className="font-mono text-[11px]">AIR-GAPPED LOCAL</span>
        </div>

        {/* Safety State */}
        {getSafetyBadge(safety?.system_safety_state)}

        {safety && safety.pending_approvals > 0 && (
          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 border border-amber-600 font-mono">
            <AlertTriangle className="w-3 h-3" />
            {safety.pending_approvals} Approval(s) Pending
          </span>
        )}
      </div>

      <div className="flex items-center gap-4 text-slate-400">
        {/* Hardware Capability Badge */}
        {hw && (
          <div className="flex items-center gap-3 px-3 py-1 rounded bg-industrial-950 border border-industrial-800 font-mono text-[11px]">
            <div className="flex items-center gap-1.5 text-cyan-400">
              <Cpu className="w-3.5 h-3.5" />
              <span>{hw.cpu_model.split('@')[0].trim()} ({hw.physical_cores}C/{hw.logical_cores}T)</span>
            </div>
            <span className="text-slate-600">|</span>
            <div className="flex items-center gap-1.5 text-slate-300">
              <HardDrive className="w-3.5 h-3.5 text-amber-400" />
              <span>RAM: {hw.available_ram_gb}G Avail / {hw.total_ram_gb}G</span>
            </div>
            <span className="text-slate-600">|</span>
            <span className="text-emerald-400 font-semibold">{hw.hardware_tier}</span>
          </div>
        )}
      </div>
    </header>
  );
};
