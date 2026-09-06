from typing import Dict, Any, List
from fastapi import APIRouter, Depends, HTTPException
from app.core.rbac import require_permission
from app.ai.orchestrator import SovereignOrchestrator
from app.ai.task_classifier import CapabilityRegistry
from app.schemas.schemas import (
    OrchestratorPlanResponse,
    OrchestratorExecuteRequest,
    OrchestratorExecuteResponse,
    CapabilityListResponse,
    CapabilityItem
)

router = APIRouter(prefix="/orchestrator", tags=["Sovereign Agentic Orchestrator"])

@router.post("/plan", response_model=OrchestratorPlanResponse)
def plan_workflow(req: OrchestratorExecuteRequest, payload: dict = Depends(require_permission("ai:chat"))):
    """
    Formulate a multi-step execution plan using the 3-level decision hierarchy (Semantic Dense Vector -> Local LLM -> Heuristic).
    """
    user = payload.get("sub", "operator")
    role = payload.get("role", "ENGINEER")

    plan = SovereignOrchestrator.plan_workflow(
        prompt=req.prompt,
        machine_id=req.machine_id,
        file_path=req.file_path,
        file_type=req.file_type,
        user=user,
        user_role=role
    )
    return plan

@router.post("/execute", response_model=OrchestratorExecuteResponse)
def execute_workflow(req: OrchestratorExecuteRequest, payload: dict = Depends(require_permission("agent:execute"))):
    """
    Execute an agentic workflow through the Sovereign Orchestrator brain.
    """
    user = payload.get("sub", "operator")
    role = payload.get("role", "ENGINEER")

    result = SovereignOrchestrator.execute_workflow(
        prompt=req.prompt,
        user=user,
        user_role=role,
        machine_id=req.machine_id,
        file_path=req.file_path,
        file_type=req.file_type,
        auto_approve_controlled=req.auto_approve_controlled
    )
    return result

@router.get("/capabilities", response_model=CapabilityListResponse)
def list_capabilities(payload: dict = Depends(require_permission("ai:chat"))):
    """
    List all 14 sovereign industrial capabilities registered in the Sovereign Orchestrator.
    """
    caps = CapabilityRegistry.list_capabilities()
    items = [
        CapabilityItem(
            id=c["id"],
            name=c["name"],
            type=c["type"],
            description=c["description"],
            is_controlled=c["is_controlled"],
            examples=c["examples"]
        ) for c in caps
    ]
    return CapabilityListResponse(total=len(items), capabilities=items)

@router.get("/trace/{request_id}")
def get_execution_trace(request_id: str, payload: dict = Depends(require_permission("ai:chat"))):
    """
    Retrieve full step-by-step audit and execution trace for a completed or in-progress workflow.
    """
    trace = SovereignOrchestrator.get_trace(request_id)
    if not trace:
        raise HTTPException(status_code=404, detail=f"Orchestration trace '{request_id}' not found.")
    return trace

@router.get("/traces")
def get_recent_traces(payload: dict = Depends(require_permission("ai:chat"))):
    """
    Retrieve list of recent workflow execution traces.
    """
    return SovereignOrchestrator.get_all_traces(limit=20)
