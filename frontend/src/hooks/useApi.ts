import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/apiClient'
import { useAuthStore } from '@/store/authStore'
import type {
  ApprovalDecisionResponse,
  ApprovalRequestResponse,
  AuditLogResponse,
  AuditVerifyResponse,
  CompatibilityReport,
  CorrelationResponse,
  DocumentResponse,
  EmergencyShutdownResponse,
  GatewayStatusResponse,
  GraphRootCauseResponse,
  HardwareProfileResponse,
  HealthRiskResponse,
  InjectScenarioResponse,
  KnowledgeGraphResponse,
  MachineResponse,
  ModelRegistryItem,
  ModelRoutingDecision,
  ModelRoutingTableResponse,
  NetworkEgressResponse,
  PermissionEntry,
  RoleMatrixEntry,
  SafetyEvent,
  SafetyRule,
  SafetyStatusResponse,
  SecurityStatsResponse,
  SimulationProfile,
  TelemetryPoint,
  UserCreate,
  UserResponse,
  UserUpdate,
  WhatIfScenarioRequest,
  WhatIfScenarioResponse,
  CapabilityListResponse,
  OrchestratorPlanResponse,
  OrchestratorExecuteResponse,
  OrchestratorExecuteRequest,
  ActiveModelStatusResponse,
} from '@/types/api'


/** Convenience wrapper: only run a query when the role actually allows it. */
export function usePermission(permission: string) {
  return useAuthStore((s) => s.permissions.includes(permission))
}

// ------------------------------------------------------------ digital twin

export function useMachines(enabled = true) {
  return useQuery({
    queryKey: ['machines'],
    queryFn: () => api.get<MachineResponse[]>('/api/machines'),
    enabled,
    refetchInterval: 8_000,
  })
}

export function useMachine(machineId: string | null) {
  return useQuery({
    queryKey: ['machine', machineId],
    queryFn: () => api.get<MachineResponse>(`/api/machines/${machineId}`),
    enabled: Boolean(machineId),
    refetchInterval: 6_000,
  })
}

export function useMachineHistory(machineId: string | null, limit = 30) {
  return useQuery({
    queryKey: ['machine-history', machineId, limit],
    queryFn: () => api.get<TelemetryPoint[]>(`/api/machines/${machineId}/history?limit=${limit}`),
    enabled: Boolean(machineId),
  })
}

export function useInjectScenario() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { machine_id: string; profile: SimulationProfile }) =>
      api.post<InjectScenarioResponse>('/api/telemetry/inject-scenario', vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['machines'] })
      void qc.invalidateQueries({ queryKey: ['machine'] })
      void qc.invalidateQueries({ queryKey: ['safety-status'] })
    },
  })
}

// --------------------------------------------------------------- analytics

export function useMachineHealth(machineId: string | null) {
  return useQuery({
    queryKey: ['analytics-health', machineId],
    queryFn: () => api.get<HealthRiskResponse>(`/api/analytics/${machineId}/health`),
    enabled: Boolean(machineId),
    refetchInterval: 10_000,
  })
}

export function useCorrelation(machineId: string | null) {
  return useQuery({
    queryKey: ['analytics-correlation', machineId],
    queryFn: () => api.get<CorrelationResponse>(`/api/analytics/${machineId}/correlation`),
    enabled: Boolean(machineId),
    refetchInterval: 10_000,
  })
}

// ------------------------------------------------------------------ safety

export function useSafetyStatus(enabled = true) {
  return useQuery({
    queryKey: ['safety-status'],
    queryFn: () => api.get<SafetyStatusResponse>('/api/safety/status'),
    enabled,
    refetchInterval: 5_000,
  })
}

export function useSafetyRules(enabled = true) {
  return useQuery({
    queryKey: ['safety-rules'],
    queryFn: () => api.get<SafetyRule[]>('/api/safety/rules'),
    enabled,
  })
}

