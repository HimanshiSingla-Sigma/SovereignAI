from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.rbac import require_permission
from app.safety.approval import ApprovalService
from app.safety.actuator import SimulatedActuatorLayer
from app.schemas.schemas import ApprovalRequestResponse, ApprovalDecisionRequest

router = APIRouter(prefix="/approvals", tags=["Human-in-the-Loop Approvals"])

@router.get("", response_model=List[ApprovalRequestResponse])
def list_approvals(payload: dict = Depends(require_permission("safety:read"))):
    return ApprovalService.get_all()

@router.post("/{request_id}/decide")
def decide_approval(
    request_id: str,
    req: ApprovalDecisionRequest,
    payload: dict = Depends(require_permission("safety:approve"))
):
    user = payload["sub"]
    role = payload.get("role", "SAFETY_OFFICER")

    if req.decision not in ["APPROVED", "REJECTED"]:
        raise HTTPException(status_code=400, detail="Decision must be APPROVED or REJECTED.")

    try:
        updated = ApprovalService.decide(
            request_id=request_id,
            decided_by=f"{user} ({role})",
            decision=req.decision,
            reason=req.reason
        )

        actuator_result = None
        # If approved, execute the corresponding actuator action
        if req.decision == "APPROVED":
            actuator_result = SimulatedActuatorLayer.execute_command(
                actuator_id=f"ACTUATOR-{request_id}",
                machine_id=updated["target_resource"],
                command=updated["action_type"],
                issued_by=f"{user} ({role})",
                approval_id=request_id
            )

        return {
            "approval": updated,
            "actuator_result": actuator_result
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
