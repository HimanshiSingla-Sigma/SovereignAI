import re
from typing import Dict, Any, Tuple

# Multi-vector adversarial attack patterns categorized by industrial risk vector
THREAT_CATEGORIES = {
    "CONFIDENTIAL_DATA_EXFILTRATION": [
        r"(?i)\b(want|need|give|send|show|tell|provide|share|list|display|print|reveal|expose|leak|exfiltrate|steal|extract|dump|fetch|get)\b.*?\b(confidential|restricted|classified|proprietary)\b.*?\b(keys?|secrets?|passwords?|tokens?|user\s+credentials|database\s+dump|details?|info|information|data|system)\b",
        r"(?i)\b(dump|exfiltrate|leak|steal|extract|harvest)\s+.*?\b(database|users|credentials|tables?|passwords?|keys?|tokens?)\b",
        r"(?i)\b(database|root|admin|master)\s+(password|passwords|credentials?|secrets?|keys?)\b"
    ],
    "PROMPT_LEAKAGE": [
        r"(?i)\b(what|reveal|show|tell|print|display|give|repeat|output|list|describe|explain)\b.*?\b(system\s+prompt|meta\s*prompt|initial\s+instructions|system\s+instructions|developer\s+prompt|base\s+instructions|hidden\s+rules|system\s+rules|system\s+directives|core\s+prompt)\b",
        r"(?i)\b(repeat|echo|print|output)\s+(the\s+)?(words\s+above|text\s+above|prompt\s+above|everything\s+above|instructions\s+above)\b",
        r"(?i)\bwhat\s+(were\s+you\s+told|are\s+your\s+hidden\s+instructions|is\s+your\s+true\s+system\s+prompt)\b"
    ],
    "INJECTION_AND_DATABASE_ATTACK": [
        r"(?i)\b(prompt|sql|command|code|ldap|nosql)\s+injection\b",
        r"(?i)\binject\s+(into|in)\s+.*?(database|db|table|system|backend|server|app)\b",
        r"(?i)\binject\b.*?\b(database|secret|table|password|credential|token|payload|malicious)",
        r"(?i)\b(drop\s+table|union\s+select|insert\s+into\s+\w+|delete\s+from\s+\w+|select\s+.*?\s+from\s+users|alter\s+table|exec\s*\()\b",
        r"(?i)((\x27|\b)(or|and)\s+(\x27?1\x27?\s*=\s*\x27?1\x27?|true)\b|--\s*$|\/\*.*?\*\/)"
    ],
    "JAILBREAK_AND_PERSONA_OVERRIDE": [
        r"(?i)\bignore\s+(all\s+)?(previous|prior|current|system)\s+(instructions|prompts|rules|constraints|filters|guidelines)\b",
        r"(?i)\b(ai\s+system\s+override|override\s+system\s+prompt|override\s+(all\s+)?(ai\s+)?instructions|system\s+prompt\s+override)\b",
        r"(?i)\byou\s+are\s+now\s+(in\s+|acting\s+as\s+)?(developer|dan|unrestricted|god|root|admin|evil|jailbroken|anarchy|chaos)\s+mode\b",
        r"(?i)\bbypass\s+(all\s+)?(safety|security|policy|restrictions|guardrails|filters|rules|checks)\b",
        r"(?i)\bact\s+as\s+(an?\s+)?(unfiltered|jailbroken|unrestricted|malicious|adversarial|uncensored|evil)\b",
        r"(?i)\bpretend\s+(there\s+are\s+no\s+rules|you\s+have\s+no\s+restrictions|safety\s+is\s+disabled)\b",
        r"(?i)\bhypothetical\s+(scenario|mode)\s+where\s+(rules|safety|ethics)\s+(do\s+not|don't)\s+apply\b"
    ],
    "SAFETY_INTERLOCK_SABOTAGE": [
        r"(?i)\bdisable\s+(safety\s+engine|interlocks|emergency\s+shutdown\s+sequence|safety\s+guardrails)\b",
        r"(?i)\bforce\s+(actuator|valve|breaker|switch|relay|pump|motor)\s+(without|bypassing)\s+(permission|approval|interlock|check)\b",
        r"(?i)\bsuppress\s+(critical\s+alarm|safety\s+trip|shutdown\s+sequence)\b"
    ]
}

