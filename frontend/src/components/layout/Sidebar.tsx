import React from 'react';
import { 
  LayoutDashboard, Cpu, Activity, Bot, BookOpen, 
  Share2, ShieldAlert, Sliders, ShieldCheck, 
  Users, FileText, Settings, LogOut, Wrench
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: string;
  onSelectTab: (tab: string) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentTab, onSelectTab }) => {
  const { user, logout, hasPermission } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, perm: 'machines:read' },
    { id: 'twin', label: 'Digital Twin', icon: Cpu, perm: 'machines:read' },
    { id: 'telemetry', label: 'Live Telemetry', icon: Activity, perm: 'telemetry:read' },
    { id: 'assistant', label: 'AI Assistant & Agents', icon: Bot, perm: 'ai:chat' },
    { id: 'simulation', label: 'What-If Simulation', icon: Sliders, perm: 'simulation:run' },
    { id: 'documents', label: 'Private RAG & SOPs', icon: BookOpen, perm: 'documents:read' },
    { id: 'graphrag', label: 'Knowledge Graph', icon: Share2, perm: 'graphrag:query' },
    { id: 'safety', label: 'Safety & Actuators', icon: ShieldAlert, perm: 'safety:read' },
    { id: 'security', label: 'Security & Guards', icon: ShieldCheck, perm: 'security:configure' },
    { id: 'audit', label: 'Audit Trail', icon: FileText, perm: 'audit:read' },
    { id: 'users', label: 'User Governance', icon: Users, perm: 'users:create' },
  ];

  const filteredItems = navItems.filter(item => hasPermission(item.perm));

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'ADMINISTRATOR': return 'bg-purple-900/60 text-purple-300 border-purple-700';
      case 'ENGINEER': return 'bg-cyan-900/60 text-cyan-300 border-cyan-700';
      case 'SAFETY_OFFICER': return 'bg-amber-900/60 text-amber-300 border-amber-700';
      case 'OPERATOR': return 'bg-emerald-900/60 text-emerald-300 border-emerald-700';
      default: return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <aside className="w-64 bg-industrial-900 border-r border-industrial-800 flex flex-col h-screen select-none">
      {/* Brand Header */}
      <div className="p-4 border-b border-industrial-800 flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
          <Wrench className="w-5 h-5" />
        </div>
        <div>
          <h1 className="font-bold text-sm text-slate-100 tracking-wider">SOVEREIGN AI</h1>
          <p className="text-[10px] text-cyan-400 font-mono tracking-widest">INDUSTRIAL WORKBENCH</p>
        </div>
      </div>

      {/* User Badge */}
      <div className="p-3 mx-3 my-2 rounded-lg bg-industrial-950/60 border border-industrial-800">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-slate-200 truncate">{user?.username}</span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded border font-mono ${getRoleColor(user?.role)}`}>
            {user?.role}
          </span>
        </div>
        <p className="text-[11px] text-slate-400 mt-1 truncate">{user?.email}</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
        {filteredItems.map(item => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onSelectTab(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                isActive
                  ? 'bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-industrial-800/60'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-cyan-400' : 'text-slate-500'}`} />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer / Logout */}
      <div className="p-3 border-t border-industrial-800">
        <button
          onClick={logout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs text-rose-400 hover:bg-rose-500/10 transition"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
