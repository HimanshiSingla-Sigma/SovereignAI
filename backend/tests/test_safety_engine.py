from fastapi.testclient import TestClient

def test_deterministic_safety_rules_evaluation(client: TestClient, safety_headers):
    res = client.get("/api/safety/rules", headers=safety_headers)
    assert res.status_code == 200
    rules = res.json()
    assert len(rules) >= 5
    rule_ids = [r["rule_id"] for r in rules]
    assert "SR-TEMP-02" in rule_ids
    assert "SR-VIB-02" in rule_ids

def test_human_in_the_loop_approval_workflow(client: TestClient, operator_headers, safety_headers):
    # Step 1: Operator requests Emergency Shutdown (does not have direct approval permissions)
    req_res = client.post(
        "/api/safety/emergency-shutdown",
        headers=operator_headers,
        json={
            "machine_id": "Machine-003",
            "justification": "Excessive smoke observed near welding torch assembly."
        }
    )
    assert req_res.status_code == 200
    req_data = req_res.json()
    assert req_data["status"] == "APPROVAL_REQUIRED"
    assert "approval_request" in req_data
    appr_id = req_data["approval_request"]["request_id"]

    # Step 2: Safety Officer views approval queue
    list_res = client.get("/api/approvals", headers=safety_headers)
    assert list_res.status_code == 200
    pending = [a for a in list_res.json() if a["request_id"] == appr_id]
    assert len(pending) == 1
    assert pending[0]["status"] == "PENDING"

    # Step 3: Safety Officer authorizes the Emergency Shutdown
    decide_res = client.post(
        f"/api/approvals/{appr_id}/decide",
        headers=safety_headers,
        json={
            "decision": "APPROVED",
            "reason": "Verified smoke alarm on camera feed. Authorized full workcell shutdown."
        }
    )
    assert decide_res.status_code == 200
    decide_data = decide_res.json()
    assert decide_data["approval"]["status"] == "APPROVED"
    assert decide_data["actuator_result"]["status"] == "EXECUTED"

    # Step 4: Verify Machine-003 is now in SHUTDOWN state
    mach_res = client.get("/api/machines/Machine-003", headers=safety_headers)
    assert mach_res.status_code == 200
    assert mach_res.json()["status"] == "SHUTDOWN"
    assert mach_res.json()["rpm"] == 0.0
