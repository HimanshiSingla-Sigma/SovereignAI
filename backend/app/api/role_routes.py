from typing import List, Dict
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.rbac import require_permission, PERMISSIONS, ROLE_PERMISSIONS_MATRIX, ALL_ROLES

router = APIRouter(prefix="/roles", tags=["Role & Permission Governance"])

@router.get("")
def get_roles_and_permissions(payload: dict = Depends(require_permission("users:read"))):
    result = []
    for role in ALL_ROLES:
        perms = list(ROLE_PERMISSIONS_MATRIX.get(role, []))
        result.append({
            "name": role,
            "description": f"Sovereign {role} Role",
            "permissions": perms
        })
    return result

@router.get("/permissions")
def list_all_permissions(payload: dict = Depends(require_permission("users:read"))):
    return [{"code": k, "description": v, "category": k.split(":")[0]} for k, v in PERMISSIONS.items()]
