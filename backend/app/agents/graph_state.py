from typing import TypedDict, List, Dict, Any, Optional

class OrchestratorGraphState(TypedDict, total=False):
    """
    Explicit Graph State for the Sovereign LangGraph Orchestrator.
    Carries complete context, planned task sequence, accumulated telemetry,
    citations, execution traces, approval checkpoints, and replanning data.
    """
    request_id: str
    user: str
    user_role: str
    user_query: str
    machine_id: Optional[str]
    file_path: Optional[str]
    file_type: Optional[str]
    auto_approve_controlled: bool
    
    # Brain Planning State
    detected_intent: str
    task_plan: Optional[Dict[str, Any]]
    current_task_idx: int
    completed_tasks: List[Dict[str, Any]]
    execution_trace: List[Dict[str, Any]]
    last_agent_result: Optional[Dict[str, Any]]
    
    # Grounded Accumulated Context
    retrieved_context: List[str]
    retrieved_citations: List[Dict[str, Any]]
    telemetry_data: Optional[Dict[str, Any]]
    graph_facts: List[str]
    ocr_text: Optional[str]
    
    # Safety & Human Gate State
    requires_human_approval: bool
    approval_status: str  # "NONE", "PENDING", "APPROVED", "REJECTED"
    pending_approval: Optional[Dict[str, Any]]
    
    # Control & Replanning State
    status: str
    retry_count: int
    errors: List[str]
    conversation_history: Optional[List[Dict[str, Any]]]
    final_answer: str
    model_used: str
    is_fallback: bool
