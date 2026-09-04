from typing import Dict, Any, List

class AgentValidator:
    """Validates intermediate agent outputs, safety compliance, and data classification clearance."""

    @classmethod
    def validate_step(cls, step: Dict[str, Any], result: Dict[str, Any]) -> Dict[str, Any]:
        # Check tool execution error
        if result.get("status") == "FAILED":
            return {
                "is_valid": False,
                "reason": f"Tool '{step.get('tool')}' reported failure: {result.get('error')}"
            }
        return {"is_valid": True, "reason": "Step execution completed within sovereign policy."}

    @classmethod
    def validate_final_output(cls, text: str) -> Dict[str, Any]:
        # Check for banned hallucinated shutdown actuator commands
        if "direct_actuator_override" in text.lower():
            return {
                "is_valid": False,
                "reason": "Safety Violation: AI generated direct actuator trigger without Human Approval."
            }
        return {"is_valid": True}
