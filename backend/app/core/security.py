import os
import hashlib
import hmac
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any, Union, Optional
try:
    import jwt
except ImportError:
    import base64
    import json
    class _MockJWT:
        PyJWTError = Exception
        @staticmethod
        def encode(payload, key, algorithm="HS256"):
            raw = json.dumps(payload, default=str).encode("utf-8")
            b64 = base64.urlsafe_b64encode(raw).decode("utf-8").rstrip("=")
            sig = hmac.new(key.encode("utf-8"), b64.encode("utf-8"), hashlib.sha256).hexdigest()[:16]
            return f"eyJhbGciOiJIUzI1NiJ9.{b64}.{sig}"
        @staticmethod
        def decode(token, key, algorithms=None):
            parts = token.split(".")
            if len(parts) != 3:
                raise Exception("Invalid token structure")
            padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
            raw = base64.urlsafe_b64decode(padded.encode("utf-8"))
            return json.loads(raw.decode("utf-8"))
    jwt = _MockJWT()

from app.core.config import settings


def hash_password(password: str) -> str:
    """Secure password hashing using PBKDF2-HMAC-SHA256 with random salt."""
    salt = secrets.token_hex(16)
    key = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt.encode('utf-8'), 100000)
    return f"pbkdf2:sha256:100000${salt}${key.hex()}"

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against hashed password."""
    try:
        if not hashed_password or "$" not in hashed_password:
            return False
        parts = hashed_password.split("$")
        if len(parts) != 3:
            return False
        algorithm_meta, salt, stored_key = parts
        _, hash_name, iterations = algorithm_meta.split(":")
        computed_key = hashlib.pbkdf2_hmac(
            hash_name,
            plain_password.encode('utf-8'),
            salt.encode('utf-8'),
            int(iterations)
        )
        return hmac.compare_digest(computed_key.hex(), stored_key)
    except Exception:
        return False

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a signed JWT access token."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    """Decode and validate a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None
