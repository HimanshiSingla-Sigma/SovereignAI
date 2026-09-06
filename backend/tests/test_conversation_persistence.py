import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.security import create_access_token
from app.core.database import SessionLocal
from app.models.all_models import Conversation, Message, User

client = TestClient(app)

def get_auth_header(username: str = "operator", role: str = "OPERATOR"):
    token = create_access_token({"sub": username, "role": role})
    return {"Authorization": f"Bearer {token}"}

def test_conversation_crud_and_user_isolation():
    # 1. Create conversation for operator
    headers_op = get_auth_header("operator", "OPERATOR")
    res = client.post(
        "/api/conversations",
        json={"title": "Spindle Vibration Inspection", "machine_context": "Machine-002"},
        headers=headers_op
    )
    assert res.status_code == 201
    data = res.json()
    conv_id = data["conversation_id"]
    assert conv_id.startswith("CONV-")
    assert data["title"] == "Spindle Vibration Inspection"
    assert data["machine_context"] == "Machine-002"

    # 2. List conversations for operator
    res_list = client.get("/api/conversations", headers=headers_op)
    assert res_list.status_code == 200
    conv_ids = [c["conversation_id"] for c in res_list.json()]
    assert conv_id in conv_ids

    # 3. Verify user isolation: another user cannot view operator's conversation
    headers_other = get_auth_header("engineer", "ENGINEER")
    res_unauth = client.get(f"/api/conversations/{conv_id}", headers=headers_other)
    assert res_unauth.status_code == 404

    # 4. Operator can view their conversation
    res_auth = client.get(f"/api/conversations/{conv_id}", headers=headers_op)
    assert res_auth.status_code == 200
    assert res_auth.json()["conversation_id"] == conv_id

def test_multi_turn_chat_with_persistent_history():
    headers = get_auth_header("operator", "OPERATOR")
    
    # 1. Create a conversation
    create_res = client.post(
        "/api/conversations",
        json={"title": "Multi-turn Diagnostics", "machine_context": "Machine-002"},
        headers=headers
    )
    assert create_res.status_code == 201
    conv_id = create_res.json()["conversation_id"]

    # 2. Turn 1: Ask about Machine-002 telemetry
    chat1 = client.post(
        "/api/ai/chat",
        json={
            "message": "What is the live telemetry status for Machine-002?",
            "conversation_id": conv_id,
            "machine_id": "Machine-002"
        },
        headers=headers
    )
    assert chat1.status_code == 200
    res1_data = chat1.json()
    assert res1_data["conversation_id"] == conv_id
    assert len(res1_data["response"]) > 0

    # 3. Turn 2: Follow up question in same session
    chat2 = client.post(
        "/api/ai/chat",
        json={
            "message": "Is the vibration within normal limits?",
            "conversation_id": conv_id,
            "machine_id": "Machine-002"
        },
        headers=headers
    )
    assert chat2.status_code == 200
    res2_data = chat2.json()
    assert res2_data["conversation_id"] == conv_id

    # 4. Verify database persistence: Check both user & assistant messages
    detail = client.get(f"/api/conversations/{conv_id}", headers=headers)
    assert detail.status_code == 200
    msgs = detail.json()["messages"]
    assert len(msgs) >= 4  # 2 user messages + 2 assistant messages
    roles = [m["role"] for m in msgs]
    assert "user" in roles
    assert "assistant" in roles

def test_backend_restart_persistence_simulation():
    headers = get_auth_header("operator", "OPERATOR")

    # Create conversation and add message
    conv_res = client.post(
        "/api/conversations",
        json={"title": "Restart Survival Test", "machine_context": "Machine-001"},
        headers=headers
    )
    conv_id = conv_res.json()["conversation_id"]

    client.post(
        "/api/ai/chat",
        json={"message": "Analyze Machine-001 health", "conversation_id": conv_id},
        headers=headers
    )

    # Simulate backend restart: Query directly via fresh DB session
    db = SessionLocal()
    try:
        db_conv = db.query(Conversation).filter(Conversation.conversation_id == conv_id).first()
        assert db_conv is not None
        assert db_conv.title == "Restart Survival Test"
        assert len(db_conv.messages) >= 2
        for m in db_conv.messages:
            assert m.content is not None
            assert len(m.content) > 0
    finally:
        db.close()
