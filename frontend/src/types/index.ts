export interface UserProfile {
  id: number;
  username: string;
  email: string;
  full_name?: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  mfa_enabled: boolean;
}

export interface SensorItem {
  sensor_id: string;
  sensor_type: string;
  unit: string;
  last_value: number;
  is_healthy: boolean;
}

export interface ComponentItem {
  component_id: string;
  name: string;
  component_type: string;
  health_score: number;
  wear_percentage: number;
}

export interface MachineItem {
  machine_id: string;
  name: string;
  category: string;
  status: 'OPERATIONAL' | 'WARNING' | 'CRITICAL' | 'SHUTDOWN' | 'MAINTENANCE';
  simulation_profile: string;
  health_score: number;
  risk_score: number;
  anomaly_score: number;
  rpm: number;
  operating_hours: number;
  last_telemetry_at?: string;
  components: ComponentItem[];
  sensors: SensorItem[];
}

export interface TelemetryPoint {
  timestamp: string;
  machine_id: string;
  temperature: number;
  vibration: number;
  current: number;
  gas: number;
  anomaly_score: number;
  machine_status: string;
  sensor_health?: Record<string, boolean>;
}

export interface CorrelationAnalytics {
  machine_id: string;
  anomaly_score: number;
  cross_sensor_inconsistencies: string[];
  correlation_matrix: Record<string, Record<string, number>>;
  detected_patterns: string[];
  status: string;
}

export interface HealthRiskAnalytics {
  machine_id: string;
  health_score: number;
  risk_score: number;
  failure_probability: number;
  estimated_rul_hours: number;
  maintenance_priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  recommended_actions: string[];
}

export interface SafetyStatus {
  system_safety_state: 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';
  active_interlocks: number;
  critical_alerts: number;
  pending_approvals: number;
  safety_rules_count: number;
}

export interface SafetyRule {
  rule_id: string;
  name: string;
  parameter: string;
  operator: string;
  threshold: number;
  severity: string;
  action_required: string;
  is_active: boolean;
}

export interface ApprovalItem {
  request_id: string;
  action_type: string;
  target_resource: string;
  requested_by: string;
  required_role: string;
  justification: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  created_at: string;
}

export interface DocumentCitation {
  doc_id: string;
  title: string;
  page_number: number;
  snippet: string;
  relevance_score: number;
}

export interface AgentStep {
  step_number: number;
  action: string;
  tool_used?: string;
  input_data?: any;
  output_summary: string;
  status: string;
}

export interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  model_used?: string;
  citations?: DocumentCitation[];
  knowledge_facts?: string[];
  agent_steps?: AgentStep[];
  safety_check?: string;
}

export interface HardwareProfile {
  cpu_model: string;
  physical_cores: number;
  logical_cores: number;
  total_ram_gb: number;
  available_ram_gb: number;
  gpu_name: string;
  gpu_vendor: string;
  gpu_memory_mb: number;
  has_dedicated_gpu: boolean;
  acceleration: string;
  hardware_tier: string;
  max_model_ram_gb: number;
  operating_system: string;
}

export interface ModelRegistryItem {
  model_id: string;
  name: string;
  parameters: string;
  quantization: string;
  ram_required_gb: number;
  vram_required_gb: number;
  is_compatible: boolean;
  recommended_tier: string;
  description: string;
}

export interface AuditLogItem {
  timestamp: string;
  who: string;
  what: string;
  resource: string;
  result: string;
  reason: string;
  checksum: string;
}
