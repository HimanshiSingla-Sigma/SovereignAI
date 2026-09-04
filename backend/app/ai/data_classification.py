from typing import Dict, List, Set
from app.core.rbac import ROLE_ADMINISTRATOR, ROLE_ENGINEER, ROLE_SAFETY_OFFICER, ROLE_OPERATOR

LEVEL_PUBLIC = "PUBLIC"
LEVEL_INTERNAL = "INTERNAL"
LEVEL_CONFIDENTIAL = "CONFIDENTIAL"
LEVEL_RESTRICTED = "RESTRICTED"

# Role clearances: which classification levels a given role can view and query
ROLE_CLEARANCE: Dict[str, Set[str]] = {
    ROLE_ADMINISTRATOR: {LEVEL_PUBLIC, LEVEL_INTERNAL, LEVEL_CONFIDENTIAL, LEVEL_RESTRICTED},
    ROLE_ENGINEER: {LEVEL_PUBLIC, LEVEL_INTERNAL, LEVEL_CONFIDENTIAL},
    ROLE_SAFETY_OFFICER: {LEVEL_PUBLIC, LEVEL_INTERNAL, LEVEL_CONFIDENTIAL},
    ROLE_OPERATOR: {LEVEL_PUBLIC, LEVEL_INTERNAL}
}

class DataClassificationManager:
    """Enforces data classification policies and prevents unauthorized data retrieval or export."""

    @classmethod
    def can_access(cls, role: str, item_classification: str) -> bool:
        allowed = ROLE_CLEARANCE.get(role, {LEVEL_PUBLIC})
        return item_classification.upper() in allowed

    @classmethod
    def filter_documents(cls, documents: List[Dict], role: str) -> List[Dict]:
        return [doc for doc in documents if cls.can_access(role, doc.get("classification", LEVEL_INTERNAL))]
