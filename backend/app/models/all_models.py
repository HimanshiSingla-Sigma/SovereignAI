from datetime import datetime, timezone
from sqlalchemy import (
    Column, Integer, String, Boolean, Float, Text, DateTime, ForeignKey, JSON
)
from sqlalchemy.orm import relationship
from app.core.database import Base

def utcnow():
    return datetime.now(timezone.utc)

# ================= AUTH & RBAC MODELS =================

class RolePermission(Base):
    __tablename__ = "role_permissions"
    id = Column(Integer, primary_key=True, index=True)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Integer, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

class UserRole(Base):
    __tablename__ = "user_roles"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    role_id = Column(Integer, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)

class Role(Base):
    __tablename__ = "roles"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(50), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    permissions = relationship("Permission", secondary="role_permissions", back_populates="roles")
    users = relationship("User", secondary="user_roles", back_populates="roles")

class Permission(Base):
    __tablename__ = "permissions"
    id = Column(Integer, primary_key=True, index=True)
    code = Column(String(100), unique=True, index=True, nullable=False)
    description = Column(String(255), nullable=True)
    category = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utcnow)

    roles = relationship("Role", secondary="role_permissions", back_populates="permissions")

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    full_name = Column(String(100), nullable=True)
    hashed_password = Column(String(255), nullable=False)
    is_active = Column(Boolean, default=True)
    is_admin = Column(Boolean, default=False)
    mfa_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    last_login = Column(DateTime, nullable=True)

    roles = relationship("Role", secondary="user_roles", back_populates="users")
    mfa_credential = relationship("MFACredential", back_populates="user", uselist=False, cascade="all, delete-orphan")
    sessions = relationship("UserSession", back_populates="user", cascade="all, delete-orphan")
    conversations = relationship("Conversation", back_populates="user", cascade="all, delete-orphan")

class MFACredential(Base):
    __tablename__ = "mfa_credentials"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False)
    secret = Column(String(64), nullable=False)
    is_verified = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)
    verified_at = Column(DateTime, nullable=True)

    user = relationship("User", back_populates="mfa_credential")

class UserSession(Base):
    __tablename__ = "sessions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    session_token = Column(String(255), unique=True, index=True, nullable=False)
    ip_address = Column(String(50), nullable=True)
    user_agent = Column(String(255), nullable=True)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, default=utcnow)

    user = relationship("User", back_populates="sessions")


# ================= DIGITAL TWIN & TELEMETRY MODELS =================

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    asset_type = Column(String(50), nullable=False)  # Machine, Pump, Motor, Compressor
    location = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    commissioned_date = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class Machine(Base):
    __tablename__ = "machines"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    category = Column(String(50), nullable=False)
    status = Column(String(30), default="OPERATIONAL")  # OPERATIONAL, WARNING, CRITICAL, SHUTDOWN, MAINTENANCE
    simulation_profile = Column(String(30), default="NORMAL")
    health_score = Column(Float, default=100.0)
    risk_score = Column(Float, default=0.0)
    anomaly_score = Column(Float, default=0.0)
    rpm = Column(Float, default=1500.0)
    operating_hours = Column(Float, default=240.0)
    last_telemetry_at = Column(DateTime, default=utcnow)
    location = Column(String(100), default="Factory Floor", nullable=True)
    production_line = Column(String(100), default="Line-1", nullable=True)
    machine_type = Column(String(50), default="CNC_MILL", nullable=True)
    manufacturer = Column(String(100), nullable=True)
    model_number = Column(String(100), nullable=True)
    serial_number = Column(String(100), nullable=True)
    protocol = Column(String(50), default="MQTT", nullable=True)
    ip_address = Column(String(100), nullable=True)
    capabilities = Column(JSON, default=list, nullable=True)
    safety_profile = Column(JSON, default=dict, nullable=True)
    telemetry_topic = Column(String(100), nullable=True)
    data_source = Column(String(30), default="SIMULATOR", nullable=True)
    graph_sync_status = Column(String(30), default="SYNCED", nullable=True)
    graph_synced_at = Column(DateTime, default=utcnow, nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow, nullable=True)

    components = relationship("Component", back_populates="machine", cascade="all, delete-orphan")
    sensors = relationship("Sensor", back_populates="machine", cascade="all, delete-orphan")
    telemetry_records = relationship("TelemetryRecord", back_populates="machine", cascade="all, delete-orphan")
    alerts = relationship("MachineAlert", back_populates="machine", cascade="all, delete-orphan")
    incidents = relationship("MachineIncident", back_populates="machine", cascade="all, delete-orphan")
    maintenance_records = relationship("MaintenanceRecord", back_populates="machine", cascade="all, delete-orphan")

