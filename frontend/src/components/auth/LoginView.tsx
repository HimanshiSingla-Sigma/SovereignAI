import React, { useState } from 'react';
import { Shield, KeyRound, Wrench, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { MfaModal } from './MfaModal';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('Admin@Sovereign2026!');
  const [error, setError] = useState<string | null>(null);
  const [showMfaModal, setShowMfaModal] = useState(false);
  const [isSetup, setIsSetup] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const result = await login(username, password);
      if (result.mfaRequired) {
        setIsSetup(result.mfaSetupRequired);
        setShowMfaModal(true);
      }
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Authentication failed. Verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const setTestUser = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <div className="min-h-screen bg-industrial-950 flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Background industrial grid pattern */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f29370f_1px,transparent_1px),linear-gradient(to_bottom,#1f29370f_1px,transparent_1px)] bg-[size:24px_24px] pointer-events-none" />

      <div className="w-full max-w-md bg-industrial-900 border border-industrial-800 rounded-xl p-8 shadow-2xl relative z-10">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight text-white">Sovereign Industrial AI</h1>
            <p className="text-xs text-cyan-400 font-mono">SECURE WORKBENCH GATEWAY</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-300 mb-1.5">Password</label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-industrial-950 border border-industrial-800 rounded-lg px-3 py-2 text-sm text-slate-100 placeholder-slate-600 focus:outline-none focus:border-cyan-500 transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-semibold py-2.5 rounded-lg text-sm transition flex items-center justify-center gap-2 shadow-lg shadow-cyan-500/20"
          >
            <KeyRound className="w-4 h-4" />
            <span>{loading ? 'Authenticating...' : 'Sign In with Sovereign Security'}</span>
          </button>
        </form>

        {/* Quick-Fill Presets for Demonstration */}
        <div className="mt-6 pt-4 border-t border-industrial-800">
          <p className="text-[11px] font-mono text-slate-400 mb-2">QUICK-ACCESS TEST ROLES:</p>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <button
              onClick={() => setTestUser('admin', 'Admin@Sovereign2026!')}
              className="p-1.5 rounded bg-industrial-950 border border-purple-800/40 text-purple-300 hover:bg-purple-900/20 text-left transition"
            >
              <div className="font-semibold">Administrator</div>
              <div className="text-[10px] text-slate-500">admin</div>
            </button>
            <button
              onClick={() => setTestUser('engineer1', 'Engineer@2026!')}
              className="p-1.5 rounded bg-industrial-950 border border-cyan-800/40 text-cyan-300 hover:bg-cyan-900/20 text-left transition"
            >
              <div className="font-semibold">Engineer</div>
              <div className="text-[10px] text-slate-500">engineer1</div>
            </button>
            <button
              onClick={() => setTestUser('safety1', 'Safety@2026!')}
              className="p-1.5 rounded bg-industrial-950 border border-amber-800/40 text-amber-300 hover:bg-amber-900/20 text-left transition"
            >
              <div className="font-semibold">Safety Officer</div>
              <div className="text-[10px] text-slate-500">safety1</div>
            </button>
            <button
              onClick={() => setTestUser('operator1', 'Operator@2026!')}
              className="p-1.5 rounded bg-industrial-950 border border-emerald-800/40 text-emerald-300 hover:bg-emerald-900/20 text-left transition"
            >
              <div className="font-semibold">Operator</div>
              <div className="text-[10px] text-slate-500">operator1</div>
            </button>
          </div>
        </div>
      </div>

      {showMfaModal && (
        <MfaModal
          isSetup={isSetup}
          onClose={() => setShowMfaModal(false)}
        />
      )}
    </div>
  );
};
