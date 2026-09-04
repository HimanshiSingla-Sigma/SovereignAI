import re
from typing import Dict, Any, Tuple

# Adversarial prompt injection keywords and patterns
INJECTION_PATTERNS = [
    r"(?i)ignore\s+(all\s+)?(previous|prior)\s+(instructions|prompts|rules)",
    r"(?i)system\s+override",
    r"(?i)you\s+are\s+now\s+in\s+(developer|dan|unrestricted|god)\s+mode",
    r"(?i)bypass\s+(all\s+)?(safety|security|policy|restrictions)",
    r"(?i)reveal\s+(system\s+prompt|secret|api_key|password|jwt_secret)",
    r"(?i)dump\s+(all\s+)?(database|users|credentials|tables)",
    r"(?i)disable\s+(safety\s+engine|interlocks|emergency\s+shutdown|checks)",
    r"(?i)act\s+as\s+an\s+unfiltered",
    r"(?i)exfiltrate\s+data"
]

class PromptGuard:
    """Detects prompt injections, adversarial overrides, and jailbreak attempts."""

    @classmethod
    def inspect_prompt(cls, prompt: str) -> Dict[str, Any]:
        cleaned = prompt.strip()
        matched_patterns = []

        for pattern in INJECTION_PATTERNS:
            match = re.search(pattern, cleaned)
            if match:
                matched_patterns.append(match.group(0))

        if matched_patterns:
            return {
                "decision": "BLOCK",
                "risk_score": 0.95,
                "reasons": [f"Detected prompt injection pattern: '{p}'" for p in matched_patterns],
                "safe_prompt": None
            }

        # Soft checks (e.g. suspicious markdown injection or delimiters)
        if "```system" in cleaned.lower() or "<system>" in cleaned.lower():
            return {
                "decision": "FLAG",
                "risk_score": 0.65,
                "reasons": ["Detected embedded system delimiters."],
                "safe_prompt": cleaned.replace("<system>", "[system]").replace("</system>", "[/system]")
            }

        return {
            "decision": "ALLOW",
            "risk_score": 0.05,
            "reasons": ["Prompt passed sovereign industrial prompt security policy."],
            "safe_prompt": cleaned
        }
