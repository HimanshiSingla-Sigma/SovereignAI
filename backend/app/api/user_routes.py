from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import hash_password
from app.core.rbac import require_permission, get_current_user_payload
from app.core.audit import AuditLogger
from app.models.all_models import User, Role, MFACredential
from app.schemas.schemas import UserCreate, UserUpdate, UserResponse

router = APIRouter(prefix="/users", tags=["Admin User Management"])

@router.get("", response_model=List[UserResponse])
def list_users(
    payload: dict = Depends(require_permission("users:read")),
    db: Session = Depends(get_db)
):
    users = db.query(User).all()
    results = []
    for u in users:
        results.append(UserResponse(
            id=u.id,
            username=u.username,
            email=u.email,
            full_name=u.full_name,
            is_active=u.is_active,
            is_admin=u.is_admin,
            mfa_enabled=u.mfa_enabled,
            roles=[r.name for r in u.roles],
            created_at=u.created_at,
            last_login=u.last_login
        ))
    return results

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    req: UserCreate,
    payload: dict = Depends(require_permission("users:create")),
    db: Session = Depends(get_db)
):
    # Enforce uniqueness
    if db.query(User).filter((User.username == req.username) | (User.email == req.email)).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"User with username '{req.username}' or email '{req.email}' already exists."
        )

    # Validate target role
    target_role = db.query(Role).filter_by(name=req.role).first()
    if not target_role:
        raise HTTPException(status_code=400, detail=f"Role '{req.role}' is not a valid system role.")

    new_user = User(
        username=req.username,
        email=req.email,
        full_name=req.full_name,
        hashed_password=hash_password(req.password),
        is_active=True,
        is_admin=(req.role == "ADMINISTRATOR"),
        mfa_enabled=True  # MFA strictly required on all created accounts
    )
    new_user.roles.append(target_role)
    db.add(new_user)
    db.commit()
    db.refresh(new_user)

    AuditLogger.log(
        who=payload["sub"],
        what="USER_CREATED",
        resource=f"User:{new_user.username}",
        result="SUCCESS",
        reason=f"Admin assigned role {req.role}",
        details={"user_id": new_user.id, "role": req.role}
    )

    return UserResponse(
        id=new_user.id,
        username=new_user.username,
        email=new_user.email,
        full_name=new_user.full_name,
        is_active=new_user.is_active,
        is_admin=new_user.is_admin,
        mfa_enabled=new_user.mfa_enabled,
        roles=[target_role.name],
        created_at=new_user.created_at,
        last_login=new_user.last_login
    )

@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    req: UserUpdate,
    payload: dict = Depends(require_permission("roles:assign")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail=f"User ID {user_id} not found.")

    if req.full_name is not None:
        user.full_name = req.full_name
    if req.is_active is not None:
        user.is_active = req.is_active
    if req.role is not None:
        target_role = db.query(Role).filter_by(name=req.role).first()
        if not target_role:
            raise HTTPException(status_code=400, detail=f"Role '{req.role}' does not exist.")
        user.roles = [target_role]
        user.is_admin = (req.role == "ADMINISTRATOR")

    db.commit()
    db.refresh(user)

    AuditLogger.log(
        who=payload["sub"],
        what="USER_UPDATED",
        resource=f"User:{user.username}",
        result="SUCCESS",
        reason=f"Updated status: active={user.is_active}, role={req.role}"
    )

    return UserResponse(
        id=user.id,
        username=user.username,
        email=user.email,
        full_name=user.full_name,
        is_active=user.is_active,
        is_admin=user.is_admin,
        mfa_enabled=user.mfa_enabled,
        roles=[r.name for r in user.roles],
        created_at=user.created_at,
        last_login=user.last_login
    )

@router.delete("/{user_id}")
def deactivate_user(
    user_id: int,
    payload: dict = Depends(require_permission("users:disable")),
    db: Session = Depends(get_db)
):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found.")
    if user.username == "admin":
        raise HTTPException(status_code=400, detail="Cannot deactivate the root Administrator account.")

    user.is_active = False
    db.commit()

    AuditLogger.log(
        who=payload["sub"],
        what="USER_DEACTIVATED",
        resource=f"User:{user.username}",
        result="SUCCESS",
        reason="Deactivated by Admin"
    )
    return {"message": f"User '{user.username}' deactivated successfully."}
