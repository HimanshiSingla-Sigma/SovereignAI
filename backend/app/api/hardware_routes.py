from typing import List
from fastapi import APIRouter, Depends
from app.core.rbac import require_permission
from app.hardware.profile import HardwareProfile
from app.hardware.registry import ModelRegistry
from app.hardware.compatibility import ModelCompatibilityChecker
from app.schemas.schemas import HardwareProfileResponse, ModelRegistryItem

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
            recommended_tier=m["recommended_tier"],
            description=m["description"]
        ))
    return results

@router.get("/compatibility")
def get_compatibility_report(payload: dict = Depends(require_permission("machines:read"))):
    profile = HardwareProfile()
    return {
        "hardware_summary": profile.get_summary(),
        "model_evaluations": ModelCompatibilityChecker.evaluate_all(profile)
    }
