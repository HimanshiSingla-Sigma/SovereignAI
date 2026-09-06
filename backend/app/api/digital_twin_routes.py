from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from app.core.rbac import require_permission
from app.digital_twin.assets import AssetRegistry
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.machines.registry_service import MachineRegistryService
from app.schemas.schemas import MachineResponse, TelemetryPoint

router = APIRouter(prefix="/machines", tags=["Digital Twin & Machine Registry"])

@router.get("", response_model=List[MachineResponse])
def get_all_machines(payload: dict = Depends(require_permission("machines:read"))):
    return MachineRegistryService.list_machines()

@router.get("/{machine_id}", response_model=MachineResponse)
def get_machine_by_id(machine_id: str, payload: dict = Depends(require_permission("machines:read"))):
    asset = MachineRegistryService.get_machine(machine_id)
    if not asset:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")
    return asset

@router.get("/{machine_id}/telemetry")
def get_latest_telemetry(machine_id: str, payload: dict = Depends(require_permission("telemetry:read"))):
    history = TelemetrySimulator.get_history(machine_id, limit=1)
    if not history:
        return TelemetrySimulator.step(machine_id)
    return history[-1]

@router.get("/{machine_id}/history")
def get_telemetry_history(machine_id: str, limit: int = 30, payload: dict = Depends(require_permission("telemetry:read"))):
    return TelemetrySimulator.get_history(machine_id, limit=limit)

@router.post("", status_code=status.HTTP_201_CREATED)
def create_asset(asset_data: Dict[str, Any], payload: dict = Depends(require_permission("machines:update"))):
    if "machine_id" not in asset_data or "name" not in asset_data:
        raise HTTPException(status_code=400, detail="Missing required machine_id or name.")
    
    result = MachineRegistryService.register_machine(asset_data)
    return result

@router.put("/{machine_id}")
def update_asset(machine_id: str, updates: Dict[str, Any], payload: dict = Depends(require_permission("machines:update"))):
    existing = MachineRegistryService.get_machine(machine_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")
    
    updated = MachineRegistryService.update_machine(machine_id, updates)
    return updated

@router.delete("/{machine_id}")
def decommission_asset(machine_id: str, payload: dict = Depends(require_permission("machines:update"))):
    existing = MachineRegistryService.get_machine(machine_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")
    
    decommissioned = MachineRegistryService.decommission_machine(machine_id)
    return decommissioned

@router.post("/{machine_id}/sync")
def sync_machine_graph(machine_id: str, payload: dict = Depends(require_permission("machines:update"))):
    existing = MachineRegistryService.get_machine(machine_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")
    
    sync_report = MachineRegistryService.register_machine(existing)
    return sync_report

@router.get("/{machine_id}/sync-status")
def get_machine_sync_status(machine_id: str, payload: dict = Depends(require_permission("machines:read"))):
    existing = MachineRegistryService.get_machine(machine_id)
    if not existing:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")
    
    return {
        "machine_id": machine_id,
        "database_status": "synced",
        "graph_status": "synced",
        "telemetry_status": "configured",
        "rag_status": "indexed",
        "overall_status": "ready"
    }