class Component(Base):
    __tablename__ = "components"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(String(50), nullable=False)
    name = Column(String(100), nullable=False)
    component_type = Column(String(50), nullable=False)  # Bearing, Stator, Rotor, Impeller, Valve, Seal
    health_score = Column(Float, default=100.0)
    wear_percentage = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utcnow)

    machine = relationship("Machine", back_populates="components")
    sensors = relationship("Sensor", back_populates="component")

class Sensor(Base):
    __tablename__ = "sensors"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    component_id = Column(Integer, ForeignKey("components.id", ondelete="SET NULL"), nullable=True)
    sensor_id = Column(String(50), nullable=False)
    sensor_type = Column(String(30), nullable=False)  # TEMPERATURE, VIBRATION, CURRENT, GAS, PRESSURE
    unit = Column(String(20), nullable=False)  # °C, mm/s, A, ppm, bar
    min_threshold = Column(Float, nullable=True)
    max_threshold = Column(Float, nullable=True)
    is_healthy = Column(Boolean, default=True)
    last_value = Column(Float, default=0.0)
    created_at = Column(DateTime, default=utcnow)

    machine = relationship("Machine", back_populates="sensors")
    component = relationship("Component", back_populates="sensors")

class TelemetryRecord(Base):
    __tablename__ = "telemetry"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    timestamp = Column(DateTime, default=utcnow, index=True)
    temperature = Column(Float, nullable=False)
    vibration = Column(Float, nullable=False)
    current = Column(Float, nullable=False)
    gas = Column(Float, nullable=False)
    machine_status = Column(String(30), nullable=False)
    sensor_health = Column(JSON, nullable=True)
    anomaly_score = Column(Float, default=0.0)
    correlation_metrics = Column(JSON, nullable=True)

    machine = relationship("Machine", back_populates="telemetry_records")

class MachineAlert(Base):
    __tablename__ = "alerts"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    severity = Column(String(20), nullable=False)  # INFO, WARNING, CRITICAL, EMERGENCY
    title = Column(String(100), nullable=False)
    description = Column(Text, nullable=False)
    is_acknowledged = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    machine = relationship("Machine", back_populates="alerts")

class MachineIncident(Base):
    __tablename__ = "incidents"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    incident_code = Column(String(50), unique=True, nullable=False)
    severity = Column(String(20), nullable=False)
    root_cause = Column(Text, nullable=True)
    remediation = Column(Text, nullable=True)
    status = Column(String(20), default="OPEN")  # OPEN, INVESTIGATING, RESOLVED, CLOSED
    created_at = Column(DateTime, default=utcnow)
    resolved_at = Column(DateTime, nullable=True)

    machine = relationship("Machine", back_populates="incidents")

class MaintenanceRecord(Base):
    __tablename__ = "maintenance_records"
    id = Column(Integer, primary_key=True, index=True)
    machine_id = Column(Integer, ForeignKey("machines.id", ondelete="CASCADE"), nullable=False)
    maintenance_type = Column(String(50), nullable=False)  # PREVENTIVE, CORRECTIVE, EMERGENCY
    description = Column(Text, nullable=False)
    performed_by = Column(String(100), nullable=False)
    action_taken = Column(Text, nullable=True)
    cost = Column(Float, default=0.0)
    scheduled_date = Column(DateTime, default=utcnow)
    completed_date = Column(DateTime, nullable=True)

    machine = relationship("Machine", back_populates="maintenance_records")


