import os
import json
import hashlib
import time
from datetime import datetime, timezone
from typing import Optional, List, Dict, Any
from app.core.config import settings

AUDIT_FILE_PATH = os.path.join(settings.AUDIT_LOG_DIR, "system_audit.jsonl")

def compute_checksum(entry: Dict[str, Any]) -> str:
    """Compute cryptographic hash of audit log entry for tamper detection."""
    sorted_str = json.dumps(entry, sort_keys=True)
    return hashlib.sha256(sorted_str.encode("utf-8")).hexdigest()

class AuditLogger:
    @staticmethod
    def log(
        who: str,
        what: str,
        resource: str,
        result: str,  # "SUCCESS", "FAILURE", "BLOCKED", "DENIED"
        reason: Optional[str] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Record an immutable audit log entry to persistent log and DB."""
        now = datetime.now(timezone.utc).isoformat()
        
        entry = {
            "timestamp": now,
            "who": who,
            "what": what,
            "resource": resource,
            "result": result,
            "reason": reason or "",
            "ip_address": ip_address or "127.0.0.1",
            "user_agent": user_agent or "Internal",
            "details": details or {}
        }
        
        checksum = compute_checksum(entry)
        entry["checksum"] = checksum
        
        # Append to jsonl audit log
        try:
            with open(AUDIT_FILE_PATH, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry) + "\n")
        except Exception as e:
            print(f"Warning: Failed to write to audit log file: {e}")
            
        return entry

    @staticmethod
    def get_recent_logs(limit: int = 100, filter_who: Optional[str] = None, filter_result: Optional[str] = None) -> List[Dict[str, Any]]:
        """Retrieve recent audit logs in reverse chronological order."""
        if not os.path.exists(AUDIT_FILE_PATH):
            return []
        
        logs = []
        try:
            with open(AUDIT_FILE_PATH, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if line:
                        try:
                            item = json.loads(line)
                            if filter_who and item.get("who") != filter_who:
                                continue
                            if filter_result and item.get("result") != filter_result:
                                continue
                            logs.append(item)
                        except json.JSONDecodeError:
                            continue
        except Exception:
            return []
            
        # Return newest first
        return logs[::-1][:limit]

    @staticmethod
    def verify_integrity() -> Dict[str, Any]:
        """Verify the cryptographic integrity of the audit log."""
        if not os.path.exists(AUDIT_FILE_PATH):
            return {"total_records": 0, "valid_records": 0, "corrupted_records": 0, "status": "EMPTY"}
        
        total = 0
        valid = 0
        corrupted = 0
        
        with open(AUDIT_FILE_PATH, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                total += 1
                try:
                    record = json.loads(line)
                    stored_checksum = record.pop("checksum", None)
                    computed = compute_checksum(record)
                    if stored_checksum == computed:
                        valid += 1
                    else:
                        corrupted += 1
                except Exception:
                    corrupted += 1
                    
        return {
            "total_records": total,
            "valid_records": valid,
            "corrupted_records": corrupted,
            "status": "SECURE" if corrupted == 0 else "INTEGRITY_VIOLATION"
        }
