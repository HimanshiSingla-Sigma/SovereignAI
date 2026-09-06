import time
from typing import Dict, Any, List
from app.agents.specialized.base_agent import BaseAgent
from app.schemas.agentic_schemas import TaskItem, AgentExecutionResult
from app.agents.graph_state import OrchestratorGraphState
from app.digital_twin.assets import AssetRegistry
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.graphrag.knowledge_graph import SovereignKnowledgeGraph
from app.safety.safety_engine import DeterministicSafetyEngine
from app.core.audit import AuditLogger

class TelemetryAnomalyAgent(BaseAgent):
    """
    Specialized Telemetry & Digital Twin Agent.
    Queries the digital twin for equipment metadata, fetches live multi-sensor streams
    (vibration, temperature, pressure, motor current), identifies anomalies, and traverses
    the causal knowledge graph for past failure modes.
    """

    @property
    def agent_type(self) -> str:
        return "TELEMETRY"

    def execute(self, task: TaskItem, state: OrchestratorGraphState) -> AgentExecutionResult:
        start_time = time.time()
        user = state.get("user", "operator")

        target_machine = task.target_resource or state.get("machine_id")
        if not target_machine:
            from app.machines.registry_service import MachineRegistryService
            discovered = MachineRegistryService.discover_machines(state.get("user_query", ""))
            target_machine = discovered[0]["machine_id"] if discovered else "Machine-001"

        AuditLogger.log(
            who=user,
            what="AGENT_EXECUTION",
            resource="TelemetryAnomalyAgent",
            result="INITIATED",
            reason=f"Inspecting digital twin and live telemetry for {target_machine}",
            details={"machine_id": target_machine, "task_id": task.task_id}
        )

        try:
            # 1. Fetch asset metadata from twin
            asset = AssetRegistry.get_by_id(target_machine) or {"machine_id": target_machine, "name": target_machine}

            # 2. Fetch live sensor history and latest snapshot
            history = TelemetrySimulator.get_history(target_machine, limit=5)
            latest_telemetry = history[-1] if history else {}

            # 3. Query knowledge graph for causal links
            graph_res = SovereignKnowledgeGraph.analyze_root_cause(target_machine)
            causal_facts: List[str] = graph_res.get("causal_chain", [])
            cause = graph_res.get("probable_root_cause")
            if cause:
                causal_facts.append(f"Probable Cause: {cause}")

            # 4. Evaluate deterministic safety rules
            safety_eval = DeterministicSafetyEngine.evaluate_telemetry(target_machine, latest_telemetry)

            duration_ms = round((time.time() - start_time) * 1000, 2)

            anomaly_str = "ANOMALOUS" if latest_telemetry.get("is_anomaly") else "NORMAL"
            summary = (
                f"Asset {target_machine} telemetry retrieved. Status: {anomaly_str} "
                f"(Vibration: {latest_telemetry.get('vibration', 0.0)} mm/s, "
                f"Temp: {latest_telemetry.get('temperature', 0.0)} °C, "
                f"Safety: {safety_eval.get('state', 'UNKNOWN')})."
            )

            return AgentExecutionResult(
                agent_type=self.agent_type,
                status="COMPLETED",
                output_summary=summary,
                data={
                    "machine_id": target_machine,
                    "asset": asset,
                    "latest_telemetry": latest_telemetry,
                    "telemetry_history": history,
                    "causal_facts": causal_facts,
                    "safety_evaluation": safety_eval
                },
                execution_time_ms=duration_ms
            )
        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            return AgentExecutionResult(
                agent_type=self.agent_type,
                status="FAILED",
                output_summary=f"Failed to fetch telemetry for {target_machine}: {str(e)}",
                error=str(e),
                execution_time_ms=duration_ms
            )
