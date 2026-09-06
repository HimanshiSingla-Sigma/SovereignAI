import uuid
from typing import List
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.rbac import require_permission
from app.models.all_models import User, Conversation, Message
from app.schemas.schemas import (
    CreateConversationRequest,
    ConversationSummaryResponse,
    ConversationDetailResponse,
    ConversationMessageItem
)
from app.ai.gateway import model_gateway

router = APIRouter(prefix="/conversations", tags=["Conversations & Session Continuity"])

def _get_user_by_username(db: Session, username: str) -> User:
    user = db.query(User).filter(User.username == username).first()
    if not user and username == "operator":
        user = db.query(User).filter(User.username == "operator1").first()
    if not user and username == "engineer":
        user = db.query(User).filter(User.username == "engineer1").first()
    if not user and username == "safety":
        user = db.query(User).filter(User.username == "safety1").first()

    if not user:
        unique_email = f"{username}_{uuid.uuid4().hex[:6]}@sovereign.local"
        user = User(
            username=username,
            email=unique_email,
            full_name=username.title(),
            hashed_password="pbkdf2:sha256:100000$local$placeholder",
            is_active=True,
            is_admin=(username == "admin")
        )
        db.add(user)
        db.commit()
        db.refresh(user)
    return user

@router.get("", response_model=List[ConversationSummaryResponse])
def list_conversations(
    db: Session = Depends(get_db),
    payload: dict = Depends(require_permission("ai:chat"))
):
    """
    Retrieve all conversation sessions owned by the authenticated user.
    Enforces strict user isolation.
    """
    username = payload.get("sub", "operator")
    user = _get_user_by_username(db, username)

    convs = db.query(Conversation).filter(Conversation.user_id == user.id).order_by(Conversation.updated_at.desc()).all()
    res = []
    for c in convs:
        msg_count = db.query(Message).filter(Message.conversation_id == c.id).count()
        res.append(
            ConversationSummaryResponse(
                conversation_id=c.conversation_id,
                title=c.title,
                machine_context=c.machine_context,
                summary=c.summary,
                message_count=msg_count,
                created_at=c.created_at,
                updated_at=c.updated_at
            )
        )
    return res

@router.post("", response_model=ConversationDetailResponse, status_code=status.HTTP_201_CREATED)
def create_conversation(
    req: CreateConversationRequest,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_permission("ai:chat"))
):
    """
    Create a new persistent conversation session for the authenticated user.
    """
    username = payload.get("sub", "operator")
    user = _get_user_by_username(db, username)

    conv_id = f"CONV-{uuid.uuid4().hex[:12].upper()}"
    conv = Conversation(
        conversation_id=conv_id,
        user_id=user.id,
        title=req.title or "New Conversation",
        machine_context=req.machine_context,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc)
    )
    db.add(conv)
    db.commit()
    db.refresh(conv)

    return ConversationDetailResponse(
        conversation_id=conv.conversation_id,
        title=conv.title,
        machine_context=conv.machine_context,
        summary=conv.summary,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=[]
    )

@router.get("/{conv_id}", response_model=ConversationDetailResponse)
def get_conversation(
    conv_id: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_permission("ai:chat"))
):
    """
    Get full message transcript and trace history for a given conversation.
    Enforces user isolation.
    """
    username = payload.get("sub", "operator")
    user = _get_user_by_username(db, username)

    conv = db.query(Conversation).filter(
        Conversation.conversation_id == conv_id,
        Conversation.user_id == user.id
    ).first()

    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conv_id}' not found or access denied."
        )

    messages = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.asc()).all()
    msg_items = [
        ConversationMessageItem(
            message_id=m.message_id,
            role=m.role,
            content=m.content,
            model_used=m.model_used,
            agent_trace=m.agent_trace,
            citations=m.citations,
            facts=m.facts,
            created_at=m.created_at
        ) for m in messages
    ]

    return ConversationDetailResponse(
        conversation_id=conv.conversation_id,
        title=conv.title,
        machine_context=conv.machine_context,
        summary=conv.summary,
        created_at=conv.created_at,
        updated_at=conv.updated_at,
        messages=msg_items
    )

@router.delete("/{conv_id}")
def delete_conversation(
    conv_id: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_permission("ai:chat"))
):
    """
    Permanently delete a conversation and its messages.
    """
    username = payload.get("sub", "operator")
    user = _get_user_by_username(db, username)

    conv = db.query(Conversation).filter(
        Conversation.conversation_id == conv_id,
        Conversation.user_id == user.id
    ).first()

    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conv_id}' not found or access denied."
        )

    db.delete(conv)
    db.commit()
    return {"status": "DELETED", "conversation_id": conv_id}

@router.post("/{conv_id}/summarize")
def summarize_conversation(
    conv_id: str,
    db: Session = Depends(get_db),
    payload: dict = Depends(require_permission("ai:chat"))
):
    """
    Generate an executive AI summary of the conversation for compact memory injection.
    """
    username = payload.get("sub", "operator")
    user = _get_user_by_username(db, username)

    conv = db.query(Conversation).filter(
        Conversation.conversation_id == conv_id,
        Conversation.user_id == user.id
    ).first()

    if not conv:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Conversation '{conv_id}' not found."
        )

    messages = db.query(Message).filter(Message.conversation_id == conv.id).order_by(Message.created_at.asc()).all()
    if not messages:
        return {"conversation_id": conv_id, "summary": "No messages to summarize."}

    dialogue_lines = [f"{m.role.upper()}: {m.content}" for m in messages[-10:]]
    prompt = (
        "Summarize the following industrial conversation concisely, noting the machine status, "
        "identified issues, and recommended actions:\n\n" + "\n".join(dialogue_lines)
    )

    summary_res = model_gateway.generate(prompt=prompt, user=username, task_type="REASONING")
    summary_text = summary_res.get("text", "").strip()

    conv.summary = summary_text
    conv.updated_at = datetime.now(timezone.utc)
    db.commit()

    return {"conversation_id": conv_id, "summary": summary_text}
