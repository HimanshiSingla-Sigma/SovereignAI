/**
 * Types mirroring backend/app/schemas/schemas.py (OpenAPI 3.1 contract).
 * Kept in one file so a schema change has exactly one place to land.
 */

// ---------- Auth ----------
export type RoleName = 'OPERATOR' | 'ENGINEER' | 'SAFETY_OFFICER' | 'ADMINISTRATOR'

export interface LoginRequest {
  username: string
  password: string
}

export interface LoginResponse {
  access_token?: string | null
  token_type: string
  mfa_required: boolean
  mfa_setup_required: boolean
  temp_token?: string | null
  username: string
  role?: string | null
}

export interface MFASetupResponse {
  secret: string
  qr_code_data_uri: string
  manual_entry_key: string
}

export interface MFAVerifyRequest {
  temp_token?: string | null
  code: string
}

export interface TokenResponse {
  access_token: string
  token_type: string
  username: string
  role: string
  permissions: string[]
}

export interface CurrentTotpResponse {
  code: string
  secret: string
  username: string
}

/** Shape of GET /api/auth/me (untyped `{}` in the spec, concrete in auth_routes.py). */
export interface MeResponse {
  id: number
  username: string
  email: string
  full_name: string | null
  role: string
  permissions: string[]
  is_active: boolean
  mfa_enabled: boolean
}

// ---------- Users / roles ----------
export interface UserResponse {
  id: number
  username: string
  email: string
  full_name: string | null
  is_active: boolean
  is_admin: boolean
  mfa_enabled: boolean
  roles: string[]
  created_at: string
  last_login: string | null
}

export interface UserCreate {
  username: string
  email: string
  full_name?: string | null
  password: string
  role: string
}

export interface UserUpdate {
  full_name?: string | null
  is_active?: boolean | null
  role?: string | null
}

export interface RoleMatrixEntry {
  name: string
  description: string
  permissions: string[]
}

export interface PermissionEntry {
  code: string
  description: string
  category: string
}

// ---------- Digital twin / telemetry ----------
export interface SensorResponse {
  sensor_id: string
  sensor_type: string
  unit: string
  last_value: number
  is_healthy: boolean
}

export interface ComponentResponse {
  component_id: string
  name: string
  component_type: string
  health_score: number
  wear_percentage: number
}

export interface MachineResponse {
  machine_id: string
  name: string
  category: string
  status: string
  simulation_profile: string
  health_score: number
  risk_score: number
  anomaly_score: number
  rpm: number
  operating_hours: number
  last_telemetry_at?: string | null
  components: ComponentResponse[]
  sensors: SensorResponse[]
}

/** Emitted by the simulator over /ws/telemetry/{id} and /machines/{id}/history. */
export interface TelemetryPoint {
  timestamp: string
  machine_id?: string
  temperature: number
  vibration: number
  current: number
  gas: number
  anomaly_score: number
  machine_status?: string
  sensor_health?: Record<string, boolean>
}

export type SimulationProfile =
  | 'NORMAL'
  | 'WARNING'
  | 'CRITICAL'
  | 'FAILURE'
  | 'SENSOR_ANOMALY'
  | 'STRESS'

export interface InjectScenarioResponse {
  machine_id: string
  active_profile: SimulationProfile
  latest_telemetry: TelemetryPoint
}

export interface CorrelationResponse {
  machine_id: string
  anomaly_score: number
  cross_sensor_inconsistencies: string[]
  correlation_matrix: Record<string, Record<string, number>>
  detected_patterns: string[]
  status: string
}

export interface HealthRiskResponse {
  machine_id: string
  health_score: number
  risk_score: number
  failure_probability: number
  estimated_rul_hours: number
  maintenance_priority: string
  recommended_actions: string[]
}

// ---------- Safety / approvals ----------
export type SafetyState = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EMERGENCY'

export interface SafetyStatusResponse {
  system_safety_state: SafetyState
  active_interlocks: number
  critical_alerts: number
  pending_approvals: number
  safety_rules_count: number
}

export interface SafetyRule {
  rule_id: string
  name: string
  parameter: string
  operator: string
  threshold: number
  severity: string
  action_required: string
  is_active: boolean
}

export interface SafetyEvent {
  id?: number
  rule_id: string
  machine_id: string
  parameter: string
  trigger_value: number
  threshold_value: number
  severity: string
  action_taken: string
  created_at?: string
  timestamp?: string
}

export interface EmergencyShutdownRequest {
  machine_id: string
  justification: string
}

