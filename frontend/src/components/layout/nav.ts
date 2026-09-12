import {
  Activity,
  BrainCircuit,
  Boxes,
  Cpu,
  FileText,
  FlaskConical,
  Gauge,
  Headphones,
  LayoutGrid,
  Lock,
  Network,
  ScanSearch,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Settings2,
  Zap,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Backend permission code gating this screen. */
  permission: string
  group: 'OPERATIONS' | 'INTELLIGENCE' | 'GOVERNANCE'
}

/**
 * The nav is derived from the permission list returned by /auth/mfa-verify
 * and /auth/me. Hiding an item is UX only — the backend still enforces RBAC on
 * every request, and each screen renders a permission notice if reached directly.
 */
export const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutGrid, permission: 'safety:read', group: 'OPERATIONS' },
  { to: '/god-view', label: 'Plant floor', icon: Boxes, permission: 'machines:read', group: 'OPERATIONS' },
  { to: '/digital-twin', label: 'Digital twin', icon: Gauge, permission: 'machines:read', group: 'OPERATIONS' },
  { to: '/stethoscope', label: 'Acoustic stethoscope', icon: Headphones, permission: 'telemetry:read', group: 'OPERATIONS' },
  { to: '/telemetry', label: 'Telemetry', icon: Activity, permission: 'telemetry:read', group: 'OPERATIONS' },
  { to: '/analytics', label: 'Analytics', icon: Share2, permission: 'telemetry:read', group: 'OPERATIONS' },
  { to: '/simulation', label: 'What-if', icon: FlaskConical, permission: 'simulation:run', group: 'OPERATIONS' },
  { to: '/stress-analysis', label: 'Stress analysis', icon: Zap, permission: 'simulation:run', group: 'OPERATIONS' },

  { to: '/ai-assistant', label: 'AI assistant', icon: BrainCircuit, permission: 'ai:chat', group: 'INTELLIGENCE' },
  { to: '/transformer-3d', label: 'Transformer 3D', icon: Cpu, permission: 'ai:chat', group: 'INTELLIGENCE' },
  { to: '/rag', label: 'Document scanner', icon: ScanSearch, permission: 'rag:query', group: 'INTELLIGENCE' },
  { to: '/graphrag', label: 'GraphRAG', icon: Network, permission: 'graphrag:query', group: 'INTELLIGENCE' },
  { to: '/documents', label: 'Documents', icon: FileText, permission: 'documents:read', group: 'INTELLIGENCE' },

  { to: '/safety', label: 'Safety', icon: ShieldAlert, permission: 'safety:read', group: 'GOVERNANCE' },
  { to: '/approvals', label: 'Approvals', icon: ShieldCheck, permission: 'safety:read', group: 'GOVERNANCE' },
  { to: '/network', label: 'Sovereignty', icon: Network, permission: 'safety:read', group: 'GOVERNANCE' },
  { to: '/ledger-tamper', label: 'Ledger Tamper Sim', icon: Lock, permission: 'safety:read', group: 'GOVERNANCE' },
  { to: '/admin', label: 'Admin', icon: Settings2, permission: 'users:read', group: 'GOVERNANCE' },
]

export const GROUP_LABELS: Record<NavItem['group'], string> = {
  OPERATIONS: 'Operations',
  INTELLIGENCE: 'Intelligence',
  GOVERNANCE: 'Governance',
}
