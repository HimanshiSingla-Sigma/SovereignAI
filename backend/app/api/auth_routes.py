from datetime import timedelta, datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import verify_password, create_access_token
from app.core.mfa import generate_totp_secret, get_totp_uri, generate_qr_code_data_uri, verify_totp_code
from app.core.rbac import get_current_user_payload, get_mfa_flow_payload, ROLE_PERMISSIONS_MATRIX
from app.core.audit import AuditLogger
from app.core.config import settings
from app.models.all_models import User, MFACredential
from app.schemas.schemas import LoginRequest, LoginResponse, MFASetupResponse, MFAVerifyRequest, TokenResponse

router = APIRouter(prefix="/auth", tags=["Authentication & MFA"])

@router.post("/login", response_model=LoginResponse)
def login(req: LoginRequest, request: Request, db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=req.username).first()
    ip = request.client.host if request.client else "127.0.0.1"

    if not user or not verify_password(req.password, user.hashed_password):
        AuditLogger.log(
            who=req.username,
            what="LOGIN_ATTEMPT",
            resource="AuthService",
            result="FAILURE",
            reason="Invalid credentials",
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password."
        )

    if not user.is_active:
        AuditLogger.log(
            who=req.username,
            what="LOGIN_ATTEMPT",
            resource="AuthService",
            result="DENIED",
            reason="Account deactivated by Administrator",
            ip_address=ip
        )
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account has been disabled by Administrator."
        )

    # Primary user role
    role_name = user.roles[0].name if user.roles else "OPERATOR"

    # Check MFA Requirement
    if user.mfa_enabled:
        # Check if MFA credential exists and is verified
        mfa_cred = db.query(MFACredential).filter_by(user_id=user.id).first()
        if not mfa_cred or not mfa_cred.is_verified:
            # First-time enrollment required
            secret = mfa_cred.secret if mfa_cred else generate_totp_secret()
            if not mfa_cred:
                mfa_cred = MFACredential(user_id=user.id, secret=secret, is_verified=False)
                db.add(mfa_cred)
                db.commit()

            temp_token = create_access_token(
                data={"sub": user.username, "user_id": user.id, "mfa_required": True, "mfa_verified": False, "role": role_name},
                expires_delta=timedelta(minutes=10)
            )
            return LoginResponse(
                mfa_required=True,
                mfa_setup_required=True,
                temp_token=temp_token,
                username=user.username,
                role=role_name
            )

        # Standard MFA challenge
        temp_token = create_access_token(
            data={"sub": user.username, "user_id": user.id, "mfa_required": True, "mfa_verified": False, "role": role_name},
            expires_delta=timedelta(minutes=10)
        )
        return LoginResponse(
            mfa_required=True,
            mfa_setup_required=False,
            temp_token=temp_token,
            username=user.username,
            role=role_name
        )

    # If MFA is not enabled on account
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id, "role": role_name, "mfa_required": False, "mfa_verified": True}
    )
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    AuditLogger.log(
        who=user.username,
        what="LOGIN_SUCCESS",
        resource="AuthService",
        result="SUCCESS",
        ip_address=ip
    )
    return LoginResponse(
        access_token=access_token,
        username=user.username,
        role=role_name
    )

@router.get("/mfa-setup", response_model=MFASetupResponse)
def get_mfa_setup(payload: dict = Depends(get_mfa_flow_payload), db: Session = Depends(get_db)):
    username = payload["sub"]
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    mfa_cred = db.query(MFACredential).filter_by(user_id=user.id).first()
    if not mfa_cred:
        secret = generate_totp_secret()
        mfa_cred = MFACredential(user_id=user.id, secret=secret, is_verified=False)
        db.add(mfa_cred)
        db.commit()
    else:
        secret = mfa_cred.secret

    uri = get_totp_uri(secret, username)
    qr_data = generate_qr_code_data_uri(uri)

    return MFASetupResponse(
        secret=secret,
        qr_code_data_uri=qr_data,
        manual_entry_key=secret
    )

@router.get("/current-totp")
def get_current_totp(payload: dict = Depends(get_mfa_flow_payload), db: Session = Depends(get_db)):
    """Helper for offline sovereign environments to inspect the active TOTP code in development mode."""
    if not settings.DEV_MFA_AUTOFILL_ENABLED:
        raise HTTPException(
            status_code=403,
            detail="Dev MFA auto-fill is disabled in production mode. Please use your physical authenticator device."
        )
    import pyotp
    username = payload["sub"]
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    mfa_cred = db.query(MFACredential).filter_by(user_id=user.id).first()
    if not mfa_cred:
        raise HTTPException(status_code=400, detail="MFA credentials not configured")
    totp = pyotp.TOTP(mfa_cred.secret)
    return {
        "code": totp.now(),
        "secret": mfa_cred.secret,
        "username": username
    }

@router.post("/mfa-verify", response_model=TokenResponse)
def verify_mfa(req: MFAVerifyRequest, request: Request, payload: dict = Depends(get_mfa_flow_payload), db: Session = Depends(get_db)):
    username = payload["sub"]
    user = db.query(User).filter_by(username=username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    mfa_cred = db.query(MFACredential).filter_by(user_id=user.id).first()
    if not mfa_cred:
        raise HTTPException(status_code=400, detail="MFA credentials have not been configured for this account.")

    is_valid, error_msg = verify_totp_code(mfa_cred.secret, req.code, username)
    ip = request.client.host if request.client else "127.0.0.1"

    if not is_valid:
        AuditLogger.log(
            who=username,
            what="MFA_VERIFICATION",
            resource="MFAService",
            result="FAILURE",
            reason=error_msg or "Invalid code",
            ip_address=ip
        )
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail=error_msg or "Invalid TOTP code.")

    # Mark credential verified
    mfa_cred.is_verified = True
    mfa_cred.verified_at = datetime.now(timezone.utc)
    user.last_login = datetime.now(timezone.utc)
    db.commit()

    role_name = user.roles[0].name if user.roles else "OPERATOR"
    perms = list(ROLE_PERMISSIONS_MATRIX.get(role_name, []))

    # Issue full authenticated session access token
    full_token = create_access_token(
        data={
            "sub": username,
            "user_id": user.id,
            "role": role_name,
            "permissions": perms,
            "mfa_required": True,
            "mfa_verified": True
        }
    )

    AuditLogger.log(
        who=username,
        what="MFA_VERIFICATION",
        resource="MFAService",
        result="SUCCESS",
        ip_address=ip
    )

    return TokenResponse(
        access_token=full_token,
        username=username,
        role=role_name,
        permissions=perms
    )

@router.get("/me")
def get_me(payload: dict = Depends(get_current_user_payload), db: Session = Depends(get_db)):
    user = db.query(User).filter_by(username=payload["sub"]).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    role_name = user.roles[0].name if user.roles else "OPERATOR"
    perms = list(ROLE_PERMISSIONS_MATRIX.get(role_name, []))

    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "full_name": user.full_name,
        "role": role_name,
        "permissions": perms,
        "is_active": user.is_active,
        "mfa_enabled": user.mfa_enabled
    }
