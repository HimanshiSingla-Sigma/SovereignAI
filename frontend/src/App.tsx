import React, { useState } from 'react';
import { useAuth } from './context/AuthContext';
import { LoginView } from './components/auth/LoginView';
import { Sidebar } from './components/layout/Sidebar';
import { Header } from './components/layout/Header';

// Dashboards
import { OperatorDashboard } from './components/dashboard/OperatorDashboard';
import { EngineerDashboard } from './components/dashboard/EngineerDashboard';
import { SafetyOfficerDashboard } from './components/dashboard/SafetyOfficerDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';

// Views
import { DigitalTwinView } from './components/views/DigitalTwinView';
import { AIAssistantView } from './components/views/AIAssistantView';
import { WhatIfSimulationView } from './components/views/WhatIfSimulationView';
import { KnowledgeGraphView } from './components/views/KnowledgeGraphView';
import { DocumentsView } from './components/views/DocumentsView';
import { AuditLogView } from './components/views/AuditLogView';
import { SecurityView } from './components/views/SecurityView';

export const App: React.FC = () => {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState<string>('dashboard');
  const [assistantMachineTarget, setAssistantMachineTarget] = useState<string | undefined>();

  if (loading) {
    return (
      <div className="min-h-screen bg-industrial-950 flex items-center justify-center text-cyan-400 font-mono text-xs">
        <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping mr-2" />
        <span>Initializing Sovereign Industrial AI Environment...</span>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const handleNavigate = (tab: string, param?: string) => {
    setCurrentTab(tab);
    if (tab === 'assistant' && param) {
      setAssistantMachineTarget(param);
    }
  };

  // Render role-specific default dashboard when tab is 'dashboard'
  const renderDashboard = () => {
    switch (user.role) {
      case 'ADMINISTRATOR':
        return <AdminDashboard />;
      case 'SAFETY_OFFICER':
        return <SafetyOfficerDashboard />;
      case 'ENGINEER':
        return <EngineerDashboard onNavigate={handleNavigate} />;
      case 'OPERATOR':
      default:
        return <OperatorDashboard />;
    }
  };

  const renderContent = () => {
    switch (currentTab) {
      case 'dashboard':
        return renderDashboard();
      case 'twin':
      case 'telemetry':
        return <DigitalTwinView />;
      case 'assistant':
        return <AIAssistantView initialMachine={assistantMachineTarget} />;
      case 'simulation':
        return <WhatIfSimulationView />;
      case 'documents':
        return <DocumentsView />;
      case 'graphrag':
        return <KnowledgeGraphView />;
      case 'safety':
        return <SafetyOfficerDashboard />;
      case 'security':
        return <SecurityView />;
      case 'audit':
        return <AuditLogView />;
      case 'users':
        return <AdminDashboard />;
      default:
        return renderDashboard();
    }
  };

  return (
    <div className="flex h-screen bg-industrial-950 text-slate-100 overflow-hidden font-sans">
      {/* Navigation Sidebar */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={(tab) => {
          setCurrentTab(tab);
          setAssistantMachineTarget(undefined);
        }}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default App;
