from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.rbac import require_permission
from app.digital_twin.assets import AssetRegistry
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.schemas.schemas import MachineResponse, TelemetryPoint

router = APIRouter(prefix="/machines", tags=["Digital Twin"])

@router.get("", response_model=List[MachineResponse])
def get_all_machines(payload: dict = Depends(require_permission("machines:read"))):
    return AssetRegistry.get_all()

@router.get("/{machine_id}", response_model=MachineResponse)
def get_machine_by_id(machine_id: str, payload: dict = Depends(require_permission("machines:read"))):
    asset = AssetRegistry.get_by_id(machine_id)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")
    return asset

@router.get("/{machine_id}/telemetry")
def get_latest_telemetry(machine_id: str, payload: dict = Depends(require_permission("telemetry:read"))):
    history = TelemetrySimulator.get_history(machine_id, limit=1)
    if not history:
        # Step once
        return TelemetrySimulator.step(machine_id)
    return history[-1]

@router.get("/{machine_id}/history")
def get_telemetry_history(machine_id: str, limit: int = 30, payload: dict = Depends(require_permission("telemetry:read"))):
    return TelemetrySimulator.get_history(machine_id, limit=limit)

@router.post("", status_code=status.HTTP_201_CREATED)
def create_asset(asset_data: Dict[str, Any], payload: dict = Depends(require_permission("machines:update"))):
    if "machine_id" not in asset_data or "name" not in asset_data:
        raise HTTPException(status_code=400, detail="Missing required machine_id or name.")
    
    # Defaults
    asset_data.setdefault("category", "INDUSTRIAL_MACHINE")
    asset_data.setdefault("status", "OPERATIONAL")
    asset_data.setdefault("simulation_profile", "NORMAL")
    asset_data.setdefault("health_score", 100.0)
    asset_data.setdefault("risk_score", 0.0)
    asset_data.setdefault("anomaly_score", 1.0)
    asset_data.setdefault("rpm", 1500.0)
    asset_data.setdefault("operating_hours", 0.0)
    asset_data.setdefault("components", [])
    asset_data.setdefault("sensors", [])

    created = AssetRegistry.register_new_asset(asset_data)
    return created
