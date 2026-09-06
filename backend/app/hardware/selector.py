from typing import Dict, Any, Optional
from app.hardware.profile import HardwareProfile
from app.hardware.registry import ModelRegistry
from app.hardware.router import HardwareAwareRouter

class ModelSelector:
    """Selects the best compatible model for each task type based on hardware capability."""

    def __init__(self, profile: Optional[HardwareProfile] = None):
        self.profile = profile or HardwareProfile()

    def select_model_for_task(self, task_type: str, prompt: Optional[str] = None) -> Dict[str, Any]:
        """
        Routes task to best model using HardwareAwareRouter.
        Returns dict with selected_model, tier, reason, and full explanation.
        """
        decision = HardwareAwareRouter.route_task(task_type=task_type, prompt=prompt, profile=self.profile)
        return {
            "selected_model": decision["selected_model"],
            "tier": self.profile.tier,
            "reason": "; ".join(decision["reasons"]),
            "decision": decision
        }

    def get_system_model_configuration(self) -> Dict[str, Any]:
        routing_info = HardwareAwareRouter.get_full_routing_table(self.profile)
        return {
            "general_llm": self.select_model_for_task("GENERAL_LLM")["selected_model"],
            "reasoning": self.select_model_for_task("REASONING")["selected_model"],
            "agent_planner": self.select_model_for_task("AGENT_PLANNER")["selected_model"],
            "sop_rag": self.select_model_for_task("SOP_RAG")["selected_model"],
            "embedding": ModelRegistry.get_by_id("local-semantic-embedding"),
            "ocr": ModelRegistry.get_by_id("local-cpu-ocr-engine"),
            "hardware_tier": self.profile.tier,
            "max_safe_ram_gb": self.profile.max_model_ram_gb,
            "routing_table": routing_info["routing_table"]
        }
