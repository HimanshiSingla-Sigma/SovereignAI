from typing import Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from app.core.rbac import require_permission
from app.digital_twin.assets import AssetRegistry
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.core.audit import AuditLogger
from app.schemas.schemas import TelemetrySimulateRequest

router = APIRouter(prefix="/telemetry", tags=["Telemetry Simulation"])

@router.post("/simulate")
def step_telemetry(req: Dict[str, Any], payload: dict = Depends(require_permission("telemetry:read"))):
    machine_id = req.get("machine_id", "Machine-001")
    record = TelemetrySimulator.step(machine_id)
    return record

@router.post("/inject-scenario")
def inject_scenario(req: TelemetrySimulateRequest, payload: dict = Depends(require_permission("telemetry:simulate"))):
    asset = AssetRegistry.get_by_id(req.machine_id)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Machine '{req.machine_id}' not found.")

    valid_profiles = ["NORMAL", "WARNING", "CRITICAL", "FAILURE", "SENSOR_ANOMALY", "STRESS"]
    if req.profile not in valid_profiles:
        raise HTTPException(status_code=400, detail=f"Invalid simulation profile '{req.profile}'. Valid options: {valid_profiles}")

    AssetRegistry.update_asset(req.machine_id, {"simulation_profile": req.profile})
    
    # Step telemetry immediately under new profile
    new_point = TelemetrySimulator.step(req.machine_id)

    AuditLogger.log(
        who=payload["sub"],
        what="TELEMETRY_PROFILE_INJECTED",
        resource=req.machine_id,
        result="SUCCESS",
        reason=f"Simulation profile switched to {req.profile}",
        details={"profile": req.profile}
    )

    return {
        "machine_id": req.machine_id,
        "active_profile": req.profile,
        "latest_telemetry": new_point
    }
