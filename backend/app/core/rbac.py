from typing import List, Dict, Set

try:
    from fastapi import Depends, HTTPException, status, Header
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
except ImportError:
    Depends = lambda x: x
    class HTTPException(Exception):
        def __init__(self, status_code: int = 400, detail: str = ""):
            super().__init__(detail)
            self.status_code = status_code
            self.detail = detail
    class _Status:
        HTTP_401_UNAUTHORIZED = 401
        HTTP_403_FORBIDDEN = 403
    status = _Status()
    Header = lambda *args, **kwargs: None
    class HTTPBearer:
        def __init__(self, *args, **kwargs): pass
        def __call__(self, *args, **kwargs): return None
    class HTTPAuthorizationCredentials:
        credentials = ""

from app.core.security import decode_token


# Role Names
ROLE_ADMINISTRATOR = "ADMINISTRATOR"
ROLE_ENGINEER = "ENGINEER"
ROLE_SAFETY_OFFICER = "SAFETY_OFFICER"
ROLE_OPERATOR = "OPERATOR"

ALL_ROLES = [ROLE_ADMINISTRATOR, ROLE_ENGINEER, ROLE_SAFETY_OFFICER, ROLE_OPERATOR]

# Defined Granular Permissions
PERMISSIONS: Dict[str, str] = {
    # User and Access Management
    "users:create": "Create new user accounts (Admin only)",
    "users:read": "View user accounts",
    "users:disable": "Deactivate user accounts",
    "users:activate": "Activate user accounts",
    "roles:assign": "Assign or change user roles",
    "roles:update": "Modify role permissions",
    "permissions:manage": "Configure granular permissions",
    
    # Security and Governance
    "security:configure": "Configure platform security, model settings, and prompts",
    "audit:read": "View immutable system audit logs",
    "mfa:manage": "Reset or reconfigure MFA credentials",
    
    # Digital Twin and Telemetry
    "machines:read": "View machines, components, and telemetry",
    "machines:update": "Modify machine metadata or state",
    "telemetry:read": "View live and historical telemetry",
    "telemetry:simulate": "Inject simulation profiles and faults",
    
    # Safety and Actuators
    "safety:read": "View safety rules, interlocks, and safety events",
    "safety:approve": "Approve sensitive actuator or safety actions",
    "safety:shutdown": "Trigger emergency shutdown",
    
    # Documents, RAG, and Knowledge Graph
    "documents:read": "View indexed manuals and SOP documents",
    "documents:upload": "Upload and index new industrial documents",
    "rag:query": "Perform private semantic search and RAG queries",
    "graphrag:query": "Explore and query the knowledge graph",
    
    # Simulation & AI
    "simulation:run": "Execute what-if simulations",
    "ai:chat": "Interact with Sovereign AI Assistant",
    "agent:execute": "Execute autonomous multi-step agent plans"
}

# Role to Permissions Mapping Matrix
ROLE_PERMISSIONS_MATRIX: Dict[str, Set[str]] = {
    ROLE_ADMINISTRATOR: set(PERMISSIONS.keys()),  # All permissions
    
    ROLE_ENGINEER: {
        "users:read",
        "machines:read",
        "machines:update",
        "telemetry:read",
        "telemetry:simulate",
        "safety:read",
        "safety:shutdown",
        "documents:read",
        "documents:upload",
        "rag:query",
        "graphrag:query",
        "simulation:run",
        "ai:chat",
        "agent:execute"
    },
    
    ROLE_SAFETY_OFFICER: {
        "users:read",
        "machines:read",
        "telemetry:read",
        "safety:read",
        "safety:approve",
        "safety:shutdown",
        "audit:read",
        "documents:read",
        "rag:query",
        "graphrag:query",
        "ai:chat"
    },
    
    ROLE_OPERATOR: {
        "machines:read",
        "telemetry:read",
        "safety:read",
        "safety:shutdown",
        "documents:read",
        "rag:query",
        "ai:chat"
    }
}

security_bearer = HTTPBearer(auto_error=False)

def get_current_user_payload(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    """Validate bearer JWT token and return decoded payload."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or session expired."
        )
    
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token."
        )
    
    # Check if MFA was completed (unless this token is for MFA flow itself)
    if payload.get("mfa_required", False) and not payload.get("mfa_verified", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="MFA verification is required to access this resource."
        )
    
    return payload

def get_mfa_flow_payload(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)) -> dict:
    """Validate bearer JWT token for MFA setup and verification specifically."""
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or session expired."
        )
    
    payload = decode_token(credentials.credentials)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token."
        )
    return payload

def get_current_user_role(payload: dict = Depends(get_current_user_payload)) -> str:
    """Extract and validate the user role from token payload."""
    role = payload.get("role")
    if not role or role not in ALL_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Assigned role is invalid or revoked."
        )
    return role

def require_permission(required_perm: str):
    """Dependency factory checking if current user possesses the required permission."""
    def permission_checker(payload: dict = Depends(get_current_user_payload)) -> dict:
        role = payload.get("role")
        user_perms = ROLE_PERMISSIONS_MATRIX.get(role, set())
        
        # Check custom explicit permissions in payload if granted
        custom_perms = set(payload.get("permissions", []))
        effective_perms = user_perms.union(custom_perms)
        
        if required_perm not in effective_perms:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access Denied: Missing required permission '{required_perm}' for role '{role}'."
            )
        return payload
    return permission_checker
