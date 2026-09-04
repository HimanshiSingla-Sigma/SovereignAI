import uuid
import pyotp
from fastapi.testclient import TestClient

def test_full_section_48_end_to_end_journey(client: TestClient, admin_headers):
    """
    Complete end-to-end user scenario defined in Section 48 of the specification:
    1. Admin creates Engineer
    2. Engineer logs in
    3. Engineer completes MFA
    4. Engineer selects Machine-002
    5. Telemetry is generated & Anomaly detected
    6. Engineer asks AI about issue (Agentic AI)
    7. Agent queries Digital Twin, retrieves RAG evidence, queries GraphRAG
    8. Root cause generated & Maintenance recommendation generated
    9. What-if simulation executed
    10. Safety engine evaluates scenario
    11. Human approval requested
    12. Safety Officer approves
    13. Simulated actuator updates Twin
    14. Audit trail records everything
    """
    # 1. Admin creates Engineer
    new_eng_username = f"e2e_eng_{uuid.uuid4().hex[:6]}"
    create_res = client.post(
        "/api/users",
        headers=admin_headers,
        json={
            "username": new_eng_username,
            "email": f"{new_eng_username}@sovereign.local",
            "full_name": "E2E Testing Reliability Engineer",
            "password": "SecurePassword@2026!",
            "role": "ENGINEER"
        }
    )
    assert create_res.status_code == 201
    assert "ENGINEER" in create_res.json()["roles"]

    # 2. Engineer logs in
    login_res = client.post("/api/auth/login", json={
        "username": new_eng_username,
        "password": "SecurePassword@2026!"
    })
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert login_data["mfa_required"] is True
    temp_token = login_data["temp_token"]

    # 3. Engineer completes MFA setup and verification
    mfa_setup_res = client.get("/api/auth/mfa-setup", headers={"Authorization": f"Bearer {temp_token}"})
    assert mfa_setup_res.status_code == 200
    mfa_secret = mfa_setup_res.json()["secret"]

    # Generate valid TOTP code
    totp = pyotp.TOTP(mfa_secret)
    verify_res = client.post(
        "/api/auth/mfa-verify",
        headers={"Authorization": f"Bearer {temp_token}"},
        json={"code": totp.now()}
    )
    assert verify_res.status_code == 200
    eng_token = verify_res.json()["access_token"]
    eng_headers = {"Authorization": f"Bearer {eng_token}"}

    # 4. Engineer selects Machine-002
    mach_res = client.get("/api/machines/Machine-002", headers=eng_headers)
    assert mach_res.status_code == 200
    assert mach_res.json()["machine_id"] == "Machine-002"

    # 5. Telemetry is generated & Anomaly detected
    # Inject SENSOR_ANOMALY profile to reproduce bearing degradation
    inj_res = client.post(
        "/api/telemetry/inject-scenario",
        headers=eng_headers,
        json={"machine_id": "Machine-002", "profile": "SENSOR_ANOMALY"}
    )
    assert inj_res.status_code == 200
    assert inj_res.json()["latest_telemetry"]["anomaly_score"] > 50.0

    # 6 & 7 & 8: Engineer asks AI about issue -> Agentic AI execution
    agent_res = client.post(
        "/api/ai/agent/execute",
        headers=eng_headers,
        json={
            "message": "Analyze Machine-002 and prepare a maintenance report.",
            "machine_id": "Machine-002"
        }
    )
    assert agent_res.status_code == 200
    agent_data = agent_res.json()
    assert len(agent_data["agent_steps"]) >= 5
    assert len(agent_data["knowledge_facts"]) > 0
    assert any(name in agent_data["model_used"] for name in ["Sovereign", "SmolLM2", "Qwen", "Llama", "CPU", "GGUF"])
    # Check that answer contains root cause and maintenance recommendation
    assert "Machine-002" in agent_data["response"]
    assert "SOP-MNT-042" in agent_data["response"]

    # 9. What-If simulation executed
    whatif_res = client.post(
        "/api/simulation/what-if",
        headers=eng_headers,
        json={
            "machine_id": "Machine-002",
            "temp_delta": 25.0,
            "vibration_delta": 1.5
        }
    )
    assert whatif_res.status_code == 200
    whatif_data = whatif_res.json()
    assert whatif_data["predicted_safety_state"] in ["CRITICAL", "EMERGENCY"]
    assert whatif_data["predicted_health_score"] < 60.0

    # 10. Safety engine evaluates scenario
    rules_res = client.get("/api/safety/rules", headers=eng_headers)
    assert rules_res.status_code == 200

    # 11. Request human approval for preventive speed throttle
    appr_create_res = client.post(
        "/api/safety/emergency-shutdown",
        headers=eng_headers,
        json={
            "machine_id": "Machine-002",
            "justification": "Elevated vibration anomaly. Requesting controlled shutdown for bearing inspection."
        }
    )
    assert appr_create_res.status_code == 200
    appr_id = appr_create_res.json()["approval_request"]["request_id"]

    # 12. Safety Officer approves
    # Safety Officer token
    from app.core.security import create_access_token
    from app.core.rbac import ROLE_SAFETY_OFFICER, ROLE_PERMISSIONS_MATRIX
    safety_token = create_access_token({
        "sub": "safety1",
        "user_id": 3,
        "role": ROLE_SAFETY_OFFICER,
        "permissions": list(ROLE_PERMISSIONS_MATRIX[ROLE_SAFETY_OFFICER]),
        "mfa_required": True,
        "mfa_verified": True
    })
    safety_hdrs = {"Authorization": f"Bearer {safety_token}"}

    decide_res = client.post(
        f"/api/approvals/{appr_id}/decide",
        headers=safety_hdrs,
        json={
            "decision": "APPROVED",
            "reason": "Approved controlled shutdown per SOP-MNT-042."
        }
    )
    assert decide_res.status_code == 200
    assert decide_res.json()["approval"]["status"] == "APPROVED"

    # 13. Simulated actuator updates Twin state = SHUTDOWN
    twin_check = client.get("/api/machines/Machine-002", headers=eng_headers)
    assert twin_check.status_code == 200
    assert twin_check.json()["status"] == "SHUTDOWN"

    # 14. Audit trail records everything
    audit_res = client.get("/api/audit/logs?limit=50", headers=admin_headers)
    assert audit_res.status_code == 200
    logs = audit_res.json()
    actions = [l["what"] for l in logs]
    assert "USER_CREATED" in actions
    assert "MFA_VERIFICATION" in actions
    assert "APPROVAL_REQUEST_CREATED" in actions
    assert "APPROVAL_APPROVED" in actions
    assert "ACTUATOR_EMERGENCY_SHUTDOWN" in actions

    # Verify cryptographic integrity of audit trail
    integ_res = client.get("/api/audit/verify", headers=admin_headers)
    assert integ_res.status_code == 200
    assert integ_res.json()["status"] == "SECURE"
    assert integ_res.json()["corrupted_records"] == 0
