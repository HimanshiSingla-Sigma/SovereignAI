from fastapi import APIRouter, Depends
from app.core.rbac import require_permission
from app.core.audit import AuditLogger

router = APIRouter(prefix="/security", tags=["Security & Governance"])

@router.get("/stats")
def get_security_dashboard_stats(payload: dict = Depends(require_permission("security:configure"))):
    logs = AuditLogger.get_recent_logs(limit=200)
    
    blocked_injections = len([l for l in logs if l.get("what") == "AI_PROMPT_BLOCKED"])
    failed_logins = len([l for l in logs if l.get("what") == "LOGIN_ATTEMPT" and l.get("result") == "FAILURE"])
    mfa_failures = len([l for l in logs if l.get("what") == "MFA_VERIFICATION" and l.get("result") == "FAILURE"])
    actuator_denials = len([l for l in logs if l.get("what") == "ACTUATOR_COMMAND_DENIED"])
    total_audits = len(logs)

    return {
        "blocked_prompt_injections": blocked_injections,
        "failed_login_attempts": failed_logins,
        "mfa_challenge_failures": mfa_failures,
        "unauthorized_actuator_denials": actuator_denials,
        "total_audit_records_analyzed": total_audits,
        "firewall_mode": "AIR_GAPPED_STRICT",
        "system_integrity": "INTACT"
    }

@router.post("/test-prompt")
def test_prompt_injection(body: dict, payload: dict = Depends(require_permission("security:configure"))):
    from app.ai.prompt_guard import PromptGuard
    prompt = body.get("prompt", "")
    res = PromptGuard.inspect_prompt(prompt)
    if res["decision"] == "BLOCK":
        AuditLogger.log(
            who=payload["sub"],
            what="AI_PROMPT_BLOCKED",
            resource="SecurityTestingSandbox",
            result="BLOCKED",
            reason="; ".join(res["reasons"]),
            details={"test_prompt": prompt[:120]}
        )
    return res

@router.post("/test-sandbox")
def test_python_sandbox(body: dict, payload: dict = Depends(require_permission("security:configure"))):
    from app.agents.sandbox import PythonSandbox
    code = body.get("code", "")
    res = PythonSandbox.execute_code(code)
    return res

@router.get("/gateway-status")
def get_gateway_status(payload: dict = Depends(require_permission("security:configure"))):
    import os
    from app.hardware.profile import HardwareProfile
    from app.core.config import settings
    profile = HardwareProfile().get_summary()
    models_dir = settings.LOCAL_MODEL_PATH
    gguf_files = []
    if os.path.exists(models_dir):
        gguf_files = [f for f in os.listdir(models_dir) if f.endswith(".gguf")]
    
    active_engine = f"GGUF Local Model ({gguf_files[0]})" if gguf_files else "Native Sovereign Industrial Neural Reasoner (Zero-Cloud CPU)"
    return {
        "active_engine": active_engine,
        "local_models_detected": gguf_files,
        "hardware_tier": profile["hardware_tier"],
        "cpu_model": profile["cpu_model"],
        "max_ram_budget_gb": settings.MAX_RAM_ALLOCATION_GB,
        "prompt_guard_active": settings.PROMPT_GUARD_ENABLED,
        "output_guard_active": settings.OUTPUT_GUARD_ENABLED
    }

