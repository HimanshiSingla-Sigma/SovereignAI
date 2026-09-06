from typing import Dict, List, Any
from app.hardware.profile import HardwareProfile, HardwareTier
from app.hardware.registry import ModelRegistry

class ModelCompatibilityChecker:
    """Evaluates whether models in the registry safely run on the detected hardware profile."""

    @staticmethod
    def check_model(model: Dict[str, Any], profile: HardwareProfile) -> Dict[str, Any]:
        raw_mem = profile.raw_data["memory"]
        gpu = profile.raw_data["gpu"]
        avail_ram = raw_mem["available_gb"]
        max_budget = profile.max_model_ram_gb
        
        reasons = []
        is_compatible = True

        # Check RAM limit
        if model["ram_required_gb"] > max_budget:
            is_compatible = False
            reasons.append(
                f"Requires {model['ram_required_gb']} GB RAM, which exceeds safe allocation budget ({max_budget} GB) for current {profile.tier} tier."
            )

        # Check GPU VRAM ONLY if model cannot run on CPU (or explicitly requires dedicated GPU)
        is_cpu_compat = model.get("cpu_compatible", True)
        has_gpu = gpu.get("has_dedicated_gpu", False) or gpu.get("metal_available", False)

        if not is_cpu_compat:
            vram_req = model.get("vram_required_gb", 0.0)
            if not has_gpu:
                is_compatible = False
                reasons.append(
                    f"Requires dedicated GPU acceleration ({vram_req} GB VRAM). Detected: {gpu.get('gpu_name', 'Host CPU')}."
                )
            elif vram_req > 0 and ((gpu.get("vram_mb", 0) / 1024) < vram_req):
                is_compatible = False
                reasons.append(
                    f"Insufficient VRAM: requires {vram_req} GB, detected {round(gpu.get('vram_mb', 0)/1024, 1)} GB."
                )

        reason_str = "; ".join(reasons) if not is_compatible else "Hardware profile meets memory and compute requirements."

        return {
            "model_id": model["model_id"],
            "name": model["name"],
            "is_compatible": is_compatible,
            "status": "COMPATIBLE" if is_compatible else "INCOMPATIBLE",
            "reason": reason_str,
            "reasons": reasons if not is_compatible else ["Hardware profile meets memory and compute requirements."],
            "ram_required_gb": model["ram_required_gb"],
            "vram_required_gb": model["vram_required_gb"],
            "recommended_tier": model["recommended_tier"]
        }

    @classmethod
    def evaluate_all(cls, profile: HardwareProfile) -> List[Dict[str, Any]]:
        results = []
        for model in ModelRegistry.get_all():
            results.append(cls.check_model(model, profile))
        return results