export function useSafetyEvents(limit = 30) {
  return useQuery({
    queryKey: ['safety-events', limit],
    queryFn: () => api.get<SafetyEvent[]>(`/api/safety/events?limit=${limit}`),
    refetchInterval: 7_000,
  })
}

export function useEmergencyShutdown() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { machine_id: string; justification: string }) =>
      api.post<EmergencyShutdownResponse>('/api/safety/emergency-shutdown', vars),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['safety-status'] })
      void qc.invalidateQueries({ queryKey: ['safety-events'] })
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['machines'] })
    },
  })
}

// --------------------------------------------------------------- approvals

export function useApprovals(enabled = true) {
  return useQuery({
    queryKey: ['approvals'],
    queryFn: () => api.get<ApprovalRequestResponse[]>('/api/approvals'),
    enabled,
    refetchInterval: 6_000,
  })
}

export function useDecideApproval() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { requestId: string; decision: 'APPROVED' | 'REJECTED'; reason: string }) =>
      api.post<ApprovalDecisionResponse>(`/api/approvals/${vars.requestId}/decide`, {
        decision: vars.decision,
        reason: vars.reason,
      }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['approvals'] })
      void qc.invalidateQueries({ queryKey: ['safety-status'] })
      void qc.invalidateQueries({ queryKey: ['safety-events'] })
    },
  })
}

// -------------------------------------------------------------- simulation

export function useWhatIf() {
  return useMutation({
    mutationFn: (vars: WhatIfScenarioRequest) => api.post<WhatIfScenarioResponse>('/api/simulation/what-if', vars),
  })
}

// --------------------------------------------------------------- documents

export function useDocuments(enabled = true) {
  return useQuery({
    queryKey: ['documents'],
    queryFn: () => api.get<DocumentResponse[]>('/api/documents'),
    enabled,
  })
}

export function useUploadDocument() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { file: File; title: string; classification: string }) => {
      const fd = new FormData()
      fd.append('file', vars.file)
      if (vars.title) fd.append('title', vars.title)
      fd.append('classification', vars.classification)
      return api.upload<DocumentResponse>('/api/documents/upload', fd)
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['documents'] })
    },
  })
}

// ---------------------------------------------------------------- graphrag

export function useKnowledgeGraph(enabled = true) {
  return useQuery({
    queryKey: ['graphrag-graph'],
    queryFn: () => api.get<KnowledgeGraphResponse>('/api/graphrag/graph'),
    enabled,
  })
}

export function useRootCause(machineId: string | null, enabled = true) {
  return useQuery({
    queryKey: ['graphrag-root-cause', machineId],
    queryFn: () => api.get<GraphRootCauseResponse>(`/api/graphrag/root-cause/${machineId}`),
    enabled: enabled && Boolean(machineId),
  })
}

// ---------------------------------------------------------------- hardware

export function useHardwareProfile(enabled = true) {
  return useQuery({
    queryKey: ['hardware-profile'],
    queryFn: () => api.get<HardwareProfileResponse>('/api/hardware/profile'),
    enabled,
  })
}

export function useModelRegistry(enabled = true) {
  return useQuery({
    queryKey: ['hardware-models'],
    queryFn: () => api.get<ModelRegistryItem[]>('/api/hardware/models'),
    enabled,
  })
}

export function useCompatibilityReport(enabled = true) {
  return useQuery({
    queryKey: ['hardware-compatibility'],
    queryFn: () => api.get<CompatibilityReport>('/api/hardware/compatibility'),
    enabled,
  })
}

export function useModelRoutingTable(enabled = true) {
  return useQuery({
    queryKey: ['model-routing-table'],
    queryFn: () => api.get<ModelRoutingTableResponse>('/api/hardware/routing'),
    enabled,
    refetchInterval: 10_000,
  })
}

export function useSimulateModelRouting() {
  return useMutation({
    mutationFn: (body: {
      task: string
      available_ram_gb?: number
      available_vram_gb?: number
      has_gpu?: boolean
      cpu_cores?: number
    }) => api.post<ModelRoutingDecision>('/api/hardware/routing/simulate', body),
  })
}

