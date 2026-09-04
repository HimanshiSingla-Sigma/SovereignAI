from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, EmailStr, Field

# ================= AUTH & USER SCHEMAS =================

class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    access_token: Optional[str] = None
    token_type: str = "bearer"
    mfa_required: bool = False
    mfa_setup_required: bool = False
    temp_token: Optional[str] = None
    username: str
    role: Optional[str] = None

class MFASetupResponse(BaseModel):
    secret: str
    qr_code_data_uri: str
    manual_entry_key: str

class MFAVerifyRequest(BaseModel):
    temp_token: Optional[str] = None
    code: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    username: str
    role: str
    permissions: List[str]

class UserCreate(BaseModel):
    username: str
    email: str
    full_name: Optional[str] = None
    password: str
    role: str = "OPERATOR"

class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    is_active: Optional[bool] = None
    role: Optional[str] = None

class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    full_name: Optional[str]
    is_active: bool
    is_admin: bool
    mfa_enabled: bool
    roles: List[str]
    created_at: datetime
    last_login: Optional[datetime]

    class Config:
        from_attributes = True

class RoleResponse(BaseModel):
    id: int
    name: str
    description: Optional[str]
    permissions: List[str]

    class Config:
        from_attributes = True

# ================= DIGITAL TWIN & TELEMETRY SCHEMAS =================

class SensorResponse(BaseModel):
    sensor_id: str
    sensor_type: str
    unit: str
    last_value: float
    is_healthy: bool

class ComponentResponse(BaseModel):
    component_id: str
    name: str
    component_type: str
    health_score: float
    wear_percentage: float

class MachineResponse(BaseModel):
    machine_id: str
    name: str
    category: str
    status: str
    simulation_profile: str
    health_score: float
    risk_score: float
    anomaly_score: float
    rpm: float
    operating_hours: float
    last_telemetry_at: Optional[datetime] = None
    components: List[ComponentResponse] = []
    sensors: List[SensorResponse] = []

class TelemetryPoint(BaseModel):
    timestamp: str
    temperature: float
    vibration: float
    current: float
    gas: float
    anomaly_score: float

class TelemetrySimulateRequest(BaseModel):
    machine_id: str
    profile: str  # NORMAL, WARNING, CRITICAL, FAILURE, SENSOR_ANOMALY, STRESS
    duration_seconds: Optional[int] = 60

class CorrelationResponse(BaseModel):
    machine_id: str
    anomaly_score: float
    cross_sensor_inconsistencies: List[str]
    correlation_matrix: Dict[str, Dict[str, float]]
    detected_patterns: List[str]
    status: str

class HealthRiskResponse(BaseModel):
    machine_id: str
    health_score: float
    risk_score: float
    failure_probability: float
    estimated_rul_hours: float
    maintenance_priority: str
    recommended_actions: List[str]

# ================= SAFETY & APPROVAL SCHEMAS =================

class SafetyRuleResponse(BaseModel):
    rule_id: str
    name: str
    parameter: str
    operator: str
    threshold: float
    severity: str
    action_required: str
    is_active: bool

class SafetyEventResponse(BaseModel):
    id: int
    rule_id: str
    machine_id: str
    parameter: str
    trigger_value: float
    threshold_value: float
    severity: str
    action_taken: str
    created_at: datetime

class SafetyStatusResponse(BaseModel):
    system_safety_state: str  # NORMAL, WARNING, CRITICAL, EMERGENCY
    active_interlocks: int
    critical_alerts: int
    pending_approvals: int
    safety_rules_count: int

class EmergencyShutdownRequest(BaseModel):
    machine_id: str
    justification: str

class ApprovalRequestResponse(BaseModel):
    request_id: str
    action_type: str
    target_resource: str
    requested_by: str
    required_role: str
    justification: str
    status: str
    created_at: datetime

class ApprovalDecisionRequest(BaseModel):
    decision: str  # APPROVED, REJECTED
    reason: str

# ================= WHAT-IF SIMULATION SCHEMAS =================

class WhatIfScenarioRequest(BaseModel):
    machine_id: str
    temp_delta: float = 0.0
    vibration_delta: float = 0.0
    current_delta: float = 0.0
    gas_delta: float = 0.0
    ambient_stress_multiplier: float = 1.0
    simulation_steps: int = 10

class WhatIfScenarioResponse(BaseModel):
    machine_id: str
    live_state: Dict[str, Any]
    simulated_state: Dict[str, Any]
    predicted_health_score: float
    predicted_risk_score: float
    predicted_anomaly_score: float
    predicted_safety_state: str
    safety_violations_predicted: List[str]
    recommended_actions: List[str]
    comparison_summary: str

# ================= RAG & DOCUMENTS SCHEMAS =================

class DocumentResponse(BaseModel):
    doc_id: str
    title: str
    filename: str
    file_type: str
    file_size_bytes: int
    classification: str
    uploaded_by: str
    is_indexed: bool
    created_at: datetime

class DocumentCitation(BaseModel):
    doc_id: str
    title: str
    page_number: int
    snippet: str
    relevance_score: float

class RAGQueryRequest(BaseModel):
    query: str
    top_k: int = 4
    min_score: float = 0.35

class RAGQueryResponse(BaseModel):
    query: str
    answer: str
    citations: List[DocumentCitation]
    retrieval_method: str
    classification_checked: str

# ================= GRAPHRAG SCHEMAS =================

class KnowledgeNode(BaseModel):
    id: str
    name: str
    type: str
    properties: Dict[str, Any] = {}

class KnowledgeEdge(BaseModel):
    source: str
    target: str
    type: str
    properties: Dict[str, Any] = {}

class KnowledgeGraphResponse(BaseModel):
    nodes: List[KnowledgeNode]
    edges: List[KnowledgeEdge]

class GraphRootCauseResponse(BaseModel):
    target_entity: str
    probable_root_cause: str
    confidence: float
    causal_chain: List[str]
    historical_occurrences: int
    recommended_mitigation: str

# ================= AI & AGENTS SCHEMAS =================

class AIChatRequest(BaseModel):
    message: str
    machine_id: Optional[str] = None
    use_rag: bool = True
    use_graphrag: bool = True

class AgentStepResponse(BaseModel):
    step_number: int
    action: str
    tool_used: Optional[str]
    input_data: Optional[Dict[str, Any]]
    output_summary: str
    status: str

class AIChatResponse(BaseModel):
    response: str
    model_used: str
    citations: List[DocumentCitation] = []
    knowledge_facts: List[str] = []
    agent_steps: List[AgentStepResponse] = []
    safety_check: str = "PASSED"

# ================= HARDWARE & GOVERNANCE SCHEMAS =================

class HardwareProfileResponse(BaseModel):
    cpu_model: str
    physical_cores: int
    logical_cores: int
    total_ram_gb: float
    available_ram_gb: float
    gpu_name: str
    gpu_vendor: str
    gpu_memory_mb: float
    has_dedicated_gpu: bool
    acceleration: str
    hardware_tier: str
    max_model_ram_gb: float = 3.0
    max_safe_model_ram_gb: float = 3.0
    operating_system: str

class ModelRegistryItem(BaseModel):
    model_id: str
    name: str
    parameters: str
    quantization: str
    ram_required_gb: float
    vram_required_gb: float
    is_compatible: bool
    recommended_tier: str
    description: str

class AuditLogResponse(BaseModel):
    timestamp: str
    who: str
    what: str
    resource: str
    result: str
    reason: str
    checksum: str

class SecurityEventResponse(BaseModel):
    id: int
    timestamp: datetime
    event_type: str
    source_user: str
    risk_level: str
    description: str
    action_taken: str
