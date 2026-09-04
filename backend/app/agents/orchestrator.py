from typing import Dict, List, Any, Optional
from app.agents.planner import AgentPlanner
from app.agents.tools.registry import ToolRegistry
from app.agents.validator import AgentValidator
from app.ai.gateway import model_gateway
from app.core.audit import AuditLogger

class AgentOrchestrator:
    """
    Industrial Agent Orchestrator.
    Executes multi-step diagnostic plans, handles state, invokes tools,
    validates intermediate results, and synthesizes final reports.
    """

    @classmethod
    def execute_task(
        cls,
        user_prompt: str,
        user: str,
        user_role: str,
        machine_id: Optional[str] = None
    ) -> Dict[str, Any]:
        # 1. Plan Formulation
        plan = AgentPlanner.create_plan(user_prompt, machine_id=machine_id)
        execution_trace = []
        collected_context = []
        collected_graph_facts = []
        collected_telemetry = None

        # 2. Sequential Step Execution
        for step in plan:
            tool_name = step.get("tool")
            args = step.get("args", {})
            step_num = step["step_number"]
            action_desc = step["action"]

            if tool_name:
                tool_res = ToolRegistry.execute_tool(
                    tool_name=tool_name,
                    args=args,
                    user=user,
                    user_role=user_role
                )
                validation = AgentValidator.validate_step(step, tool_res)

                # Store useful intermediate findings
                if tool_name == "run_rag_search" and tool_res.get("status") == "SUCCESS":
                    citations = tool_res["result"].get("citations", [])
                    collected_context.extend([c["full_content"] for c in citations])
                elif tool_name == "query_knowledge_graph" and tool_res.get("status") == "SUCCESS":
                    collected_graph_facts = tool_res["result"].get("causal_chain", [])
                elif tool_name == "fetch_telemetry" and tool_res.get("status") == "SUCCESS":
                    collected_telemetry = tool_res["result"].get("latest", {})

                execution_trace.append({
                    "step_number": step_num,
                    "action": action_desc,
                    "tool_used": tool_name,
                    "input_data": args,
                    "output_summary": f"Executed {tool_name}: {str(tool_res.get('status'))}",
                    "status": "COMPLETED" if validation["is_valid"] else "WARNING"
                })
            else:
                # Final synthesis step
                execution_trace.append({
                    "step_number": step_num,
                    "action": action_desc,
                    "tool_used": "ModelGateway (Local Sovereign Inference)",
                    "input_data": {"user_prompt": user_prompt},
                    "output_summary": "Synthesized diagnostic assessment grounded in telemetry and SOPs.",
                    "status": "COMPLETED"
                })

        # 3. Model Gateway Invocation
        target_machine = machine_id or (plan[0]["args"].get("machine_id") if plan and "args" in plan[0] else None)
        model_result = model_gateway.process_request(
            prompt=user_prompt,
            user=user,
            task_type="REASONING",
            context_chunks=collected_context,
            graph_facts=collected_graph_facts,
            telemetry_data=collected_telemetry
        )

        AuditLogger.log(
            who=user,
            what="AGENT_TASK_COMPLETED",
            resource=target_machine or "IndustrialAgent",
            result="SUCCESS",
            reason=f"Executed {len(plan)} steps",
            details={"steps_count": len(plan)}
        )

        return {
            "response": model_result["response"],
            "model_used": model_result["model_used"],
            "agent_steps": execution_trace,
            "knowledge_facts": collected_graph_facts,
            "safety_check": model_result["safety_check"]
        }
