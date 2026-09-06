import uuid
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission
from app.ai.orchestrator import SovereignOrchestrator
from app.models.all_models import User, Conversation, Message
from app.schemas.schemas import AIChatRequest, AIChatResponse, DocumentCitation, AgentStepResponse

router = APIRouter(prefix="/ai", tags=["AI Assistant & Agents"])

def _get_or_create_conversation(
    db: Session,
    username: str,
    conv_id: Optional[str],
    initial_title: str,
    machine_id: Optional[str]
) -> Conversation:
    user = db.query(User).filter(User.username == username).first()
    if not user and username == "operator":
        user = db.query(User).filter(User.username == "operator1").first()
    if not user and username == "engineer":
        user = db.query(User).filter(User.username == "engineer1").first()
    if not user and username == "safety":
        user = db.query(User).filter(User.username == "safety1").first()
    user_id = user.id if user else 1

    if conv_id:
        conv = db.query(Conversation).filter(
            Conversation.conversation_id == conv_id,
            Conversation.user_id == user_id
        ).first()
        if conv:
            return conv

    # Create a new conversation record
    new_id = conv_id or f"CONV-{uuid.uuid4().hex[:12].upper()}"
    conv = Conversation(
        conversation_id=new_id,
        user_id=user_id,
        title=initial_title[:60] if initial_title else "New Conversation",
        machine_context=machine_id,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)
    return conv

@router.post("/chat", response_model=AIChatResponse)
def chat_with_assistant(
    req: AIChatRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_permission("ai:chat"))
):
    user = payload["sub"]
    role = payload.get("role", "OPERATOR")

    # 1. Retrieve or initialize persistent conversation in PostgreSQL / SQLite
    conv = _get_or_create_conversation(db, user, req.conversation_id, req.message, req.machine_id)

    # 2. Extract previous messages for conversational continuity
    prior_messages = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.asc()).all()[-10:]
    history = [{"role": m.role, "content": m.content} for m in prior_messages]

    # 3. Route through LangGraph Sovereign Orchestrator Brain
    res = SovereignOrchestrator.execute_workflow(
        prompt=req.message,
        user=user,
        user_role=role,
        machine_id=req.machine_id or conv.machine_context,
        file_path=req.file_path,
        file_type=req.file_type,
        auto_approve_controlled=False,
        conversation_history=history
    )

    citations = [
        DocumentCitation(
            doc_id=c.get("doc_id", "DOC-001"),
            title=c.get("title", "Industrial Manual"),
            page_number=c.get("page_number", 1),
            snippet=c.get("snippet", ""),
            relevance_score=c.get("relevance_score", 0.85)
        ) for c in res.get("citations", [])
    ]

    agent_steps = []
    for step in res.get("execution_trace", []):
        agent_steps.append({
            "step_number": step.get("step_number", 1),
            "action": step.get("action", ""),
            "tool_used": step.get("target", "Agent"),
            "input_data": step.get("input_data", {}),
            "output_summary": step.get("output_summary", ""),
            "status": step.get("status", "COMPLETED")
        })

    final_answer = res.get("final_answer", "")
    model_used = res.get("model_used", "Local Sovereign Model")

    # 4. Persist User and Assistant Messages into DB for restart resilience
    try:
        user_msg = Message(
            message_id=f"MSG-{uuid.uuid4().hex[:10].upper()}",
            conversation_id=conv.id,
            role="user",
            content=req.message,
            created_at=datetime.now(timezone.utc)
        )
        asst_msg = Message(
            message_id=f"MSG-{uuid.uuid4().hex[:10].upper()}",
            conversation_id=conv.id,
            role="assistant",
            content=final_answer,
            model_used=model_used,
            agent_trace=agent_steps,
            citations=[c.model_dump() for c in citations],
            facts=res.get("knowledge_facts", []),
            created_at=datetime.now(timezone.utc)
        )
        db.add(user_msg)
        db.add(asst_msg)
        conv.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: Failed to persist conversation messages: {e}")

    return AIChatResponse(
        response=final_answer,
        model_used=model_used,
        conversation_id=conv.conversation_id,
        citations=citations if req.use_rag else [],
        knowledge_facts=res.get("knowledge_facts", []),
        agent_steps=agent_steps,
        safety_check=res.get("safety_check", "PASSED")
    )

@router.post("/agent/execute", response_model=AIChatResponse)
def execute_agent_plan(
    req: AIChatRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_permission("agent:execute"))
):
    user = payload["sub"]
    role = payload.get("role", "ENGINEER")

    conv = _get_or_create_conversation(db, user, req.conversation_id, req.message, req.machine_id)
    prior_messages = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.asc()).all()[-10:]
    history = [{"role": m.role, "content": m.content} for m in prior_messages]

    res = SovereignOrchestrator.execute_workflow(
        prompt=req.message,
        user=user,
        user_role=role,
        machine_id=req.machine_id or conv.machine_context,
        file_path=req.file_path,
        file_type=req.file_type,
        conversation_history=history
    )

    citations = [
        DocumentCitation(
            doc_id=c.get("doc_id", "DOC-001"),
            title=c.get("title", "Industrial Manual"),
            page_number=c.get("page_number", 1),
            snippet=c.get("snippet", ""),
            relevance_score=c.get("relevance_score", 0.85)
        ) for c in res.get("citations", [])
    ]

    agent_steps = []
    for step in res.get("execution_trace", []):
        agent_steps.append({
            "step_number": step.get("step_number", 1),
            "action": step.get("action", ""),
            "tool_used": step.get("target", "Agent"),
            "input_data": step.get("input_data", {}),
            "output_summary": step.get("output_summary", ""),
            "status": step.get("status", "COMPLETED")
        })

    final_answer = res.get("final_answer", "")
    model_used = res.get("model_used", "Local Sovereign Model")

    try:
        user_msg = Message(
            message_id=f"MSG-{uuid.uuid4().hex[:10].upper()}",
            conversation_id=conv.id,
            role="user",
            content=req.message,
            created_at=datetime.now(timezone.utc)
        )
        asst_msg = Message(
            message_id=f"MSG-{uuid.uuid4().hex[:10].upper()}",
            conversation_id=conv.id,
            role="assistant",
            content=final_answer,
            model_used=model_used,
            agent_trace=agent_steps,
            citations=[c.model_dump() for c in citations],
            facts=res.get("knowledge_facts", []),
            created_at=datetime.now(timezone.utc)
        )
        db.add(user_msg)
        db.add(asst_msg)
        conv.updated_at = datetime.now(timezone.utc)
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"Warning: Failed to persist conversation messages: {e}")

    return AIChatResponse(
        response=final_answer,
        model_used=model_used,
        conversation_id=conv.conversation_id,
        citations=citations,
        knowledge_facts=res.get("knowledge_facts", []),
        agent_steps=agent_steps,
        safety_check=res.get("safety_check", "PASSED")
    )
