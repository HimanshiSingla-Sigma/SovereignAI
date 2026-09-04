from typing import Dict, List, Any, Optional
from app.hardware.profile import HardwareProfile
from app.hardware.selector import ModelSelector
from app.ai.inference_engine import SovereignInferenceEngine
from app.ai.prompt_guard import PromptGuard
from app.ai.output_guard import OutputGuard
from app.core.audit import AuditLogger

class ModelGateway:
    """
    Unified AI Model Gateway.
    Classifies tasks, enforces prompt security, checks hardware compatibility,
    routes to the selected local model, sanitizes output, and audits invocations.
    """

    def __init__(self):
        self.profile = HardwareProfile()
        self.selector = ModelSelector(self.profile)
        self.engine = SovereignInferenceEngine()

    def process_request(
        self,
        prompt: str,
        user: str,
        task_type: str = "GENERAL_LLM",
        context_chunks: Optional[List[str]] = None,
        graph_facts: Optional[List[str]] = None,
        telemetry_data: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        # 1. Prompt Guard: Check for Prompt Injection & Policy Violations
        guard_result = PromptGuard.inspect_prompt(prompt)
        if guard_result["decision"] == "BLOCK":
            AuditLogger.log(
                who=user,
                what="AI_PROMPT_BLOCKED",
                resource="ModelGateway",
                result="BLOCKED",
                reason="; ".join(guard_result["reasons"]),
                details={"prompt_preview": prompt[:100]}
            )
            return {
                "response": "REQUEST BLOCKED BY SOVEREIGN PROMPT GUARD: Your input violates the sovereign security policy. Prompt injection and system override attempts are prohibited and logged.",
                "model_used": "PROMPT_GUARD_SECURITY_SHIELD",
                "safety_check": "BLOCKED",
                "guard_details": guard_result
            }

        # 2. Select Model based on Hardware Capability
        selection = self.selector.select_model_for_task(task_type)
        selected_model = selection["selected_model"]

        # 3. Execute Local Inference
        raw_output = self.engine.generate(
            prompt=guard_result["safe_prompt"] or prompt,
            context_chunks=context_chunks,
            graph_facts=graph_facts,
            telemetry_data=telemetry_data
        )

        # 4. Output Guard: Exfiltration & Credential Leak Protection
        sanitized = OutputGuard.sanitize_output(raw_output)

        # 5. Audit Invocation
        AuditLogger.log(
            who=user,
            what="MODEL_INVOCATION",
            resource=selected_model["model_id"],
            result="SUCCESS",
            reason=f"Task: {task_type}",
            details={"hardware_tier": self.profile.tier, "context_items": len(context_chunks or [])}
        )

        return {
            "response": sanitized["sanitized_output"],
            "model_used": selected_model["name"],
            "model_id": selected_model["model_id"],
            "safety_check": "PASSED" if sanitized["is_clean"] else "SANITIZED",
            "hardware_tier": self.profile.tier
        }

model_gateway = ModelGateway()