# ================= SAFETY & APPROVAL MODELS =================

class SafetyRule(Base):
    __tablename__ = "safety_rules"
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String(50), unique=True, index=True, nullable=False)
    name = Column(String(100), nullable=False)
    parameter = Column(String(50), nullable=False)  # TEMPERATURE, VIBRATION, CURRENT, GAS, ANOMALY
    operator = Column(String(10), nullable=False)  # >, <, >=, <=, ==
    threshold = Column(Float, nullable=False)
    severity = Column(String(20), nullable=False)  # WARNING, CRITICAL, EMERGENCY
    action_required = Column(String(50), nullable=False)  # ALERT, APPROVAL_REQUIRED, AUTOMATIC_SHUTDOWN
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)

class SafetyEvent(Base):
    __tablename__ = "safety_events"
    id = Column(Integer, primary_key=True, index=True)
    rule_id = Column(String(50), nullable=False)
    machine_id = Column(String(50), nullable=False)
    parameter = Column(String(50), nullable=False)
    trigger_value = Column(Float, nullable=False)
    threshold_value = Column(Float, nullable=False)
    severity = Column(String(20), nullable=False)
    action_taken = Column(String(100), nullable=False)
    created_at = Column(DateTime, default=utcnow)

class ApprovalRequest(Base):
    __tablename__ = "approvals"
    id = Column(Integer, primary_key=True, index=True)
    request_id = Column(String(50), unique=True, index=True, nullable=False)
    action_type = Column(String(50), nullable=False)  # EMERGENCY_SHUTDOWN, SETPOINT_CHANGE, MAINTENANCE_OVERRIDE
    target_resource = Column(String(100), nullable=False)
    requested_by = Column(String(50), nullable=False)
    required_role = Column(String(50), default="SAFETY_OFFICER")
    justification = Column(Text, nullable=False)
    status = Column(String(20), default="PENDING")  # PENDING, APPROVED, REJECTED
    decided_by = Column(String(50), nullable=True)
    decision_reason = Column(Text, nullable=True)
    decision_timestamp = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class ActuatorAudit(Base):
    __tablename__ = "actuator_audits"
    id = Column(Integer, primary_key=True, index=True)
    actuator_id = Column(String(50), nullable=False)
    machine_id = Column(String(50), nullable=False)
    command = Column(String(50), nullable=False)
    issued_by = Column(String(50), nullable=False)
    approval_id = Column(String(50), nullable=True)
    result_status = Column(String(20), nullable=False)
    timestamp = Column(DateTime, default=utcnow)


# ================= DOCUMENTS & RAG MODELS =================

class Document(Base):
    __tablename__ = "documents"
    id = Column(Integer, primary_key=True, index=True)
    doc_id = Column(String(50), unique=True, index=True, nullable=False)
    title = Column(String(255), nullable=False)
    filename = Column(String(255), nullable=False)
    file_type = Column(String(20), nullable=False)  # PDF, SCANNED_PDF, TXT, MD, IMAGE
    file_size_bytes = Column(Integer, nullable=False)
    classification = Column(String(20), default="INTERNAL")  # PUBLIC, INTERNAL, CONFIDENTIAL, RESTRICTED
    file_hash = Column(String(64), nullable=False)
    storage_path = Column(String(255), nullable=False)
    page_count = Column(Integer, default=1)
    uploaded_by = Column(String(50), nullable=False)
    is_indexed = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow)

    metadata_records = relationship("DocumentMetadata", back_populates="document", cascade="all, delete-orphan")
    chunks = relationship("DocumentChunk", back_populates="document", cascade="all, delete-orphan")

class DocumentMetadata(Base):
    __tablename__ = "document_metadata"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    key = Column(String(50), nullable=False)
    value = Column(Text, nullable=False)

    document = relationship("Document", back_populates="metadata_records")

