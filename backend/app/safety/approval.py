import uuid
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional
from app.core.audit import AuditLogger

class ApprovalService:
    """
    Human-in-the-Loop (HITL) approval queue for critical industrial operations.
    Enforces review by Safety Officers or Administrators before actuator triggers.
    """
    _requests: Dict[str, Dict[str, Any]] = {}

    @classmethod
    def create_request(
        cls,
        action_type: str,
        target_resource: str,
        requested_by: str,
        justification: str,
        required_role: str = "SAFETY_OFFICER"
    ) -> Dict[str, Any]:
        req_id = f"APPR-{uuid.uuid4().hex[:8].upper()}"
        now = datetime.now(timezone.utc).isoformat()
        target = target_resource or "SYSTEM"

        record = {
            "request_id": req_id,
            "action_type": action_type,
            "target_resource": target,
            "requested_by": requested_by,
            "required_role": required_role,
            "justification": justification,
            "status": "PENDING",  # PENDING, APPROVED, REJECTED
            "decided_by": None,
            "decision_reason": None,
            "decision_timestamp": None,
            "created_at": now
        }
        cls._requests[req_id] = record

        AuditLogger.log(
            who=requested_by,
            what="APPROVAL_REQUEST_CREATED",
            resource=f"{action_type}:{target_resource}",
            result="PENDING",
            reason=justification,
            details={"request_id": req_id, "required_role": required_role}
        )
        return record

    @classmethod
    def get_pending(cls) -> List[Dict[str, Any]]:
        return [r for r in cls._requests.values() if r["status"] == "PENDING"]

    @classmethod
    def get_all(cls) -> List[Dict[str, Any]]:
        return list(cls._requests.values())[::-1]

    @classmethod
    def get_by_id(cls, request_id: str) -> Optional[Dict[str, Any]]:
        return cls._requests.get(request_id)

    @classmethod
    def decide(
        cls,
        request_id: str,
        decided_by: str,
        decision: str,  # APPROVED or REJECTED
        reason: str
    ) -> Dict[str, Any]:
        req = cls._requests.get(request_id)
        if not req:
            raise ValueError(f"Approval request '{request_id}' does not exist.")
        if req["status"] != "PENDING":
            raise ValueError(f"Approval request '{request_id}' has already been decided ({req['status']}).")

        now = datetime.now(timezone.utc).isoformat()
        req["status"] = decision
        req["decided_by"] = decided_by
        req["decision_reason"] = reason
        req["decision_timestamp"] = now

        AuditLogger.log(
            who=decided_by,
            what=f"APPROVAL_{decision}",
            resource=f"{req['action_type']}:{req['target_resource']}",
            result=decision,
            reason=reason,
            details={"request_id": request_id}
        )
        return req
