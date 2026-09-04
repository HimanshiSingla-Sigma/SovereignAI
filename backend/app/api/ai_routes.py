from fastapi import APIRouter, Depends
from app.core.rbac import require_permission
from app.ai.gateway import model_gateway
from app.agents.orchestrator import AgentOrchestrator
from app.graphrag.hybrid_retriever import UnifiedEvidenceRetriever
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.schemas.schemas import AIChatRequest, AIChatResponse, DocumentCitation

router = APIRouter(prefix="/ai", tags=["AI Assistant & Agents"])

@router.post("/chat", response_model=AIChatResponse)
def chat_with_assistant(req: AIChatRequest, payload: dict = Depends(require_permission("ai:chat"))):
    user = payload["sub"]
    role = payload.get("role", "OPERATOR")

    # 1. Gather Grounded Evidence
    evidence = UnifiedEvidenceRetriever.get_evidence(
        query=req.message,
        machine_id=req.machine_id,
        user_role=role
    )

    # 2. Get Telemetry if machine referenced
    telemetry_data = None
    target_mach = req.machine_id or evidence["target_machine"]
    if target_mach:
        history = TelemetrySimulator.get_history(target_mach, limit=1)
        if history:
            telemetry_data = history[-1]

    # 3. Model Gateway Invocation
    result = model_gateway.process_request(
        prompt=req.message,
        user=user,
        task_type="REASONING" if target_mach else "GENERAL_LLM",
        context_chunks=evidence["context_chunks"] if req.use_rag else None,
        graph_facts=evidence["graph_facts"] if req.use_graphrag else None,
        telemetry_data=telemetry_data
    )

    citations = [
        DocumentCitation(
            doc_id=c["doc_id"],
            title=c["title"],
            page_number=c["page_number"],
            snippet=c["snippet"],
            relevance_score=c["relevance_score"]
        ) for c in evidence["rag_citations"]
    ]

    return AIChatResponse(
        response=result["response"],
        model_used=result["model_used"],
        citations=citations if req.use_rag else [],
        knowledge_facts=evidence["graph_facts"] if req.use_graphrag else [],
        agent_steps=[],
        safety_check=result["safety_check"]
    )

@router.post("/agent/execute", response_model=AIChatResponse)
def execute_agent_plan(req: AIChatRequest, payload: dict = Depends(require_permission("agent:execute"))):
    user = payload["sub"]
    role = payload.get("role", "ENGINEER")

    result = AgentOrchestrator.execute_task(
        user_prompt=req.message,
        user=user,
        user_role=role,
        machine_id=req.machine_id
    )

    return AIChatResponse(
        response=result["response"],
        model_used=result["model_used"],
        citations=[],
        knowledge_facts=result.get("knowledge_facts", []),
        agent_steps=result.get("agent_steps", []),
        safety_check=result["safety_check"]
    )
