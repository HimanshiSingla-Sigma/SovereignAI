import React, { useState, useEffect } from 'react';
import { Activity, Sliders, TrendingUp, AlertTriangle, ShieldCheck, Flame, Wrench } from 'lucide-react';
import { apiClient } from '../../services/api';
import { MachineItem, TelemetryPoint, CorrelationAnalytics, HealthRiskAnalytics } from '../../types';

interface EngineerDashboardProps {
  onNavigate: (tab: string, param?: string) => void;
}

export const EngineerDashboard: React.FC<EngineerDashboardProps> = ({ onNavigate }) => {
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [selectedMachine, setSelectedMachine] = useState<string>('Machine-002');
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [correlation, setCorrelation] = useState<CorrelationAnalytics | null>(null);
  const [healthRisk, setHealthRisk] = useState<HealthRiskAnalytics | null>(null);
  const [profileLoading, setProfileLoading] = useState<string | null>(null);

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
    if (!selectedMachine) return;

    const fetchDiagnostics = async () => {
      try {
        const [histRes, corrRes, hrRes] = await Promise.all([
          apiClient.get(`/machines/${selectedMachine}/history?limit=25`),
          apiClient.get(`/analytics/${selectedMachine}/correlation`),
          apiClient.get(`/analytics/${selectedMachine}/health`),
        ]);
        setHistory(histRes.data);
        setCorrelation(corrRes.data);
        setHealthRisk(hrRes.data);
      } catch (e) {}
    };

    fetchDiagnostics();
    const interval = setInterval(fetchDiagnostics, 3000);
    return () => clearInterval(interval);
  }, [selectedMachine]);

  const handleInjectProfile = async (profile: string) => {
    setProfileLoading(profile);
    try {
      await apiClient.post('/telemetry/inject-scenario', {
        machine_id: selectedMachine,
        profile
      });
      // Refresh
      const [histRes, corrRes, hrRes] = await Promise.all([
        apiClient.get(`/machines/${selectedMachine}/history?limit=25`),
        apiClient.get(`/analytics/${selectedMachine}/correlation`),
        apiClient.get(`/analytics/${selectedMachine}/health`),
      ]);
      setHistory(histRes.data);
      setCorrelation(corrRes.data);
      setHealthRisk(hrRes.data);
    } catch (e) {
      alert('Failed to inject scenario profile.');
    } finally {
      setProfileLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Machine Selector */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">RELIABILITY & PREDICTIVE ENGINEERING</h2>
          <p className="text-xs text-slate-400">Physics-Based Multi-Sensor Diagnostics, Anomaly Correlation & RUL Forecasting</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Target Asset:</label>
          <select
            value={selectedMachine}
            onChange={(e) => setSelectedMachine(e.target.value)}
            className="bg-industrial-900 border border-industrial-800 text-cyan-400 text-xs font-mono font-bold rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
          >
            {machines.map((m) => (
              <option key={m.machine_id} value={m.machine_id}>
                {m.machine_id} - {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Predictive Analytics KPI Cards */}
      {healthRisk && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>HEALTH INDEX</span>
              <Activity className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-400">
              {healthRisk.health_score}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Multi-sensor degradation estimate</div>
          </div>

          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>FAILURE RISK</span>
              <AlertTriangle className="w-4 h-4 text-amber-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${healthRisk.risk_score > 40 ? 'text-amber-400' : 'text-slate-200'}`}>
              {healthRisk.risk_score}%
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Probability: {(healthRisk.failure_probability * 100).toFixed(1)}%</div>
          </div>

          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>ESTIMATED RUL</span>
              <TrendingUp className="w-4 h-4 text-cyan-400" />
            </div>
            <div className="text-2xl font-bold font-mono text-cyan-300">
              {healthRisk.estimated_rul_hours} hrs
            </div>
            <div className="text-[11px] text-slate-500 mt-1">Remaining Useful Life (Operating)</div>
          </div>

          <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>MAINTENANCE PRIORITY</span>
              <Wrench className="w-4 h-4 text-purple-400" />
            </div>
            <div className={`text-2xl font-bold font-mono ${
              healthRisk.maintenance_priority === 'CRITICAL' ? 'text-rose-400' :
              healthRisk.maintenance_priority === 'HIGH' ? 'text-amber-400' : 'text-emerald-400'
            }`}>
              {healthRisk.maintenance_priority}
            </div>
            <div className="text-[11px] text-slate-500 mt-1">SOP schedule recommendation</div>
          </div>
        </div>
      )}

      {/* Simulation Scenario Profile Injector */}
      <div className="p-4 rounded-xl bg-industrial-900 border border-industrial-800">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono">
              DYNAMIC TELEMETRY INJECTION PROFILES
            </h3>
            <p className="text-[11px] text-slate-400">Inject real-time physical simulation patterns into {selectedMachine}:</p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            { id: 'NORMAL', label: 'Nominal Operating', color: 'hover:border-emerald-500 text-emerald-300' },
            { id: 'SENSOR_ANOMALY', label: 'Bearing Vibration Anomaly (Machine-002)', color: 'hover:border-amber-500 text-amber-300' },
            { id: 'WARNING', label: 'Thermal Degradation Warning', color: 'hover:border-amber-500 text-amber-300' },
            { id: 'CRITICAL', label: 'Critical Overheat / Trip', color: 'hover:border-rose-500 text-rose-300' },
            { id: 'STRESS', label: 'High Load Electrical Stress', color: 'hover:border-cyan-500 text-cyan-300' },
          ].map((prof) => (
            <button
              key={prof.id}
              onClick={() => handleInjectProfile(prof.id)}
              disabled={profileLoading !== null}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium bg-industrial-950 border border-industrial-800 transition ${prof.color} ${profileLoading === prof.id ? 'opacity-50' : ''}`}
            >
              {profileLoading === prof.id ? 'Injecting...' : prof.label}
            </button>
          ))}
        </div>
      </div>

      {/* Cross-Sensor Correlation & Anomaly Report */}
      {correlation && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800">
            <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono mb-3">
              CROSS-SENSOR INCONSISTENCY DETECTION
            </h3>
            {correlation.cross_sensor_inconsistencies.length > 0 ? (
              <div className="space-y-2">
                {correlation.cross_sensor_inconsistencies.map((inc, i) => (
                  <div key={i} className="p-3 rounded bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs">
                    <div className="flex items-start gap-2">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400 mt-0.5" />
                      <span>{inc}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>All multi-sensor correlation coefficients comply with physical boundaries.</span>
              </div>
            )}

            <div className="mt-4 pt-3 border-t border-industrial-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">Multivariate Anomaly Score:</span>
              <span className={`text-sm font-mono font-bold ${correlation.anomaly_score > 50 ? 'text-rose-400' : 'text-emerald-400'}`}>
                {correlation.anomaly_score} / 100
              </span>
            </div>
          </div>

          {/* Correlation Matrix Table */}
          <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800">
            <h3 className="text-xs font-bold text-slate-200 tracking-wider font-mono mb-3">
              COVARIANCE CORRELATION MATRIX
            </h3>
            {correlation.correlation_matrix && Object.keys(correlation.correlation_matrix).length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-xs font-mono">
                  <thead>
                    <tr className="border-b border-industrial-800 text-slate-400">
                      <th className="p-2 text-left">Signal</th>
                      <th className="p-2 text-center">Temp</th>
                      <th className="p-2 text-center">Vib</th>
                      <th className="p-2 text-center">Curr</th>
                      <th className="p-2 text-center">Gas</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(correlation.correlation_matrix).map(([sensor, values]) => (
                      <tr key={sensor} className="border-b border-industrial-800/40 hover:bg-industrial-800/20">
                        <td className="p-2 text-slate-300 font-semibold capitalize">{sensor}</td>
                        <td className="p-2 text-center text-slate-300">{values['temperature']}</td>
                        <td className="p-2 text-center text-slate-300">{values['vibration']}</td>
                        <td className="p-2 text-center text-slate-300">{values['current']}</td>
                        <td className="p-2 text-center text-slate-300">{values['gas']}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-xs text-slate-500">Awaiting historical data buffers...</p>
            )}

            <div className="mt-4 flex gap-2">
              <button
                onClick={() => onNavigate('simulation')}
                className="flex-1 px-3 py-2 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 text-xs font-medium transition"
              >
                Launch What-If Sandbox
              </button>
              <button
                onClick={() => onNavigate('assistant', selectedMachine)}
                className="flex-1 px-3 py-2 rounded-lg bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/30 text-xs font-medium transition"
              >
                Ask Sovereign Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