# Flattened list for backwards compatibility
INJECTION_PATTERNS = [pattern for cat in THREAT_CATEGORIES.values() for pattern in cat]

class PromptGuard:
    """
    Comprehensive industrial prompt security shield.
    Detects adversarial prompt injections, confidential data probing,
    system prompt leakage, and safety interlock sabotage attempts.
    """

    @classmethod
    def inspect_prompt(cls, prompt: str) -> Dict[str, Any]:
        cleaned = prompt.strip()
        matched_threats = []
        detected_categories = set()

        for category, patterns in THREAT_CATEGORIES.items():
            for pattern in patterns:
                match = re.search(pattern, cleaned)
                if match:
                    detected_categories.add(category)
                    matched_threats.append({
                        "category": category,
                        "matched_string": match.group(0),
                        "description": f"Violates {category.replace('_', ' ').title()}: '{match.group(0)}'"
                    })

        if matched_threats:
            reasons = [t["description"] for t in matched_threats]
            primary_category = list(detected_categories)[0]
            return {
                "decision": "BLOCK",
                "risk_score": 0.98,
                "threat_categories": list(detected_categories),
                "primary_category": primary_category,
                "reasons": reasons,
                "safe_prompt": None
            }

        # Soft checks for markdown/system delimiter injection
        if "```system" in cleaned.lower() or "<system>" in cleaned.lower():
            return {
                "decision": "FLAG",
                "risk_score": 0.65,
                "threat_categories": ["DELIMITER_INJECTION"],
                "primary_category": "DELIMITER_INJECTION",
                "reasons": ["Detected embedded system delimiters in operator query."],
                "safe_prompt": cleaned.replace("<system>", "[system]").replace("</system>", "[/system]")
            }

        return {
            "decision": "ALLOW",
            "risk_score": 0.02,
            "threat_categories": [],
            "primary_category": "NONE",
            "reasons": ["Prompt passed sovereign industrial prompt security policy."],
            "safe_prompt": cleaned
        }

    @classmethod
    def inspect_document_chunk(cls, text: str, doc_id: str = "UNKNOWN") -> Dict[str, Any]:
        """
        Scans external retrieved document text (PDF, OCR, RAG) for indirect prompt injection.
        Neutralizes adversarial payloads embedded in technical manuals.
        """
        cleaned = text.strip()
        matched_threats = []
        for category, patterns in THREAT_CATEGORIES.items():
            for pattern in patterns:
                match = re.search(pattern, cleaned)
                if match:
                    matched_threats.append({
                        "category": category,
                        "matched_string": match.group(0),
                        "doc_id": doc_id
                    })

        if matched_threats:
            # Sanitize document chunk by defanging malicious instructions
            sanitized = cleaned
            for threat in matched_threats:
                sanitized = re.sub(re.escape(threat["matched_string"]), "[BLOCKED_INDIRECT_INJECTION]", sanitized, flags=re.IGNORECASE)
            return {
                "decision": "NEUTRALIZED",
                "is_malicious": True,
                "threats": matched_threats,
                "sanitized_content": sanitized
            }

        return {
            "decision": "CLEAN",
            "is_malicious": False,
            "threats": [],
            "sanitized_content": cleaned
        }

    @classmethod
    def wrap_untrusted_data(cls, content: str, source_type: str = "DOCUMENT", identifier: str = "DOC-001") -> str:
        """
        Encloses external, untrusted content inside explicit XML boundaries so the local LLM
        treats it strictly as passive reference data rather than executable instructions.
        """
        inspection = cls.inspect_document_chunk(content, doc_id=identifier)
        safe_content = inspection["sanitized_content"]
        return (
            f"<untrusted_{source_type.lower()}_content id='{identifier}'>\n"
            f"{safe_content}\n"
            f"</untrusted_{source_type.lower()}_content>"
        )