export interface EmergencyShutdownResponse {
  status: 'EXECUTED' | 'APPROVAL_REQUIRED'
  message: string
  actuator_result?: Record<string, unknown>
  approval_request?: ApprovalRequestResponse
}

export interface ApprovalRequestResponse {
  request_id: string
  action_type: string
  target_resource: string
  requested_by: string
  required_role: string
  justification: string
  status: string
  created_at: string
}

export interface ApprovalDecisionResponse {
  approval: ApprovalRequestResponse
  actuator_result: Record<string, unknown> | null
}

// ---------- What-if ----------
export interface WhatIfScenarioRequest {
  machine_id: string
  temp_delta: number
  vibration_delta: number
  current_delta: number
  gas_delta: number
  ambient_stress_multiplier: number
  simulation_steps: number
}

export interface WhatIfScenarioResponse {
  machine_id: string
  live_state: Record<string, number | string>
  simulated_state: Record<string, number | string>
  predicted_health_score: number
  predicted_risk_score: number
  predicted_anomaly_score: number
  predicted_safety_state: string
  safety_violations_predicted: string[]
  recommended_actions: string[]
  comparison_summary: string
}

// ---------- Documents / RAG ----------
export interface DocumentResponse {
  doc_id: string
  title: string
  filename: string
  file_type: string
  file_size_bytes: number
  classification: string
  uploaded_by: string
  is_indexed: boolean
  created_at: string
}

export interface DocumentCitation {
  doc_id: string
  title: string
  page_number: number
  snippet: string
  relevance_score: number
}

export interface RAGQueryRequest {
  query: string
  top_k: number
  min_score: number
}

export interface RAGQueryResponse {
  query: string
  answer: string
  citations: DocumentCitation[]
  retrieval_method: string
  classification_checked: string
}

// ---------- GraphRAG ----------
export interface KnowledgeNode {
  id: string
  name: string
  type: string
  properties: Record<string, unknown>
}

export interface KnowledgeEdge {
  source: string
  target: string
  type: string
  properties: Record<string, unknown>
}

export interface KnowledgeGraphResponse {
  nodes: KnowledgeNode[]
  edges: KnowledgeEdge[]
}

export interface GraphRootCauseResponse {
  target_entity: string
  probable_root_cause: string
  confidence: number
  /** Each entry is rendered by the backend as `Source --[REL]--> Target`. */
  causal_chain: string[]
  historical_occurrences: number
  recommended_mitigation: string
}

// ---------- AI ----------
export interface AIChatRequest {
  message: string
  machine_id?: string | null
  use_rag: boolean
  use_graphrag: boolean
}

export interface AgentStepResponse {
  step_number: number
  action: string
  tool_used: string | null
  input_data: Record<string, unknown> | null
  output_summary: string
  status: string
}

export interface AIChatResponse {
  response: string
  model_used: string
  citations: DocumentCitation[]
  knowledge_facts: string[]
  agent_steps: AgentStepResponse[]
  safety_check: string
}

// ---------- Hardware / governance ----------
export interface HardwareProfileResponse {
  cpu_model: string
  physical_cores: number
  logical_cores: number
  total_ram_gb: number
  available_ram_gb: number
  gpu_name: string
  gpu_vendor: string
  gpu_memory_mb: number
  has_dedicated_gpu: boolean
  acceleration: string
  hardware_tier: string
  max_model_ram_gb: number
  max_safe_model_ram_gb: number
  operating_system: string
}

export interface ModelRegistryItem {
  model_id: string
  name: string
  parameters: string
  quantization: string
  ram_required_gb: number
  vram_required_gb: number
  is_compatible: boolean
  is_installed?: boolean
  is_fallback?: boolean
  file_size_gb?: number
  recommended_tier: string
  description: string
}

export interface ModelRoutingCandidate {
  model_id: string
  name: string
  status: string
  is_feasible: boolean
  score: number
  execution_mode: string
  target_hardware?: string
  ram_required_gb?: number
  vram_required_gb?: number
  reason?: string
}

export interface ModelRoutingDecision {
  selected_model_id: string
  selected_model_name: string
  task: string
  execution_mode: string
  target_hardware: string
  is_fallback: boolean
  score: number
  reasons: string[]
  hardware_snapshot: Record<string, unknown>
  resource_budget: {
    max_safe_ram_gb: number
    max_safe_vram_gb: number
    model_ram_required_gb: number
    model_vram_required_gb: number
    ram_safety_headroom_gb: number
    max_ram_utilization_limit: number
  }
  candidates_evaluated: ModelRoutingCandidate[]
}

export interface ModelRoutingTableResponse {
  hardware_summary: HardwareProfileResponse
  routing_table: Record<string, ModelRoutingDecision>
}

