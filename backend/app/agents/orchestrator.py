from typing import Dict, List, Any, Optional
from app.ai.orchestrator import SovereignOrchestrator
from app.core.audit import AuditLogger

class AgentOrchestrator:
    """
    Industrial Agent Orchestrator.
    Delegates to the SovereignOrchestrator ('The Brain') for multi-task semantic planning,
    tool execution, safety checkpoints, and grounded synthesis, while preserving full
    backwards-compatibility with legacy API contracts.
    """

    @classmethod
    def execute_task(
        cls,
        user_prompt: str,
        user: str,
        user_role: str,
        machine_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # Delegate to the Sovereign Semantic Orchestrator
        orch_res = SovereignOrchestrator.execute_workflow(
            prompt=user_prompt,
            user=user,
            user_role=user_role,
            machine_id=machine_id,
            auto_approve_controlled=False
        )

        # Map Sovereign Orchestrator trace into AgentStepResponse format
        mapped_steps = []
        for step in orch_res.get("execution_trace", []):
            mapped_steps.append({
                "step_number": step["step_number"],
                "action": step["action"],
                "tool_used": step.get("target") or step.get("handler_type"),
                "input_data": step.get("input_data", {}),
                "output_summary": step.get("output_summary", ""),
                "status": step.get("status", "COMPLETED")
            })

        return {
            "response": orch_res.get("final_answer", ""),
            "model_used": f"SovereignOrchestrator ({orch_res.get('planning_level', 'LEVEL_1_SEMANTIC')})",
            "agent_steps": mapped_steps,
            "knowledge_facts": orch_res.get("knowledge_facts", []),
            "safety_check": orch_res.get("safety_check", "PASSED"),
            "request_id": orch_res.get("request_id"),
            "pending_approval": orch_res.get("pending_approval")
        }

