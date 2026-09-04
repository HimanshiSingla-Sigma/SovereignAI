from typing import List, Optional
from fastapi import APIRouter, Depends, Query
from app.core.rbac import require_permission
from app.core.audit import AuditLogger
from app.schemas.schemas import AuditLogResponse

router = APIRouter(prefix="/audit", tags=["Audit Trail"])

@router.get("/logs", response_model=List[AuditLogResponse])
def get_audit_logs(
    limit: int = Query(100, ge=1, le=500),
    who: Optional[str] = None,
    result: Optional[str] = None,
    payload: dict = Depends(require_permission("audit:read"))
):
    logs = AuditLogger.get_recent_logs(limit=limit, filter_who=who, filter_result=result)
    return [
        AuditLogResponse(
            timestamp=l["timestamp"],
            who=l["who"],
            what=l["what"],
            resource=l["resource"],
            result=l["result"],
            reason=l["reason"],
            checksum=l["checksum"]
        ) for l in logs
    ]

@router.get("/verify")
def verify_audit_integrity(payload: dict = Depends(require_permission("audit:read"))):
    return AuditLogger.verify_integrity()
