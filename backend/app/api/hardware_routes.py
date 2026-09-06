from typing import List, Dict, Any
from fastapi import APIRouter, Depends
from app.core.rbac import require_permission
from app.hardware.profile import HardwareProfile
from app.hardware.registry import ModelRegistry
from app.hardware.compatibility import ModelCompatibilityChecker
from app.hardware.router import HardwareAwareRouter
from app.schemas.schemas import (
    HardwareProfileResponse,
    ModelRegistryItem,
    ModelRoutingTableResponse,
    ModelRoutingDecisionResponse,
    ModelRoutingSimulateRequest,
    ActiveModelStatusResponse
)
from app.ai.gateway import model_gateway

router = APIRouter(prefix="/hardware", tags=["Hardware Capability & Models"])

@router.get("/profile", response_model=HardwareProfileResponse)
def get_hardware_profile(payload: dict = Depends(require_permission("machines:read"))):
    profile = HardwareProfile()
    return profile.get_summary()

@router.get("/models", response_model=List[ModelRegistryItem])
def get_model_registry(payload: dict = Depends(require_permission("machines:read"))):
    profile = HardwareProfile()
    compat_list = ModelCompatibilityChecker.evaluate_all(profile)
    compat_map = {c["model_id"]: c["is_compatible"] for c in compat_list}

    results = []
    for m in ModelRegistry.get_all():
        results.append(ModelRegistryItem(
            model_id=m["model_id"],
            name=m["name"],
            parameters=m["parameters"],
            quantization=m["quantization"],
            ram_required_gb=m["ram_required_gb"],
            vram_required_gb=m["vram_required_gb"],
            is_compatible=compat_map.get(m["model_id"], False),
            is_installed=m.get("is_installed", False),
            is_fallback=m.get("is_fallback", False),
            file_size_gb=m.get("file_size_gb", 0.0),
            recommended_tier=m["recommended_tier"],
            description=m["description"]
        ))
    return results

@router.post("/models/refresh", response_model=List[ModelRegistryItem])
def refresh_model_discovery(payload: dict = Depends(require_permission("machines:read"))):
    ModelRegistry.refresh()
    return get_model_registry(payload)

@router.get("/compatibility")
def get_compatibility_report(payload: dict = Depends(require_permission("machines:read"))):
    profile = HardwareProfile()
    return {
        "hardware_summary": profile.get_summary(),
        "model_evaluations": ModelCompatibilityChecker.evaluate_all(profile)
    }

@router.get("/routing", response_model=ModelRoutingTableResponse)
def get_model_routing_table(payload: dict = Depends(require_permission("machines:read"))):
    """
    Returns current deterministic routing decisions across all standard AI tasks,
    complete with hardware snapshots, candidate scores, and explainability.
    """
    profile = HardwareProfile()
    return HardwareAwareRouter.get_full_routing_table(profile)

@router.post("/routing/simulate", response_model=ModelRoutingDecisionResponse)
def simulate_model_routing(
    req: ModelRoutingSimulateRequest,
    payload: dict = Depends(require_permission("machines:read"))
):
    """
    Simulates hardware-aware routing for a given task, with optional hardware overrides
    to demonstrate how routing changes across laptops, workstations, and GPU servers.
    """
    profile = HardwareProfile()

    # Apply simulation overrides if requested
    if req.override_available_ram_gb is not None or req.override_vram_gb is not None or req.override_has_gpu is not None:
        raw_copy = dict(profile.raw_data)
        mem_copy = dict(raw_copy.get("memory", {}))
        gpu_copy = dict(raw_copy.get("gpu", {}))

        if req.override_available_ram_gb is not None:
            mem_copy["available_gb"] = req.override_available_ram_gb
            mem_copy["total_gb"] = max(mem_copy.get("total_gb", 8.0), req.override_available_ram_gb * 1.2)
        if req.override_vram_gb is not None:
            gpu_copy["vram_mb"] = req.override_vram_gb * 1024
            gpu_copy["vram_available_mb"] = req.override_vram_gb * 1024
            gpu_copy["vram_total_gb"] = req.override_vram_gb
            gpu_copy["vram_available_gb"] = req.override_vram_gb
            gpu_copy["has_dedicated_gpu"] = req.override_vram_gb > 0
        if req.override_has_gpu is not None:
            gpu_copy["has_dedicated_gpu"] = req.override_has_gpu

        raw_copy["memory"] = mem_copy
        raw_copy["gpu"] = gpu_copy
        profile = HardwareProfile(raw_data_override=raw_copy)

    return HardwareAwareRouter.route_task(
        task_type=req.task_type,
        prompt=req.prompt,
        profile=profile
    )

@router.get("/active-model", response_model=ActiveModelStatusResponse)
def get_active_model_status(payload: dict = Depends(require_permission("machines:read"))):
    """
    Returns the real-time active model name, path, memory residency status,
    and llama_cpp runtime environment status.
    """
    status = model_gateway.engine.get_active_status()
    return ActiveModelStatusResponse(
        active_model_name=status["active_model_name"],
        active_model_path=status["active_model_path"],
        active_task=status["active_task"],
        is_loaded_in_memory=status["is_loaded_in_memory"],
        is_fallback=status["is_fallback"],
        llama_cpp_installed=status["llama_cpp_installed"],
        llama_cpp_version=status["llama_cpp_version"],
        llama_cpp_status=status["llama_cpp_status"]
    )

