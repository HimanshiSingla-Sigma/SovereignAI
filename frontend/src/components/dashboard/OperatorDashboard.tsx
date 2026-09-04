import React, { useState, useEffect } from 'react';
import { Activity, AlertTriangle, Cpu, CheckCircle2, ShieldAlert } from 'lucide-react';
import { apiClient } from '../../services/api';
import { MachineItem, TelemetryPoint } from '../../types';

export const OperatorDashboard: React.FC = () => {
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('Machine-001');
  const [liveTelemetry, setLiveTelemetry] = useState<TelemetryPoint | null>(null);

  useEffect(() => {
    const fetchMachines = async () => {
      try {
        const res = await apiClient.get('/machines');
        setMachines(res.data);
      } catch (e) {}
    };
    fetchMachines();
  }, []);

  useEffect(() => {
    const fetchTelemetry = async () => {
      if (!selectedMachine) return;
      try {
        const res = await apiClient.get(`/machines/${selectedMachine}/telemetry`);
        setLiveTelemetry(res.data);
      } catch (e) {}
    };
    fetchTelemetry();
    const interval = setInterval(fetchTelemetry, 2000);
    return () => clearInterval(interval);
  }, [selectedMachine]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPERATIONAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950 text-emerald-300 border border-emerald-800">OPERATIONAL</span>;
      case 'WARNING':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-amber-950 text-amber-300 border border-amber-800">WARNING</span>;
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-rose-950 text-rose-300 border border-rose-800">CRITICAL</span>;
      case 'SHUTDOWN':
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-900 text-slate-400 border border-slate-700">SHUTDOWN</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300">{status}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">PLANT OPERATOR DASHBOARD</h2>
          <p className="text-xs text-slate-400">Continuous Machine Telemetry & Real-Time Supervisory Control</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">Monitored Assets:</span>
          <span className="text-xs font-mono font-bold text-cyan-400 bg-industrial-900 px-2 py-1 rounded border border-industrial-800">
            {machines.length} Units Online
          </span>
        </div>
      </div>

      {/* Asset Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {machines.map((m) => (
          <div
            key={m.machine_id}
            onClick={() => setSelectedMachine(m.machine_id)}
            className={`p-4 rounded-xl border cursor-pointer transition-all ${
              selectedMachine === m.machine_id
                ? 'bg-industrial-900 border-cyan-500/50 shadow-lg shadow-cyan-500/5'
                : 'bg-industrial-900/60 border-industrial-800 hover:border-industrial-700'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-sm text-slate-100">{m.name}</span>
              {getStatusBadge(m.status)}
            </div>
            <div className="text-[11px] font-mono text-cyan-400 mb-3">{m.machine_id}</div>

            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded bg-industrial-950/70 border border-industrial-800/80">
                <div className="text-[10px] text-slate-500">HEALTH</div>
                <div className="font-mono font-bold text-emerald-400">{m.health_score}%</div>
              </div>
              <div className="p-2 rounded bg-industrial-950/70 border border-industrial-800/80">
                <div className="text-[10px] text-slate-500">RISK</div>
                <div className={`font-mono font-bold ${m.risk_score > 40 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {m.risk_score}%
                </div>
              </div>
              <div className="p-2 rounded bg-industrial-950/70 border border-industrial-800/80">
                <div className="text-[10px] text-slate-500">ANOMALY</div>
                <div className={`font-mono font-bold ${m.anomaly_score > 50 ? 'text-rose-400' : 'text-slate-300'}`}>
                  {m.anomaly_score}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Live Gauges for Selected Machine */}
      {liveTelemetry && (
        <div className="p-6 rounded-xl bg-industrial-900 border border-industrial-800">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-sm font-bold text-white tracking-wide">
                LIVE TELEMETRY STREAM: {selectedMachine}
              </h3>
              <p className="text-[11px] font-mono text-slate-400">
                Timestamp: {liveTelemetry.timestamp}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-mono text-emerald-400">LIVE SENSOR FEED</span>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {/* Temperature Gauge */}
            <div className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 mb-1">BEARING TEMPERATURE</span>
              <span className={`text-2xl font-mono font-bold ${liveTelemetry.temperature > 80 ? 'text-rose-400' : liveTelemetry.temperature > 70 ? 'text-amber-400' : 'text-cyan-400'}`}>
                {liveTelemetry.temperature} °C
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Normal: 35 - 75 °C</span>
            </div>

            {/* Vibration Gauge */}
            <div className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 mb-1">RADIAL VIBRATION</span>
              <span className={`text-2xl font-mono font-bold ${liveTelemetry.vibration > 4.5 ? 'text-rose-400' : liveTelemetry.vibration > 2.8 ? 'text-amber-400' : 'text-emerald-400'}`}>
                {liveTelemetry.vibration} mm/s
              </span>
              <span className="text-[10px] text-slate-500 mt-1">ISO 10816 Limit: 4.5 mm/s</span>
            </div>

            {/* Motor Current */}
            <div className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 mb-1">DRIVE CURRENT</span>
              <span className="text-2xl font-mono font-bold text-slate-200">
                {liveTelemetry.current} A
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Nominal: 15 - 45 A</span>
            </div>

            {/* Combustible Gas */}
            <div className="p-4 rounded-lg bg-industrial-950 border border-industrial-800 flex flex-col items-center">
              <span className="text-xs text-slate-400 mb-1">ENCLOSURE GAS</span>
              <span className={`text-2xl font-mono font-bold ${liveTelemetry.gas > 30 ? 'text-rose-400' : 'text-slate-200'}`}>
                {liveTelemetry.gas} ppm
              </span>
              <span className="text-[10px] text-slate-500 mt-1">Threshold: &lt; 50 ppm</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
