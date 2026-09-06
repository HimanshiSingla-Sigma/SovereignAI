import time
from typing import Dict, Any, List
from app.agents.specialized.base_agent import BaseAgent
from app.schemas.agentic_schemas import TaskItem, AgentExecutionResult
from app.agents.graph_state import OrchestratorGraphState
from app.ai.gateway import model_gateway
from app.core.audit import AuditLogger

class ReasoningAgent(BaseAgent):
    """
    Specialized Diagnostic Reasoning Agent.
    Synthesizes multi-modal engineering context (live telemetry, RAG citations,
    causal incident chains) using the local GGUF reasoning model to generate
    root-cause explanations, engineering calculations, and actionable SOP recommendations.
    """

    @property
    def agent_type(self) -> str:
        return "REASONING"

    def execute(self, task: TaskItem, state: OrchestratorGraphState) -> AgentExecutionResult:
        start_time = time.time()
        user = state.get("user", "operator")

        prompt = task.input_parameters.get("prompt") or task.objective or state.get("user_query", "")
        task_mode = task.input_parameters.get("task_mode", "REASONING")

        context_chunks: List[str] = list(state.get("retrieved_context", []))
        if state.get("ocr_text"):
            context_chunks.append(state["ocr_text"])

        graph_facts: List[str] = list(state.get("graph_facts", []))
        telemetry_data = state.get("telemetry_data")

        AuditLogger.log(
            who=user,
            what="AGENT_EXECUTION",
            resource="ReasoningAgent",
            result="INITIATED",
            reason=f"Diagnostic synthesis for objective: {task.objective[:60]}",
            details={"task_id": task.task_id, "task_mode": task_mode}
        )

        try:
            model_res = model_gateway.process_request(
                prompt=prompt,
                user=user,
                task_type=task_mode if task_mode in ["REASONING", "GENERAL_LLM", "CODE"] else "REASONING",
                context_chunks=context_chunks,
                graph_facts=graph_facts,
                telemetry_data=telemetry_data
            )

            duration_ms = round((time.time() - start_time) * 1000, 2)
            response_text = model_res.get("response", "")
            model_name = model_res.get("model_used", "Local Sovereign Model")

            return AgentExecutionResult(
                agent_type=self.agent_type,
                status="COMPLETED",
                output_summary=f"Diagnostic assessment synthesized via {model_name}.",
                data={
                    "response": response_text,
                    "model_used": model_name,
                    "is_fallback": model_res.get("is_fallback", False)
                },
                execution_time_ms=duration_ms
            )
        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            return AgentExecutionResult(
                agent_type=self.agent_type,
                status="FAILED",
                output_summary=f"Reasoning agent encountered an error: {str(e)}",
                error=str(e),
                execution_time_ms=duration_ms
            )