class DocumentChunk(Base):
    __tablename__ = "document_chunks"
    id = Column(Integer, primary_key=True, index=True)
    document_id = Column(Integer, ForeignKey("documents.id", ondelete="CASCADE"), nullable=False)
    chunk_index = Column(Integer, nullable=False)
    page_number = Column(Integer, default=1)
    content = Column(Text, nullable=False)
    token_count = Column(Integer, default=0)
    classification = Column(String(20), default="INTERNAL")
    embedding_json = Column(JSON, nullable=True)  # Normalized vector embedding

    document = relationship("Document", back_populates="chunks")


# ================= KNOWLEDGE GRAPH (GRAPHRAG) MODELS =================

class KnowledgeEntity(Base):
    __tablename__ = "knowledge_entities"
    id = Column(Integer, primary_key=True, index=True)
    entity_id = Column(String(100), unique=True, index=True, nullable=False)
    entity_type = Column(String(50), nullable=False)  # Machine, Component, FailureMode, MaintenanceProcedure, Incident
    name = Column(String(150), nullable=False)
    properties = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

class KnowledgeRelationship(Base):
    __tablename__ = "knowledge_relationships"
    id = Column(Integer, primary_key=True, index=True)
    source_entity_id = Column(String(100), index=True, nullable=False)
    target_entity_id = Column(String(100), index=True, nullable=False)
    relationship_type = Column(String(50), nullable=False)  # HAS_COMPONENT, HAD_FAILURE, HAS_MAINTENANCE, RELATED_TO
    properties = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)


# ================= AUDIT & SECURITY LOGS =================

class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    who = Column(String(50), nullable=False, index=True)
    what = Column(String(100), nullable=False)
    resource = Column(String(150), nullable=False)
    result = Column(String(20), nullable=False)  # SUCCESS, FAILURE, BLOCKED, DENIED
    reason = Column(Text, nullable=True)
    ip_address = Column(String(50), default="127.0.0.1")
    user_agent = Column(String(255), default="Internal")
    checksum = Column(String(64), nullable=False)
    details = Column(JSON, nullable=True)

class SecurityEvent(Base):
    __tablename__ = "security_events"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=utcnow, index=True)
    event_type = Column(String(50), nullable=False)  # PROMPT_INJECTION, EXFILTRATION_ATTEMPT, SQL_INJECTION, AUTH_LOCKOUT
    source_user = Column(String(50), nullable=False)
    risk_level = Column(String(20), nullable=False)  # LOW, MEDIUM, HIGH, CRITICAL
    description = Column(Text, nullable=False)
    payload_sample = Column(Text, nullable=True)
    action_taken = Column(String(30), default="BLOCKED")  # BLOCKED, FLAGGED, MONITORED


# ================= CONVERSATION & PERSISTENT CHAT MODELS =================

class Conversation(Base):
    __tablename__ = "conversations"
    id = Column(Integer, primary_key=True, index=True)
    conversation_id = Column(String(64), unique=True, index=True, nullable=False)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String(255), default="New Conversation")
    summary = Column(Text, nullable=True)
    machine_context = Column(String(50), nullable=True)
    created_at = Column(DateTime, default=utcnow)
    updated_at = Column(DateTime, default=utcnow, onupdate=utcnow)

    user = relationship("User", back_populates="conversations")
    messages = relationship("Message", back_populates="conversation", cascade="all, delete-orphan", order_by="Message.created_at")


class Message(Base):
    __tablename__ = "messages"
    id = Column(Integer, primary_key=True, index=True)
    message_id = Column(String(64), unique=True, index=True, nullable=False)
    conversation_id = Column(Integer, ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(30), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    model_used = Column(String(100), nullable=True)
    agent_trace = Column(JSON, nullable=True)
    citations = Column(JSON, nullable=True)
    facts = Column(JSON, nullable=True)
    created_at = Column(DateTime, default=utcnow)

    conversation = relationship("Conversation", back_populates="messages")