export function useRefreshModels() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<{ status: string; models_count: number; models: ModelRegistryItem[] }>('/api/hardware/models/refresh', {}),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['hardware-models'] })
      void qc.invalidateQueries({ queryKey: ['model-routing-table'] })
      void qc.invalidateQueries({ queryKey: ['hardware-compatibility'] })
    },
  })
}

// -------------------------------------------------- users / roles / audit

export function useUsers(enabled = true) {
  return useQuery({
    queryKey: ['users'],
    queryFn: () => api.get<UserResponse[]>('/api/users'),
    enabled,
  })
}

export function useCreateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: UserCreate) => api.post<UserResponse>('/api/users', body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useUpdateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (vars: { id: number; body: UserUpdate }) => api.put<UserResponse>(`/api/users/${vars.id}`, vars.body),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useDeactivateUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: number) => api.del<{ message: string }>(`/api/users/${id}`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['users'] }),
  })
}

export function useRoles(enabled = true) {
  return useQuery({
    queryKey: ['roles'],
    queryFn: () => api.get<RoleMatrixEntry[]>('/api/roles'),
    enabled,
  })
}

export function useAllPermissions(enabled = true) {
  return useQuery({
    queryKey: ['permissions'],
    queryFn: () => api.get<PermissionEntry[]>('/api/roles/permissions'),
    enabled,
  })
}

export function useAuditLogs(params: { limit: number; who?: string; result?: string }, enabled = true) {
  const search = new URLSearchParams({ limit: String(params.limit) })
  if (params.who) search.set('who', params.who)
  if (params.result) search.set('result', params.result)
  return useQuery({
    queryKey: ['audit-logs', params],
    queryFn: () => api.get<AuditLogResponse[]>(`/api/audit/logs?${search.toString()}`),
    enabled,
  })
}

export function useAuditVerify(enabled = true) {
  return useQuery({
    queryKey: ['audit-verify'],
    queryFn: () => api.get<AuditVerifyResponse>('/api/audit/verify'),
    enabled,
  })
}

// ---------------------------------------------------------------- security

export function useSecurityStats(enabled = true) {
  return useQuery({
    queryKey: ['security-stats'],
    queryFn: () => api.get<SecurityStatsResponse>('/api/security/stats'),
    enabled,
    refetchInterval: 12_000,
  })
}

export function useGatewayStatus(enabled = true) {
  return useQuery({
    queryKey: ['gateway-status'],
    queryFn: () => api.get<GatewayStatusResponse>('/api/security/gateway-status'),
    enabled,
  })
}

// ------------------------------------------------------- network sovereignty

export function useNetworkEgress(enabled = true) {
  return useQuery({
    queryKey: ['network-egress'],
    queryFn: () => api.get<NetworkEgressResponse>('/api/network/egress-status'),
    enabled,
    refetchInterval: 5_000,
  })
}

// ------------------------------------------------------- sovereign orchestrator

export function useCapabilities(enabled = true) {
  return useQuery({
    queryKey: ['orchestrator-capabilities'],
    queryFn: () => api.get<CapabilityListResponse>('/api/orchestrator/capabilities'),
    enabled,
  })
}

export function useOrchestratorPlan() {
  return useMutation({
    mutationFn: (data: OrchestratorExecuteRequest) =>
      api.post<OrchestratorPlanResponse>('/api/orchestrator/plan', data),
  })
}

export function useOrchestratorExecute() {
  return useMutation({
    mutationFn: (data: OrchestratorExecuteRequest) =>
      api.post<OrchestratorExecuteResponse>('/api/orchestrator/execute', data),
  })
}

export function useActiveModelStatus() {
  return useQuery({
    queryKey: ['hardware', 'active-model'],
    queryFn: () => api.get<ActiveModelStatusResponse>('/api/hardware/active-model'),
    refetchInterval: 5000,
  })
}

