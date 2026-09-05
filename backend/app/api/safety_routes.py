from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.rbac import require_permission
from app.safety.safety_engine import DeterministicSafetyEngine
from app.safety.actuator import SimulatedActuatorLayer
from app.safety.approval import ApprovalService
from app.core.audit import AuditLogger
from app.schemas.schemas import SafetyStatusResponse, EmergencyShutdownRequest

router = APIRouter(prefix="/safety", tags=["Safety & Actuators"])

@router.get("/status", response_model=SafetyStatusResponse)
def get_safety_status(payload: dict = Depends(require_permission("safety:read"))):
    events = DeterministicSafetyEngine.get_events(limit=10)
    pending_appr = len(ApprovalService.get_pending())
    rules = DeterministicSafetyEngine.get_rules()

    # Compute aggregate status
    highest_severity = "NORMAL"
    for e in events:
        sev = e.get("severity", "NORMAL")
        if sev == "EMERGENCY":
            highest_severity = "EMERGENCY"
            break
        elif sev == "CRITICAL" and highest_severity != "EMERGENCY":
            highest_severity = "CRITICAL"
        elif sev == "WARNING" and highest_severity not in ["CRITICAL", "EMERGENCY"]:
            highest_severity = "WARNING"

    return SafetyStatusResponse(
        system_safety_state=highest_severity,
        active_interlocks=len([e for e in events if e.get("severity") in ["CRITICAL", "EMERGENCY"]]),
        critical_alerts=len([e for e in events if e.get("severity") == "CRITICAL"]),
        pending_approvals=pending_appr,
        safety_rules_count=len(rules)
    )

@router.get("/rules")
def get_safety_rules(payload: dict = Depends(require_permission("safety:read"))):
    return DeterministicSafetyEngine.get_rules()

@router.get("/events")
def get_safety_events(limit: int = 30, payload: dict = Depends(require_permission("safety:read"))):
    return DeterministicSafetyEngine.get_events(limit=limit)

@router.post("/emergency-shutdown")
def trigger_emergency_shutdown(
    req: EmergencyShutdownRequest,
    payload: dict = Depends(require_permission("safety:shutdown"))
):
    user = payload["sub"]
    role = payload.get("role", "OPERATOR")

    # If user is Safety Officer or Admin, they have authority to trip immediately
    if role in ["SAFETY_OFFICER", "ADMINISTRATOR"]:
        try:
            result = SimulatedActuatorLayer.execute_command(
                actuator_id="ESD-RELAY-01",
                machine_id=req.machine_id,
                command="EMERGENCY_SHUTDOWN",
                issued_by=f"{user} ({role})",
                issued_by_role=role
            )
        except PermissionError as e:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(e))
        except ValueError as e:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))
        return {
            "status": "EXECUTED",
            "message": f"Emergency Shutdown executed directly by {role}.",
            "actuator_result": result
        }
    else:
        # Operator or Engineer request creates a Human-in-the-Loop approval request
        approval_req = ApprovalService.create_request(
            action_type="EMERGENCY_SHUTDOWN",
            target_resource=req.machine_id,
            requested_by=user,
            justification=req.justification,
            required_role="SAFETY_OFFICER"
        )
        return {
            "status": "APPROVAL_REQUIRED",
            "message": "Emergency Shutdown command queued. Pending review and authorization by Safety Officer.",
            "approval_request": approval_req
        }