export interface CompatibilityReport {
  hardware_summary: HardwareProfileResponse
  model_evaluations: Array<{
    model_id: string
    name?: string
    is_compatible: boolean
    reason?: string
    [k: string]: unknown
  }>
}

export interface AuditLogResponse {
  timestamp: string
  who: string
  what: string
  resource: string
  result: string
  reason: string
  checksum: string
}

export interface AuditVerifyResponse {
  [k: string]: unknown
}

export interface SecurityStatsResponse {
  blocked_prompt_injections: number
  failed_login_attempts: number
  mfa_challenge_failures: number
  unauthorized_actuator_denials: number
  total_audit_records_analyzed: number
  firewall_mode: string
  system_integrity: string
}

export interface GatewayStatusResponse {
  active_engine: string
  local_models_detected: string[]
  hardware_tier: string
  cpu_model: string
  max_ram_budget_gb: number
  prompt_guard_active: boolean
  output_guard_active: boolean
}

export interface PromptGuardResult {
  decision: string
  reasons: string[]
  [k: string]: unknown
}

export interface SandboxResult {
  status: 'SUCCESS' | 'BLOCKED' | 'ERROR' | string
  exit_code?: number
  execution_time_seconds?: number
  execution_time_ms?: number
  stdout?: string
  output_variables?: Record<string, unknown>
  variable_types?: Record<string, string>
  security_audit?: {
    ast_passed?: boolean
    forbidden_modules_checked?: number
    forbidden_calls_checked?: number
    violations?: string[]
  }
  environment?: {
    isolation_mode?: string
    sandbox_security_policy?: string
    network_access?: string
    filesystem_access?: string
  }
  summary?: string
  error?: string
  violations?: string[]
  [k: string]: unknown
}

// ---------- Network sovereignty (additive backend route) ----------
export interface NetworkEgressResponse {
  air_gapped: boolean
  external_connections: number
  internal_connections: number
  outbound_bytes: number
  egress_test: string
  egress_target: string
  external_endpoints: string[]
  interfaces: Array<{ name: string; addresses: string[]; is_loopback: boolean }>
  checked_at: string
  detail: string
}

export interface HealthResponse {
  status: string
  mode: string
  service: string
  version: string
}

// ---------- Document page rendering (additive backend route) ----------
export interface DocumentPage {
  page_number: number
  content: string
}

export interface DocumentPagesResponse {
  doc_id: string
  title: string
  filename: string
  file_type: string
  classification: string
  page_count: number
  pages: DocumentPage[]
}

// ---------- Sovereign Orchestrator ----------
export interface OrchestratorPlanStep {
  step_number: number
  action: string
  capability: string
  handler_type: string
  tool_or_model?: string | null
  args?: Record<string, unknown>
  requires_approval: boolean
  action_type?: string | null
}

export interface OrchestratorPlanResponse {
  plan_id: string
  prompt: string
  detected_intent: string
  confidence: number
  is_compound: boolean
  workflow_sequence: string[]
  planning_level: string
  steps: OrchestratorPlanStep[]
  total_steps: number
}

export interface OrchestratorExecuteRequest {
  prompt: string
  machine_id?: string | null
  file_path?: string | null
  file_type?: string | null
  auto_approve_controlled?: boolean
}

export interface OrchestratorTraceStep {

  step_number: number
  action: string
  capability: string
  handler_type: string
  target?: string | null
  status: string
  input_data?: Record<string, unknown> | null
  output_summary: string
  execution_time_ms: number
  approval_id?: string | null
}

export interface OrchestratorExecuteResponse {
  request_id: string
  prompt: string
  status: string
  detected_intent: string
  planning_level: string
  confidence: number
  steps_executed: number
  total_time_ms: number
  model_used?: string
  is_fallback?: boolean
  execution_trace: OrchestratorTraceStep[]
  final_answer: string
  pending_approval?: Record<string, unknown> | null
  citations?: Array<Record<string, unknown>>
  knowledge_facts?: string[]
  safety_check: string
}

export interface ActiveModelStatusResponse {
  active_model_name: string
  active_model_path?: string | null
  active_task?: string | null
  is_loaded_in_memory: boolean
  is_fallback: boolean
  llama_cpp_installed: boolean
  llama_cpp_version?: string | null
  llama_cpp_status: string
}

export interface CapabilityItem {
  id: string
  name: string
  type: string
  description: string
  is_controlled: boolean
  examples: string[]
}

export interface CapabilityListResponse {
  total: number
  capabilities: CapabilityItem[]
}

