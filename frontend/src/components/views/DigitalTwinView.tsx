import React, { useState, useEffect, useRef } from 'react';
import { Cpu, Activity, AlertTriangle, Layers, Plus, HardDrive } from 'lucide-react';
import { apiClient } from '../../services/api';
import { MachineItem, TelemetryPoint } from '../../types';

export const DigitalTwinView: React.FC = () => {
  const [machines, setMachines] = useState<MachineItem[]>([]);
  const [selectedId, setSelectedId] = useState<string>('Machine-002');
  const [history, setHistory] = useState<TelemetryPoint[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newId, setNewId] = useState('');
  const [newName, setNewName] = useState('');
  const [newCat, setNewCat] = useState('CNC_MILL');

  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fetchMachines = async () => {
    try {
      const res = await apiClient.get('/machines');
      setMachines(res.data);
    } catch (e) {}
  };

  useEffect(() => {
    fetchMachines();
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    const fetchHist = async () => {
      try {
        const res = await apiClient.get(`/machines/${selectedId}/history?limit=30`);
        setHistory(res.data);
      } catch (e) {}
    };
    fetchHist();
    const interval = setInterval(fetchHist, 2000);
    return () => clearInterval(interval);
  }, [selectedId]);

  // Real-time canvas telemetry chart rendering
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || history.length < 2) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    ctx.clearRect(0, 0, width, height);

    // Grid lines
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 1;
    for (let y = 20; y < height; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }

    // Helper to draw signal line
    const drawLine = (
      data: number[],
      min: number,
      max: number,
      color: string,
      label: string
    ) => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();

      const step = width / (data.length - 1);
      data.forEach((val, i) => {
        const normalized = Math.max(0, Math.min(1, (val - min) / (max - min)));
        const y = height - 20 - normalized * (height - 40);
        const x = i * step;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.stroke();
    };

    // Draw Temperature (0 - 120°C)
    drawLine(history.map(h => h.temperature), 20, 110, '#06b6d4', 'Temperature');
    // Draw Vibration (0 - 6.0 mm/s)
    drawLine(history.map(h => h.vibration), 0, 6.0, '#f43f5e', 'Vibration');
    // Draw Anomaly Score (0 - 100)
    drawLine(history.map(h => h.anomaly_score), 0, 100, '#f59e0b', 'Anomaly');
  }, [history]);

  const selectedMachine = machines.find(m => m.machine_id === selectedId);

  const handleAddAsset = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiClient.post('/machines', {
        machine_id: newId,
        name: newName,
        category: newCat
      });
      setShowAddModal(false);
      setNewId('');
      setNewName('');
      await fetchMachines();
      setSelectedId(newId);
    } catch (e: any) {
      alert('Failed to register dynamic asset.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">MULTI-MACHINE DIGITAL TWIN</h2>
          <p className="text-xs text-slate-400">Real-Time Cyber-Physical State, Component Topology & Sensor Buffers</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-industrial-900 hover:bg-industrial-800 border border-industrial-800 text-cyan-400 text-xs font-mono font-bold transition"
        >
          <Plus className="w-4 h-4" />
          <span>Register New Machine Twin</span>
        </button>
      </div>

      {/* Machine Selector Tabs */}
      <div className="flex overflow-x-auto gap-2 pb-2">
        {machines.map((m) => (
          <button
            key={m.machine_id}
            onClick={() => setSelectedId(m.machine_id)}
            className={`px-4 py-2 rounded-lg text-xs font-mono font-semibold whitespace-nowrap transition-all border ${
              selectedId === m.machine_id
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-sm'
                : 'bg-industrial-900 text-slate-400 border-industrial-800 hover:text-slate-200'
            }`}
          >
            {m.machine_id}
          </button>
        ))}
      </div>

      {selectedMachine && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Telemetry Canvas Chart */}
          <div className="lg:col-span-2 p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-white tracking-wide">
                  REAL-TIME MULTI-SIGNAL TELEMETRY STREAM
                </h3>
                <p className="text-[11px] font-mono text-slate-400">
                  {selectedMachine.name} ({selectedMachine.category})
                </p>
              </div>

              <div className="flex items-center gap-4 text-xs font-mono">
                <span className="flex items-center gap-1.5 text-cyan-400">
                  <span className="w-2.5 h-0.5 bg-cyan-400 inline-block" /> Temp (°C)
                </span>
                <span className="flex items-center gap-1.5 text-rose-400">
                  <span className="w-2.5 h-0.5 bg-rose-400 inline-block" /> Vib (mm/s)
                </span>
                <span className="flex items-center gap-1.5 text-amber-400">
                  <span className="w-2.5 h-0.5 bg-amber-400 inline-block" /> Anomaly Score
                </span>
              </div>
            </div>

            {/* Custom Canvas Chart */}
            <div className="w-full bg-industrial-950 rounded-lg p-2 border border-industrial-800 overflow-hidden">
              <canvas
                ref={canvasRef}
                width={700}
                height={260}
                className="w-full h-[260px] block"
              />
            </div>

            <div className="grid grid-cols-4 gap-3 text-xs font-mono text-center">
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800">
                <div className="text-[10px] text-slate-500">OPERATING SPEED</div>
                <div className="font-bold text-slate-200 mt-0.5">{selectedMachine.rpm} RPM</div>
              </div>
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800">
                <div className="text-[10px] text-slate-500">TOTAL RUNTIME</div>
                <div className="font-bold text-slate-200 mt-0.5">{selectedMachine.operating_hours} hrs</div>
              </div>
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800">
                <div className="text-[10px] text-slate-500">TWIN STATUS</div>
                <div className="font-bold text-emerald-400 mt-0.5">{selectedMachine.status}</div>
              </div>
              <div className="p-2 rounded bg-industrial-950 border border-industrial-800">
                <div className="text-[10px] text-slate-500">ACTIVE PROFILE</div>
                <div className="font-bold text-cyan-400 mt-0.5">{selectedMachine.simulation_profile}</div>
              </div>
            </div>
          </div>

          {/* Component & Sensor Topology Tree */}
          <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">SUB-ASSEMBLY COMPONENTS</h3>
            </div>

            <div className="space-y-3">
              {selectedMachine.components && selectedMachine.components.length > 0 ? (
                selectedMachine.components.map((comp) => (
                  <div
                    key={comp.component_id}
                    className="p-3 rounded-lg bg-industrial-950 border border-industrial-800"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-slate-200">{comp.name}</span>
                      <span className="text-[10px] font-mono text-slate-400">{comp.component_type}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                      <span>Health: <span className="text-emerald-400 font-bold">{comp.health_score}%</span></span>
                      <span>Wear: <span className="text-amber-400 font-bold">{comp.wear_percentage}%</span></span>
                    </div>
                    {/* Wear progress bar */}
                    <div className="w-full bg-industrial-900 h-1.5 rounded-full mt-2 overflow-hidden">
                      <div
                        className={`h-full ${comp.wear_percentage > 50 ? 'bg-rose-500' : 'bg-cyan-500'}`}
                        style={{ width: `${comp.wear_percentage}%` }}
                      />
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-slate-500">No components defined.</p>
              )}
            </div>

            <div className="pt-2 border-t border-industrial-800">
              <h4 className="text-xs font-bold text-slate-300 mb-2">INSTRUMENTED SENSORS</h4>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                {selectedMachine.sensors?.map((s) => (
                  <div key={s.sensor_id} className="p-2 rounded bg-industrial-950 border border-industrial-800">
                    <div className="text-[10px] text-slate-500">{s.sensor_id}</div>
                    <div className="text-slate-200 font-bold">{s.sensor_type}</div>
                    <div className="text-cyan-400 font-bold">{s.last_value} {s.unit}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Dynamic Asset Registration Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-industrial-900 border border-industrial-800 rounded-xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-sm font-bold text-white tracking-wide mb-3">REGISTER DYNAMIC ASSET</h3>
            <form onSubmit={handleAddAsset} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1">Asset ID</label>
                <input
                  type="text"
                  value={newId}
                  onChange={(e) => setNewId(e.target.value)}
                  placeholder="e.g. Pump-002"
                  required
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Auxiliary Vacuum Pump"
                  required
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-slate-100 focus:outline-none focus:border-cyan-500"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Category</label>
                <select
                  value={newCat}
                  onChange={(e) => setNewCat(e.target.value)}
                  className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-cyan-400 focus:outline-none focus:border-cyan-500"
                >
                  <option value="CNC_MILL">CNC_MILL</option>
                  <option value="TURNING_CENTER">TURNING_CENTER</option>
                  <option value="PUMP">PUMP</option>
                  <option value="MOTOR">MOTOR</option>
                  <option value="COMPRESSOR">COMPRESSOR</option>
                  <option value="ROBOTIC_CELL">ROBOTIC_CELL</option>
                </select>
              </div>

              <div className="pt-2 flex gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 px-3 py-2 rounded-lg bg-industrial-950 border border-industrial-800 text-slate-400"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-3 py-2 rounded-lg bg-cyan-500 text-slate-950 font-bold"
                >
                  Create
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
