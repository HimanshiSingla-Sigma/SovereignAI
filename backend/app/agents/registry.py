from typing import Dict, Any, List, Optional, Type
from app.agents.specialized.base_agent import BaseAgent
from app.agents.specialized.telemetry_agent import TelemetryAnomalyAgent
from app.agents.specialized.rag_agent import RagAgent
from app.agents.specialized.safety_control_agent import SafetyControlAgent
from app.agents.specialized.reasoning_agent import ReasoningAgent
from app.agents.specialized.vision_ocr_agent import VisionOcrAgent

class AgentCapability:
    def __init__(
        self,
        agent_type: str,
        name: str,
        description: str,
        agent_class: Type[BaseAgent],
        required_permission: str,
        hardware_affinity: str,
        allowed_tools: List[str],
        data_sources: List[str]
    ):
        self.agent_type = agent_type
        self.name = name
        self.description = description
        self.agent_class = agent_class
        self.required_permission = required_permission
        self.hardware_affinity = hardware_affinity
        self.allowed_tools = allowed_tools
        self.data_sources = data_sources

    def to_dict(self) -> Dict[str, Any]:
        return {
            "agent_type": self.agent_type,
            "name": self.name,
            "description": self.description,
            "required_permission": self.required_permission,
            "hardware_affinity": self.hardware_affinity,
            "allowed_tools": self.allowed_tools,
            "data_sources": self.data_sources
        }

class AgentRegistry:
    """
    Centralized Sovereign Agent Capability Registry.
    Defines capabilities, hardware affinity, permissions, and tool access for all specialized agents.
    """
    _agents: Dict[str, AgentCapability] = {
        "TELEMETRY": AgentCapability(
            agent_type="TELEMETRY",
            name="Telemetry & Digital Twin Agent",
            description="Fetches live telemetry, vibration spectra, correlates sensor anomalies, and traverses causal knowledge graphs.",
            agent_class=TelemetryAnomalyAgent,
            required_permission="telemetry:read",
            hardware_affinity="CPU_FAST",
            allowed_tools=["fetch_telemetry", "query_digital_twin", "query_knowledge_graph"],
            data_sources=["Digital Twin Sensors", "Knowledge Graph (GraphRAG)"]
        ),
        "RAG": AgentCapability(
            agent_type="RAG",
            name="Sovereign Document RAG Agent",
            description="Retrieves grounded SOP procedures and engineering documentation using dense semantic vector search and RBAC.",
            agent_class=RagAgent,
            required_permission="rag:search",
            hardware_affinity="CPU_VECTOR",
            allowed_tools=["run_rag_search"],
            data_sources=["Technical SOP Manuals", "Engineering Schematics", "Compliance Specs"]
        ),
        "SAFETY_CONTROL": AgentCapability(
            agent_type="SAFETY_CONTROL",
            name="Safety & Actuator Interlock Agent",
            description="Evaluates deterministic safety rules and enforces Human-in-the-Loop approval gates for machine physical actions.",
            agent_class=SafetyControlAgent,
            required_permission="safety:evaluate",
            hardware_affinity="CPU_REALTIME",
            allowed_tools=["evaluate_safety_state", "request_human_approval"],
            data_sources=["Deterministic Safety Rules", "Simulated Actuator Controller"]
        ),
        "VISION_OCR": AgentCapability(
            agent_type="VISION_OCR",
            name="Vision & OCR Inspection Agent",
            description="Extracts tabular data and text from scanned maintenance logs and equipment nameplates.",
            agent_class=VisionOcrAgent,
            required_permission="documents:read",
            hardware_affinity="CPU_OR_ACCELERATED",
            allowed_tools=["extract_ocr_text", "parse_document_pages"],
            data_sources=["Scanned PDF Reports", "Physical Inspection Sheets"]
        ),
        "REASONING": AgentCapability(
            agent_type="REASONING",
            name="Reasoning & Diagnostic Synthesis Agent",
            description="Synthesizes diagnostic root causes, evaluates engineering formulas, executes sandboxed Python code, and answers general queries.",
            agent_class=ReasoningAgent,
            required_permission="ai:chat",
            hardware_affinity="LOCAL_LLM_INSTRUCT",
            allowed_tools=["execute_python_sandbox", "calculate_engineering_formula", "analyze_spreadsheet"],
            data_sources=["Grounded Graph State", "Sandboxed Python Runtime"]
        )
    }

    @classmethod
    def get_agent(cls, agent_type: str) -> Optional[AgentCapability]:
        return cls._agents.get(agent_type.upper())

    @classmethod
    def list_agents(cls) -> List[Dict[str, Any]]:
        return [cap.to_dict() for cap in cls._agents.values()]

    @classmethod
    def create_instance(cls, agent_type: str) -> Optional[BaseAgent]:
        cap = cls.get_agent(agent_type)
        if cap:
            return cap.agent_class()
        return None
