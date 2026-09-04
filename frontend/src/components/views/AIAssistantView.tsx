import React, { useState } from 'react';
import { Bot, Send, BookOpen, Share2, ShieldCheck, CheckCircle2, ChevronRight, Sparkles } from 'lucide-react';
import { apiClient } from '../../services/api';
import { ChatMessage, AgentStep, DocumentCitation } from '../../types';

interface AIAssistantViewProps {
  initialMachine?: string;
}

export const AIAssistantView: React.FC<AIAssistantViewProps> = ({ initialMachine }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: "Sovereign Industrial AI Assistant initialized. Operating locally on host CPU with Zero-Cloud air-gapped capability. I have direct verified access to the Digital Twin, telemetry streams, private RAG manuals, and the industrial Knowledge Graph.",
      timestamp: new Date().toLocaleTimeString(),
      model_used: 'Sovereign Industrial Neural Reasoner (Native CPU)'
    }
  ]);
  const [inputPrompt, setInputPrompt] = useState(
    initialMachine ? `Analyze ${initialMachine} and prepare a maintenance report.` : 'Analyze Machine-002 and prepare a maintenance report.'
  );
  const [targetMachine, setTargetMachine] = useState<string>(initialMachine || 'Machine-002');
  const [loading, setLoading] = useState(false);
  const [runAsAgent, setRunAsAgent] = useState(true);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputPrompt.trim() || loading) return;

    const userMsg: ChatMessage = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: inputPrompt,
      timestamp: new Date().toLocaleTimeString()
    };

    setMessages(prev => [...prev, userMsg]);
    setInputPrompt('');
    setLoading(true);

    try {
      const endpoint = runAsAgent ? '/ai/agent/execute' : '/ai/chat';
      const res = await apiClient.post(endpoint, {
        message: userMsg.text,
        machine_id: targetMachine,
        use_rag: true,
        use_graphrag: true
      });

      const assistantMsg: ChatMessage = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: res.data.response,
        timestamp: new Date().toLocaleTimeString(),
        model_used: res.data.model_used,
        citations: res.data.citations,
        knowledge_facts: res.data.knowledge_facts,
        agent_steps: res.data.agent_steps,
        safety_check: res.data.safety_check
      };

      setMessages(prev => [...prev, assistantMsg]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          sender: 'assistant',
          text: `Sovereign Security Guard Exception: ${e.response?.data?.detail || e.message}`,
          timestamp: new Date().toLocaleTimeString(),
          model_used: 'PROMPT_GUARD_SECURITY'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col bg-industrial-900 border border-industrial-800 rounded-xl overflow-hidden">
      {/* Top Configuration Bar */}
      <div className="p-4 border-b border-industrial-800 bg-industrial-950/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-cyan-400" />
          <span className="font-bold text-slate-100">SOVEREIGN INDUSTRIAL ASSISTANT</span>
          <span className="px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 font-mono text-[10px]">
            AIR-GAPPED LOCAL INFERENCE
          </span>
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300 select-none">
            <input
              type="checkbox"
              checked={runAsAgent}
              onChange={(e) => setRunAsAgent(e.target.checked)}
              className="rounded bg-industrial-950 border-industrial-700 text-cyan-500 focus:ring-0"
            />
            <span>Autonomous Agent Mode (Multi-Step Tools)</span>
          </label>

          <select
            value={targetMachine}
            onChange={(e) => setTargetMachine(e.target.value)}
            className="bg-industrial-900 border border-industrial-800 text-cyan-400 font-mono font-bold rounded px-2 py-1"
          >
            <option value="Machine-001">Machine-001</option>
            <option value="Machine-002">Machine-002 (Anomaly Target)</option>
            <option value="Machine-003">Machine-003</option>
            <option value="Pump-001">Pump-001</option>
            <option value="Motor-001">Motor-001</option>
            <option value="Compressor-001">Compressor-001</option>
          </select>
        </div>
      </div>

      {/* Messages Stream */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div
              className={`max-w-3xl rounded-xl p-4 text-xs leading-relaxed space-y-3 ${
                m.sender === 'user'
                  ? 'bg-cyan-600/20 text-cyan-100 border border-cyan-500/30'
                  : 'bg-industrial-950 border border-industrial-800 text-slate-200'
              }`}
            >
              {/* Header meta */}
              <div className="flex items-center justify-between gap-4 border-b border-industrial-800/60 pb-2 text-[10px] text-slate-400 font-mono">
                <span className="font-bold uppercase tracking-wider text-cyan-400">
                  {m.sender === 'user' ? 'Operator Inquiry' : 'Sovereign Intelligence Engine'}
                </span>
                <div className="flex items-center gap-2">
                  {m.model_used && (
                    <span className="px-1.5 py-0.5 rounded bg-industrial-900 border border-industrial-800 text-slate-300">
                      Model: {m.model_used}
                    </span>
                  )}
                  <span>{m.timestamp}</span>
                </div>
              </div>

              {/* Agent Execution Plan Trace (if present) */}
              {m.agent_steps && m.agent_steps.length > 0 && (
                <div className="p-3 rounded-lg bg-industrial-900/90 border border-industrial-800/90 space-y-2">
                  <div className="flex items-center gap-1.5 text-cyan-400 font-bold font-mono text-[11px]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>AUTONOMOUS EXECUTION TRACE ({m.agent_steps.length} STEPS)</span>
                  </div>
                  <div className="space-y-1.5">
                    {m.agent_steps.map((step) => (
                      <div
                        key={step.step_number}
                        className="flex items-start gap-2 p-1.5 rounded bg-industrial-950/60 text-[11px] font-mono border border-industrial-800/60"
                      >
                        <span className="text-cyan-400 font-bold shrink-0">#{step.step_number}</span>
                        <div className="flex-1">
                          <div className="text-slate-200 font-semibold">{step.action}</div>
                          {step.tool_used && (
                            <div className="text-[10px] text-slate-400 mt-0.5">
                              Tool: <span className="text-amber-300 font-bold">{step.tool_used}</span>
                            </div>
                          )}
                        </div>
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Knowledge Graph Causal Facts */}
              {m.knowledge_facts && m.knowledge_facts.length > 0 && (
                <div className="p-3 rounded-lg bg-purple-950/20 border border-purple-900/40 text-[11px] font-mono text-purple-200 space-y-1">
                  <div className="flex items-center gap-1 text-purple-300 font-bold">
                    <Share2 className="w-3.5 h-3.5" />
                    <span>GRAPHRAG CAUSAL CHAIN</span>
                  </div>
                  {m.knowledge_facts.map((fact, idx) => (
                    <div key={idx} className="pl-2 border-l border-purple-800/60 text-purple-300/90">
                      • {fact}
                    </div>
                  ))}
                </div>
              )}

              {/* Markdown / Formatted Response Text */}
              <div className="whitespace-pre-wrap leading-relaxed font-sans text-xs">
                {m.text}
              </div>

              {/* Grounded Citations */}
              {m.citations && m.citations.length > 0 && (
                <div className="pt-2 border-t border-industrial-800/80 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-400 font-bold">
                    <BookOpen className="w-3.5 h-3.5 text-cyan-400" />
                    <span>VERIFIED RAG CITATIONS:</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {m.citations.map((c, i) => (
                      <div
                        key={i}
                        className="p-2 rounded bg-industrial-900 border border-industrial-800 text-[11px]"
                      >
                        <div className="font-bold text-cyan-300 truncate">{c.title}</div>
                        <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                          Page {c.page_number} | Relevance: {(c.relevance_score * 100).toFixed(0)}%
                        </div>
                        <div className="text-slate-400 mt-1 italic line-clamp-2">"{c.snippet}"</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex items-center gap-2 text-cyan-400 text-xs font-mono p-3 rounded-lg bg-industrial-950 border border-industrial-800 max-w-sm">
            <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            <span>Sovereign local reasoning engine executing on CPU...</span>
          </div>
        )}
      </div>

      {/* Input Prompt Box */}
      <form onSubmit={handleSend} className="p-3 border-t border-industrial-800 bg-industrial-950 flex gap-2">
        <input
          type="text"
          value={inputPrompt}
          onChange={(e) => setInputPrompt(e.target.value)}
          placeholder="Ask AI Assistant or instruct Autonomous Diagnostic Agent..."
          className="flex-1 bg-industrial-900 border border-industrial-800 rounded-lg px-4 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
        />
        <button
          type="submit"
          disabled={loading || !inputPrompt.trim()}
          className="px-4 py-2.5 rounded-lg bg-cyan-500 hover:bg-cyan-400 disabled:opacity-40 text-slate-950 font-bold text-xs flex items-center gap-2 transition"
        >
          <Send className="w-4 h-4" />
          <span>Execute</span>
        </button>
      </form>
    </div>
  );
};
