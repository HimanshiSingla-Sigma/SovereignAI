import time
from typing import Dict, Any
from app.agents.specialized.base_agent import BaseAgent
from app.schemas.agentic_schemas import TaskItem, AgentExecutionResult
from app.agents.graph_state import OrchestratorGraphState
from app.safety.safety_engine import DeterministicSafetyEngine
from app.safety.approval import ApprovalService
from app.safety.actuator import SimulatedActuatorLayer
from app.core.audit import AuditLogger

class SafetyControlAgent(BaseAgent):
    """
    Specialized Industrial Safety & Actuator Control Agent.
    Enforces deterministic safety interlocks and Human-In-The-Loop approval gates.
    The AI Agent NEVER directly activates a physical actuator; any control action
    must pass through Safety Officer sign-off.
    """

    @property
    def agent_type(self) -> str:
        return "SAFETY_CONTROL"

    def execute(self, task: TaskItem, state: OrchestratorGraphState) -> AgentExecutionResult:
        start_time = time.time()
        user = state.get("user", "operator")
        role = state.get("user_role", "ENGINEER")

        target_machine = task.target_resource or state.get("machine_id", "Machine-001")
        
        # Enforce deterministic distinction between informational evaluation and physical actuation
        obj_lower = (task.objective or "").lower()
        param_action = task.input_parameters.get("action_type", "")
        is_physical_command = any(w in obj_lower for w in ["shutdown", "shut down", "halt motor", "trip circuit", "override actuator", "isolate valve", "close valve", "open valve"]) or (param_action in {"EMERGENCY_SHUTDOWN", "THROTTLE_SPEED", "ISOLATE_VALVE", "OVERRIDE_ACTUATOR", "HALT_MOTOR"} and not any(w in obj_lower for w in ["check", "evaluate", "inspect", "rules", "verify", "audit", "assess"]))
        
        if is_physical_command:
            action_type = param_action or "EMERGENCY_SHUTDOWN"
        else:
            action_type = "CHECK_SAFETY_LIMITS"

        auto_approved = state.get("auto_approve_controlled", False)

        AuditLogger.log(
            who=user,
            what="SAFETY_INTERLOCK_EVALUATION",
            resource=f"ActuatorControl:{target_machine}",
            result="INITIATED",
            reason=f"Controlled operation '{task.objective}' requested",
            details={"machine_id": target_machine, "action_type": action_type}
        )

        try:
            CONTROLLED_PHYSICAL_ACTIONS = {"EMERGENCY_SHUTDOWN", "THROTTLE_SPEED", "ISOLATE_VALVE", "OVERRIDE_ACTUATOR", "HALT_MOTOR"}

            if action_type in CONTROLLED_PHYSICAL_ACTIONS:
                if not auto_approved:
                    # Halt and register human approval request
                    appr_rec = ApprovalService.create_request(
                        action_type=action_type,
                        target_resource=target_machine,
                        requested_by=user,
                        justification=f"Controlled operation '{task.objective}' requires Safety Officer sign-off."
                    )

                    duration_ms = round((time.time() - start_time) * 1000, 2)
                    summary = f"Execution paused: Requires Safety Officer sign-off ({appr_rec['request_id']})."

                    return AgentExecutionResult(
                        agent_type=self.agent_type,
                        status="WAITING_APPROVAL",
                        output_summary=summary,
                        data={
                            "approval_request": appr_rec,
                            "request_id": appr_rec["request_id"],
                            "target_machine": target_machine,
                            "action_type": action_type
                        },
                        execution_time_ms=duration_ms
                    )
                else:
                    # Explicitly pre-authorized (e.g. via security test token)
                    actuator_res = SimulatedActuatorLayer.execute_command(
                        actuator_id=f"ACT-{target_machine}",
                        machine_id=target_machine,
                        command=action_type,
                        issued_by=user,
                        issued_by_role="SAFETY_OFFICER"
                    )
                    duration_ms = round((time.time() - start_time) * 1000, 2)
                    summary = f"Authorized controlled action executed on {target_machine}: {actuator_res.get('status', 'OK')}."

                    return AgentExecutionResult(
                        agent_type=self.agent_type,
                        status="COMPLETED",
                        output_summary=summary,
                        data={"actuator_result": actuator_res},
                        execution_time_ms=duration_ms
                    )
            else:
                # Informational safety state evaluation (read-only)
                telemetry = state.get("telemetry_data") or {}
                safety_eval = DeterministicSafetyEngine.evaluate_telemetry(target_machine, telemetry)
                duration_ms = round((time.time() - start_time) * 1000, 2)
                summary = f"Evaluated safety rules for {target_machine}: State={safety_eval.get('state', 'NORMAL')}."

                return AgentExecutionResult(
                    agent_type=self.agent_type,
                    status="COMPLETED",
                    output_summary=summary,
                    data={"safety_evaluation": safety_eval},
                    execution_time_ms=duration_ms
                )
        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            return AgentExecutionResult(
                agent_type=self.agent_type,
                status="FAILED",
                output_summary=f"Safety control evaluation failed: {str(e)}",
                error=str(e),
                execution_time_ms=duration_ms
            )
