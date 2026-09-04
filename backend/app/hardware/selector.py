from typing import Dict, Any, Optional
from app.hardware.profile import HardwareProfile, HardwareTier
from app.hardware.registry import ModelRegistry
from app.hardware.compatibility import ModelCompatibilityChecker

class ModelSelector:
    """Selects the best compatible model for each task type based on hardware capability."""

    def __init__(self, profile: Optional[HardwareProfile] = None):
        self.profile = profile or HardwareProfile()

    def select_model_for_task(self, task_type: str) -> Dict[str, Any]:
        """
        task_type: GENERAL_LLM, REASONING, EMBEDDING, OCR, VISION
        """
        all_models = ModelRegistry.get_all()
        candidates = [m for m in all_models if m["model_type"] == task_type or task_type == "ANY"]
        
        compatible_candidates = []
        for model in candidates:
            compat = ModelCompatibilityChecker.check_model(model, self.profile)
            if compat["is_compatible"]:
                compatible_candidates.append(model)
        
        if compatible_candidates:
            # Sort by highest capability that still fits safely
            compatible_candidates.sort(key=lambda m: m["ram_required_gb"], reverse=True)
            chosen = compatible_candidates[0]
            return {
                "selected_model": chosen,
                "tier": self.profile.tier,
                "reason": f"Optimal compatible model for task '{task_type}' within {self.profile.max_model_ram_gb} GB memory budget."
            }
        
        # Fallback to sovereign native CPU engine
        fallback = ModelRegistry.get_by_id("sovereign-neural-cpu-1b")
        return {
            "selected_model": fallback,
            "tier": self.profile.tier,
            "reason": "Defaulting to Sovereign Native CPU Inference Reasoner to guarantee responsiveness on low-memory host."
        }

    def get_system_model_configuration(self) -> Dict[str, Any]:
        return {
            "general_llm": self.select_model_for_task("GENERAL_LLM")["selected_model"],
            "reasoning": self.select_model_for_task("REASONING")["selected_model"],
            "embedding": ModelRegistry.get_by_id("local-semantic-embedding"),
            "ocr": ModelRegistry.get_by_id("local-cpu-ocr-engine"),
            "hardware_tier": self.profile.tier,
            "max_safe_ram_gb": self.profile.max_model_ram_gb
        }
