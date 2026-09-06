import time
from typing import Dict, Any, List
from app.agents.specialized.base_agent import BaseAgent
from app.schemas.agentic_schemas import TaskItem, AgentExecutionResult
from app.agents.graph_state import OrchestratorGraphState
from app.rag.retriever import HybridRetriever
from app.core.audit import AuditLogger
from app.ai.prompt_guard import PromptGuard

class RagAgent(BaseAgent):
    """
    Specialized Retrieval-Augmented Generation (RAG) Agent.
    Retrieves grounded technical SOPs, engineering manuals, and incident reports
    combining dense semantic vector similarity and lexical keyword matching with
    user RBAC classification clearance.
    """

    @property
    def agent_type(self) -> str:
        return "RAG"

    def execute(self, task: TaskItem, state: OrchestratorGraphState) -> AgentExecutionResult:
        start_time = time.time()
        user = state.get("user", "operator")
        role = state.get("user_role", "ENGINEER")

        # Determine retrieval query
        target_machine = task.target_resource or state.get("machine_id", "")
        query = task.input_parameters.get("query") or task.objective
        if target_machine and target_machine.lower() not in query.lower():
            query = f"{target_machine} {query}"

        AuditLogger.log(
            who=user,
            what="AGENT_EXECUTION",
            resource="RagAgent",
            result="INITIATED",
            reason=f"Searching technical manuals for: {query[:60]}",
            details={"task_id": task.task_id, "query": query}
        )
        try:
            citations = HybridRetriever.retrieve(query=query, user_role=role, top_k=4)
            duration_ms = round((time.time() - start_time) * 1000, 2)

            context_items: List[str] = []
            for c in citations:
                raw_chunk = c.get('full_content') or c.get('snippet', '')
                doc_tag = f"{c.get('title', 'Doc')} P.{c.get('page_number', 1)}"
                wrapped = PromptGuard.wrap_untrusted_data(raw_chunk, source_type="DOCUMENT", identifier=doc_tag)
                context_items.append(wrapped)

            summary = f"Retrieved {len(citations)} verified technical document chunks for '{query[:40]}'."
            if not citations:
                summary = f"No document chunks passed similarity and RBAC thresholds for '{query[:40]}'."

            return AgentExecutionResult(
                agent_type=self.agent_type,
                status="COMPLETED",
                output_summary=summary,
                data={
                    "citations": citations,
                    "context_chunks": context_items,
                    "query": query,
                    "count": len(citations)
                },
                execution_time_ms=duration_ms
            )
        except Exception as e:
            duration_ms = round((time.time() - start_time) * 1000, 2)
            return AgentExecutionResult(
                agent_type=self.agent_type,
                status="FAILED",
                output_summary=f"RAG retrieval encountered an error: {str(e)}",
                error=str(e),
                execution_time_ms=duration_ms
            )
