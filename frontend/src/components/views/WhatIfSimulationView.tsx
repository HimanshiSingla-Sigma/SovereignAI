import React, { useState } from 'react';
import { Sliders, Play, AlertTriangle, ShieldCheck, CheckCircle2, RefreshCw } from 'lucide-react';
import { apiClient } from '../../services/api';

export const WhatIfSimulationView: React.FC = () => {
  const [machineId, setMachineId] = useState('Machine-002');
  const [tempDelta, setTempDelta] = useState(25.0);
  const [vibDelta, setVibDelta] = useState(1.2);
  const [currDelta, setCurrDelta] = useState(10.0);
  const [gasDelta, setGasDelta] = useState(15.0);
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);

  const handleRunSimulation = async () => {
    setLoading(true);
    try {
      const res = await apiClient.post('/simulation/what-if', {
        machine_id: machineId,
        temp_delta: tempDelta,
        vibration_delta: vibDelta,
        current_delta: currDelta,
        gas_delta: gasDelta,
        ambient_stress_multiplier: 1.0,
        simulation_steps: 10
      });
      setResult(res.data);
    } catch (e: any) {
      alert(e.response?.data?.detail || 'Simulation execution failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">WHAT-IF VIRTUAL TWIN SIMULATION</h2>
          <p className="text-xs text-slate-400">Hypothetical Stress Testing in Isolated Virtual Sandbox (Live State Strictly Preserved)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Scenario Controls Panel */}
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
          <h3 className="text-xs font-bold text-white tracking-wider font-mono">
            HYPOTHETICAL STRESS VARIABLES
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Target Asset</label>
            <select
              value={machineId}
              onChange={(e) => setMachineId(e.target.value)}
              className="w-full bg-industrial-950 border border-industrial-800 text-cyan-400 font-mono font-bold rounded-lg px-3 py-2 text-xs"
            >
              <option value="Machine-001">Machine-001 (5-Axis CNC)</option>
              <option value="Machine-002">Machine-002 (Turning Center)</option>
              <option value="Machine-003">Machine-003 (Welding Cell)</option>
              <option value="Pump-001">Pump-001 (Coolant Pump)</option>
              <option value="Motor-001">Motor-001 (Main Drive)</option>
              <option value="Compressor-001">Compressor-001 (Screw Air)</option>
            </select>
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-300">Temperature Offset</span>
              <span className="text-cyan-400 font-bold">+{tempDelta}°C</span>
            </div>
            <input
              type="range"
              min="0"
              max="60"
              step="1"
              value={tempDelta}
              onChange={(e) => setTempDelta(parseFloat(e.target.value))}
              className="w-full accent-cyan-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-300">Radial Vibration Delta</span>
              <span className="text-rose-400 font-bold">+{vibDelta} mm/s</span>
            </div>
            <input
              type="range"
              min="0"
              max="4.0"
              step="0.1"
              value={vibDelta}
              onChange={(e) => setVibDelta(parseFloat(e.target.value))}
              className="w-full accent-rose-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-300">Motor Current Delta</span>
              <span className="text-amber-400 font-bold">+{currDelta} A</span>
            </div>
            <input
              type="range"
              min="0"
              max="30"
              step="1"
              value={currDelta}
              onChange={(e) => setCurrDelta(parseFloat(e.target.value))}
              className="w-full accent-amber-500"
            />
          </div>

          <div>
            <div className="flex justify-between text-xs font-mono mb-1">
              <span className="text-slate-300">Combustible Gas Delta</span>
              <span className="text-purple-400 font-bold">+{gasDelta} ppm</span>
            </div>
            <input
              type="range"
              min="0"
              max="50"
              step="1"
              value={gasDelta}
              onChange={(e) => setGasDelta(parseFloat(e.target.value))}
              className="w-full accent-purple-500"
            />
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={loading}
            className="w-full py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition shadow-lg shadow-cyan-500/10"
          >
            <Play className="w-4 h-4" />
            <span>{loading ? 'Evaluating Virtual Twin...' : 'Execute What-If Simulation'}</span>
          </button>
        </div>

        {/* Side-by-Side Comparison Panel */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-white tracking-wider font-mono">
              PREDICTED OUTCOME & DELTA COMPARISON
            </h3>
            <span className="text-[10px] font-mono text-emerald-400">ISOLATION GUARD: ACTIVE</span>
          </div>

          {result ? (
            <div className="space-y-4">
              {/* Summary callout */}
              <div className="p-3.5 rounded-lg bg-industrial-950 border border-cyan-500/30 text-xs text-cyan-200">
                {result.comparison_summary}
              </div>

              {/* Side-by-Side Delta */}
              <div className="grid grid-cols-2 gap-4">
                {/* Live Twin Column */}
                <div className="p-4 rounded-xl bg-industrial-950 border border-industrial-800 space-y-3">
                  <div className="text-xs font-bold font-mono text-slate-400 border-b border-industrial-800 pb-2">
                    ACTIVE LIVE TWIN (UNTOUCHED)
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-industrial-900">
                      <div className="text-[10px] text-slate-500">HEALTH</div>
                      <div className="text-emerald-400 font-bold">{result.live_state.health_score}%</div>
                    </div>
                    <div className="p-2 rounded bg-industrial-900">
                      <div className="text-[10px] text-slate-500">RISK</div>
                      <div className="text-slate-300 font-bold">{result.live_state.risk_score}%</div>
                    </div>
                    <div className="p-2 rounded bg-industrial-900">
                      <div className="text-[10px] text-slate-500">TEMP</div>
                      <div className="text-cyan-400 font-bold">{result.live_state.temperature} °C</div>
                    </div>
                    <div className="p-2 rounded bg-industrial-900">
                      <div className="text-[10px] text-slate-500">VIBRATION</div>
                      <div className="text-rose-400 font-bold">{result.live_state.vibration} mm/s</div>
                    </div>
                  </div>
                </div>

                {/* Simulated Virtual Twin Column */}
                <div className="p-4 rounded-xl bg-industrial-950 border border-cyan-500/40 space-y-3 shadow-lg shadow-cyan-500/5">
                  <div className="text-xs font-bold font-mono text-cyan-300 border-b border-cyan-500/30 pb-2 flex items-center justify-between">
                    <span>VIRTUAL SCENARIO TWIN</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                      result.predicted_safety_state === 'EMERGENCY' ? 'bg-rose-900/80 text-rose-300' :
                      result.predicted_safety_state === 'CRITICAL' ? 'bg-rose-900/50 text-rose-300' :
                      result.predicted_safety_state === 'WARNING' ? 'bg-amber-900/50 text-amber-300' : 'bg-emerald-900/50 text-emerald-300'
                    }`}>
                      {result.predicted_safety_state}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-industrial-900">
                      <div className="text-[10px] text-slate-500">PREDICTED HEALTH</div>
                      <div className="text-rose-400 font-bold">{result.predicted_health_score}%</div>
                    </div>
                    <div className="p-2 rounded bg-industrial-900">
                      <div className="text-[10px] text-slate-500">PREDICTED RISK</div>
                      <div className="text-amber-400 font-bold">{result.predicted_risk_score}%</div>
                    </div>
                    <div className="p-2 rounded bg-industrial-900">
                      <div className="text-[10px] text-slate-500">SIM TEMP</div>
                      <div className="text-rose-400 font-bold">{result.simulated_state.temperature} °C</div>
                    </div>
                    <div className="p-2 rounded bg-industrial-900">
                      <div className="text-[10px] text-slate-500">SIM VIBRATION</div>
                      <div className="text-rose-400 font-bold">{result.simulated_state.vibration} mm/s</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Violations and Recommendations */}
              {result.safety_violations_predicted.length > 0 && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs space-y-1">
                  <div className="font-bold flex items-center gap-1.5 font-mono">
                    <AlertTriangle className="w-4 h-4 text-rose-400" />
                    <span>PREDICTED SAFETY THRESHOLD VIOLATIONS:</span>
                  </div>
                  {result.safety_violations_predicted.map((v: string, idx: number) => (
                    <div key={idx} className="pl-5 text-[11px]">• {v}</div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="p-12 text-center text-slate-500 text-xs">
              Configure hypothetical stress variables on the left and click "Execute What-If Simulation" to preview safety outcomes.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
