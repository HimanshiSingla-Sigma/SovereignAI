import io
import base64
import time
from typing import Dict, Tuple, Optional
import pyotp
import qrcode
from app.core.config import settings

# In-memory tracking for failed MFA attempts: {username: {"attempts": int, "locked_until": float}}
_failed_mfa_attempts: Dict[str, Dict[str, float]] = {}

def generate_totp_secret() -> str:
    """Generate a new Base32 TOTP secret."""
    return pyotp.random_base32()

def get_totp_uri(secret: str, username: str) -> str:
    """Generate the otpauth:// URI for authenticator apps."""
    totp = pyotp.TOTP(secret)
    return totp.provisioning_uri(name=username, issuer_name=settings.MFA_ISSUER)

def generate_qr_code_data_uri(totp_uri: str) -> str:
    """Generate a Base64-encoded PNG data URI for the QR code."""
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_L,
        box_size=8,
        border=3,
    )
    qr.add_data(totp_uri)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    b64_img = base64.b64encode(buffer.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64_img}"

def check_mfa_rate_limit(username: str) -> Tuple[bool, Optional[str]]:
    """Check if the user is temporarily locked out due to excessive failed attempts."""
    now = time.time()
    record = _failed_mfa_attempts.get(username)
    if not record:
        return True, None
    
    locked_until = record.get("locked_until", 0)
    if now < locked_until:
        remaining_sec = int(locked_until - now)
        return False, f"Account temporarily locked due to excessive MFA failures. Try again in {remaining_sec} seconds."
    return True, None

def record_mfa_failure(username: str) -> int:
    """Record a failed MFA attempt and apply lockout if threshold exceeded."""
    now = time.time()
    if username not in _failed_mfa_attempts:
        _failed_mfa_attempts[username] = {"attempts": 1, "locked_until": 0}
    else:
        _failed_mfa_attempts[username]["attempts"] += 1
    
    attempts = _failed_mfa_attempts[username]["attempts"]
    if attempts >= settings.MAX_FAILED_LOGIN_ATTEMPTS:
        _failed_mfa_attempts[username]["locked_until"] = now + (settings.LOCKOUT_DURATION_MINUTES * 60)
        _failed_mfa_attempts[username]["attempts"] = 0
    return attempts

def reset_mfa_failures(username: str):
    """Clear failed attempts upon successful MFA verification."""
    if username in _failed_mfa_attempts:
        del _failed_mfa_attempts[username]

def verify_totp_code(secret: str, code: str, username: str) -> Tuple[bool, Optional[str]]:
    """Verify a 6-digit TOTP code with rate-limit checks."""
    allowed, lock_reason = check_mfa_rate_limit(username)
    if not allowed:
        return False, lock_reason
    
    clean_code = str(code).strip().replace(" ", "")
    if len(clean_code) != 6 or not clean_code.isdigit():
        record_mfa_failure(username)
        return False, "Invalid code format. Please provide a 6-digit number."
    
    totp = pyotp.TOTP(secret)
    # valid_window=1 allows +-30 seconds clock drift
    is_valid = totp.verify(clean_code, valid_window=1)
    if is_valid:
        reset_mfa_failures(username)
        return True, None
    else:
        attempts = record_mfa_failure(username)
        remaining = settings.MAX_FAILED_LOGIN_ATTEMPTS - attempts
        if remaining > 0:
            return False, f"Invalid TOTP code. {remaining} attempt(s) remaining before temporary lockout."
        else:
            return False, f"Account locked for {settings.LOCKOUT_DURATION_MINUTES} minutes due to repeated failed attempts."
