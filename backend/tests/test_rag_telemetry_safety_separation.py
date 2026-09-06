import pytest
from app.agents.graph_orchestrator import langgraph_orchestrator

def test_screenshot_query_rag_vs_telemetry_and_no_approval_pause():
    """
    Direct verification of the user's screenshot bug:
    Prompt: 'Evaluate deterministic safety rules against Machine-002 telemetry'
    
    Requirements:
    1. Telemetry/operational status must NEVER be dispatched to RAGAgent.
    2. Informational safety evaluation must NEVER trigger false-positive APPR approval pause.
    3. Final output must contain telemetry baseline and safety evaluation without pauses.
    """
    prompt = "Evaluate deterministic safety rules against Machine-002 telemetry"
    result = langgraph_orchestrator.execute(
        prompt=prompt,
        user="operator",
        user_role="OPERATOR",
        machine_id="Machine-002",
        auto_approve_controlled=False
    )

    # 1. Verification: Execution completed without approval halt
    assert result["status"] == "COMPLETED"
    assert result["requires_human_approval"] is False
    assert result["approval_status"] in ["NONE", "AUTO_APPROVED"]
    assert result["pending_approval"] is None

    # 2. Verification: Tasks correctly routed
    trace = result["execution_trace"]
    agent_types_used = [step["agent_type"] for step in trace]
    
    # TELEMETRY must be invoked for telemetry data
    assert "TELEMETRY" in agent_types_used
    # SAFETY_CONTROL must be invoked for deterministic rules
    assert "SAFETY_CONTROL" in agent_types_used

    # RAG must NOT be called for sensor readings
    for step in trace:
        if step["agent_type"] == "RAG":
            obj_l = step.get("objective", "").lower()
            assert "telemetry data" not in obj_l
            assert "sensor" not in obj_l

    # Check SAFETY_CONTROL task was informational (not emergency shutdown)
    for step in trace:
        if step["agent_type"] == "SAFETY_CONTROL":
            assert step["status"] == "COMPLETED"
            assert "WAITING_APPROVAL" not in step["status"]
            assert "Requires Safety Officer sign-off" not in step.get("output_summary", "")

    # 3. Verification: Final answer includes telemetry & compliance
    final_ans = result["final_answer"]
    assert "Machine-002" in final_ans
    assert ("Vibration" in final_ans or "vibration" in final_ans)
    assert ("Temperature" in final_ans or "temperature" in final_ans)
    assert ("Deterministic" in final_ans or "Safety" in final_ans)

def test_sop_query_routes_to_rag():
    """
    Verify that standard operating procedures / technical manuals route to RAGAgent.
    """
    prompt = "Retrieve SOP-MNT-042 bearing lubrication procedure manual"
    result = langgraph_orchestrator.execute(
        prompt=prompt,
        user="engineer",
        user_role="ENGINEER"
    )
    assert result["status"] == "COMPLETED"
    agent_types = [step["agent_type"] for step in result["execution_trace"]]
    assert "RAG" in agent_types

def test_physical_command_triggers_human_approval_gate():
    """
    Verify that an actual machine control action halts with an APPR ticket.
    """
    prompt = "Emergency shutdown Machine-002 immediately to prevent thermal runaway"
    result = langgraph_orchestrator.execute(
        prompt=prompt,
        user="operator",
        user_role="OPERATOR",
        machine_id="Machine-002",
        auto_approve_controlled=False
    )
    assert result["status"] == "PAUSED_FOR_APPROVAL"
    assert result["requires_human_approval"] is True
    assert result["approval_status"] == "PENDING"
    assert result["pending_approval"] is not None
    assert result["pending_approval"]["request_id"].startswith("APPR-")
