import React, { useState, useEffect } from 'react';
import { Share2, Search, ArrowRight, Network, Wrench } from 'lucide-react';
import { apiClient } from '../../services/api';

export const KnowledgeGraphView: React.FC = () => {
  const [graphData, setGraphData] = useState<{ nodes: any[]; edges: any[] }>({ nodes: [], edges: [] });
  const [selectedEntity, setSelectedEntity] = useState<string>('Machine-002');
  const [rootCause, setRootCause] = useState<any | null>(null);

  useEffect(() => {
    const fetchGraph = async () => {
      try {
        const res = await apiClient.get('/graphrag/graph');
        setGraphData(res.data);
      } catch (e) {}
    };
    fetchGraph();
  }, []);

  useEffect(() => {
    if (!selectedEntity) return;
    const fetchRootCause = async () => {
      try {
        const res = await apiClient.get(`/graphrag/root-cause/${selectedEntity}`);
        setRootCause(res.data);
      } catch (e) {}
    };
    fetchRootCause();
  }, [selectedEntity]);

  const getNodeColor = (type: string) => {
    switch (type) {
      case 'Machine': return 'bg-cyan-950 text-cyan-300 border-cyan-700';
      case 'Component': return 'bg-purple-950 text-purple-300 border-purple-700';
      case 'FailureMode': return 'bg-rose-950 text-rose-300 border-rose-700';
      case 'Incident': return 'bg-amber-950 text-amber-300 border-amber-700';
      case 'MaintenanceProcedure': return 'bg-emerald-950 text-emerald-300 border-emerald-700';
      default: return 'bg-slate-900 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-white tracking-wide">INDUSTRIAL KNOWLEDGE GRAPH (GRAPHRAG)</h2>
          <p className="text-xs text-slate-400">Ontological Asset Relationships, Historical Incident Linkages & Multi-Hop Root Cause Analysis</p>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-400">Target Entity:</label>
          <select
            value={selectedEntity}
            onChange={(e) => setSelectedEntity(e.target.value)}
            className="bg-industrial-900 border border-industrial-800 text-cyan-400 font-mono font-bold rounded-lg px-3 py-1.5 text-xs focus:outline-none"
          >
            <option value="Machine-001">Machine-001</option>
            <option value="Machine-002">Machine-002 (Causal Fault Target)</option>
            <option value="Machine-003">Machine-003</option>
            <option value="Pump-001">Pump-001</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Knowledge Graph Entity Explorer */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Network className="w-5 h-5 text-cyan-400" />
              <h3 className="text-sm font-bold text-white tracking-wide">ONTOLOGICAL NODES & RELATIONSHIPS</h3>
            </div>
            <span className="text-xs font-mono text-slate-400">
              {graphData.nodes.length} Entities | {graphData.edges.length} Relationships
            </span>
          </div>

          {/* Graph Entities Grid */}
          <div className="space-y-3">
            <h4 className="text-xs font-mono font-bold text-slate-400">IDENTIFIED ONTOLOGICAL ENTITIES</h4>
            <div className="flex flex-wrap gap-2">
              {graphData.nodes.map((node) => (
                <div
                  key={node.id}
                  className={`p-2.5 rounded-lg border text-xs font-mono flex items-center gap-2 ${getNodeColor(node.type)}`}
                >
                  <span className="font-bold">{node.name}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/40 uppercase tracking-widest">
                    {node.type}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Relationships Explorer */}
          <div className="pt-3 border-t border-industrial-800 space-y-2">
            <h4 className="text-xs font-mono font-bold text-slate-400">ACTIVE GRAPH TRIPLETS (EDGES)</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-64 overflow-y-auto">
              {graphData.edges.map((edge, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded bg-industrial-950 border border-industrial-800 text-[11px] font-mono flex items-center justify-between"
                >
                  <span className="text-cyan-300 font-semibold">{edge.source}</span>
                  <span className="text-amber-400 text-[10px] px-1.5 py-0.5 rounded bg-amber-950/40 border border-amber-800/40">
                    --[{edge.type}]--&gt;
                  </span>
                  <span className="text-purple-300 font-semibold">{edge.target}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Root Cause Analysis Panel */}
        <div className="p-5 rounded-xl bg-industrial-900 border border-industrial-800 space-y-4">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-amber-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">MULTI-HOP CAUSAL TRACER</h3>
          </div>

          {rootCause ? (
            <div className="space-y-3 text-xs">
              <div className="p-3 rounded-lg bg-industrial-950 border border-industrial-800">
                <div className="text-[10px] font-mono text-slate-500">PROBABLE ROOT CAUSE</div>
                <div className="text-rose-400 font-bold mt-0.5">{rootCause.probable_root_cause}</div>
                <div className="text-[11px] font-mono text-slate-400 mt-1">
                  Confidence Score: {(rootCause.confidence * 100).toFixed(0)}%
                </div>
              </div>

              <div className="p-3 rounded-lg bg-industrial-950 border border-industrial-800 space-y-2">
                <div className="text-[10px] font-mono text-slate-500">RESOLVING MITIGATION</div>
                <div className="text-emerald-300 font-semibold">{rootCause.recommended_mitigation}</div>
              </div>

              <div>
                <div className="text-[10px] font-mono text-slate-400 mb-1.5">CAUSAL DEPENDENCY PATHS:</div>
                <div className="space-y-1 text-[11px] font-mono">
                  {rootCause.causal_chain.map((c: string, i: number) => (
                    <div key={i} className="p-2 rounded bg-industrial-950/80 border border-industrial-800/80 text-slate-300">
                      {c}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Select an entity to evaluate causal chains.</p>
          )}
        </div>
      </div>
    </div>
  );
};
