import re
from typing import Dict, Any, List

SENSITIVE_PATTERNS = [
    r"(?i)(password|secret|jwt_secret|api_key)\s*[:=]\s*['\"][^'\"]+['\"]",
    r"pbkdf2:sha256:\d+\$[a-f0-9]+\$[a-f0-9]+",
    r"eyJ[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}\.[a-zA-Z0-9_-]{10,}",  # JWT
    r"(?i)admin@sovereign2026!",
]

class OutputGuard:
    """Scans and redacts sensitive credentials or exfiltrated keys from AI responses."""

    @classmethod
    def sanitize_output(cls, text: str) -> Dict[str, Any]:
        sanitized = text
        violations = []

        for pattern in SENSITIVE_PATTERNS:
            matches = re.findall(pattern, sanitized)
            if matches:
                violations.append(f"Redacted sensitive credential match ({len(matches)} occurrence(s)).")
                sanitized = re.sub(pattern, "[REDACTED_CONFIDENTIAL_CREDENTIAL]", sanitized)

        return {
            "is_clean": len(violations) == 0,
            "violations": violations,
            "sanitized_output": sanitized
        }
