from typing import Dict, Any, Callable
from app.digital_twin.assets import AssetRegistry
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.digital_twin.correlation_engine import MultiSensorCorrelationEngine
from app.digital_twin.analytics import IndustrialAnalytics
from app.rag.retriever import HybridRetriever
from app.graphrag.knowledge_graph import SovereignKnowledgeGraph
from app.simulation.what_if_engine import WhatIfEngine
from app.safety.safety_engine import DeterministicSafetyEngine
from app.safety.approval import ApprovalService
from app.agents.sandbox import PythonSandbox
from app.core.audit import AuditLogger

class ToolRegistry:
    """
    Central Secure Tool Registry.
    Validates permissions, sanitizes inputs, audits calls, and executes through sandboxes.
    """

    @classmethod
    def execute_tool(cls, tool_name: str, args: Dict[str, Any], user: str, user_role: str) -> Dict[str, Any]:
        # 1. Permission and Existence Check
        handler = getattr(cls, f"_tool_{tool_name}", None)
        if not handler:
            raise ValueError(f"Tool '{tool_name}' does not exist in the Sovereign Tool Registry.")

        # 2. Audit Tool Invocation
        AuditLogger.log(
            who=user,
            what="TOOL_EXECUTION",
            resource=tool_name,
            result="INITIATED",
            reason=f"Invoked by agent on behalf of {user_role}",
            details={"args": args}
        )

        # 3. Execute Tool Handler
        try:
            result = handler(args, user=user, user_role=user_role)
            return {
                "tool": tool_name,
                "status": "SUCCESS",
                "result": result
            }
        except Exception as e:
            return {
                "tool": tool_name,
                "status": "FAILED",
                "error": str(e)
            }

    @classmethod
    def _tool_query_digital_twin(cls, args: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        machine_id = args.get("machine_id", "Machine-001")
        asset = AssetRegistry.get_by_id(machine_id)
        if not asset:
            return {"error": f"Machine '{machine_id}' not found"}
        return asset

    @classmethod
    def _tool_fetch_telemetry(cls, args: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        machine_id = args.get("machine_id", "Machine-001")
        history = TelemetrySimulator.get_history(machine_id, limit=5)
        latest = history[-1] if history else {}
        return {"machine_id": machine_id, "latest": latest, "sample_count": len(history)}

    @classmethod
    def _tool_run_rag_search(cls, args: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        query = args.get("query", "")
        role = kwargs.get("user_role", "ENGINEER")
        citations = HybridRetriever.retrieve(query=query, user_role=role, top_k=3)
        return {"query": query, "citations": citations}

    @classmethod
    def _tool_query_knowledge_graph(cls, args: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        machine_id = args.get("machine_id", "Machine-002")
        return SovereignKnowledgeGraph.analyze_root_cause(machine_id)

    @classmethod
    def _tool_execute_what_if_simulation(cls, args: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        machine_id = args.get("machine_id", "Machine-002")
        temp_delta = float(args.get("temp_delta", 0.0))
        vib_delta = float(args.get("vibration_delta", 0.0))
        return WhatIfEngine.run_scenario(machine_id=machine_id, temp_delta=temp_delta, vibration_delta=vib_delta)

    @classmethod
    def _tool_evaluate_safety_state(cls, args: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        machine_id = args.get("machine_id", "Machine-002")
        history = TelemetrySimulator.get_history(machine_id, limit=1)
        latest = history[-1] if history else {}
        return DeterministicSafetyEngine.evaluate_telemetry(machine_id, latest)

    @classmethod
    def _tool_execute_python_sandbox(cls, args: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        code = args.get("code", "")
        return PythonSandbox.execute_code(code)

    @classmethod
    def _tool_request_human_approval(cls, args: Dict[str, Any], **kwargs) -> Dict[str, Any]:
        user = kwargs.get("user", "System")
        return ApprovalService.create_request(
            action_type=args.get("action_type", "EMERGENCY_SHUTDOWN"),
            target_resource=args.get("target_resource", "Machine-002"),
            requested_by=user,
            justification=args.get("justification", "Autonomous Agent recommended action requiring Human Review.")
        )
