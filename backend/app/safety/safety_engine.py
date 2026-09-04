from typing import Dict, List, Any, Tuple
from app.safety.rules import DEFAULT_SAFETY_RULES
from app.core.audit import AuditLogger

class DeterministicSafetyEngine:
    """
    Deterministic Industrial Safety Engine.
    Operates strictly on mathematical thresholds and deterministic interlocks.
    Isolated from non-deterministic LLM generations.
    """
    _rules = list(DEFAULT_SAFETY_RULES)
    _events: List[Dict[str, Any]] = []

    @classmethod
    def get_rules(cls) -> List[Dict[str, Any]]:
        return cls._rules

    @classmethod
    def get_events(cls, limit: int = 50) -> List[Dict[str, Any]]:
        return cls._events[::-1][:limit]

    @classmethod
    def evaluate_telemetry(cls, machine_id: str, telemetry: Dict[str, Any]) -> Dict[str, Any]:
        """
        Evaluates active telemetry against deterministic rules.
        Returns overall safety state and list of triggered interlocks.
        """
        temp = telemetry.get("temperature", 0.0)
        vib = telemetry.get("vibration", 0.0)
        gas = telemetry.get("gas", 0.0)
        anomaly = telemetry.get("anomaly_score", 0.0)

        triggered_rules = []
        highest_severity = "NORMAL"

        for rule in cls._rules:
            if not rule.get("is_active", True):
                continue

            param = rule["parameter"]
            threshold = rule["threshold"]
            op = rule["operator"]
            
            val = temp if param == "TEMPERATURE" else vib if param == "VIBRATION" else gas if param == "GAS" else anomaly if param == "ANOMALY" else 0.0

            is_triggered = False
            if op == ">=" and val >= threshold:
                is_triggered = True
            elif op == ">" and val > threshold:
                is_triggered = True
            elif op == "<=" and val <= threshold:
                is_triggered = True

            if is_triggered:
                severity = rule["severity"]
                triggered_rules.append({
                    "rule_id": rule["rule_id"],
                    "name": rule["name"],
                    "parameter": param,
                    "measured_value": val,
                    "threshold": threshold,
                    "severity": severity,
                    "action_required": rule["action_required"]
                })

                # Determine overall highest severity
                if severity == "EMERGENCY":
                    highest_severity = "EMERGENCY"
                elif severity == "CRITICAL" and highest_severity != "EMERGENCY":
                    highest_severity = "CRITICAL"
                elif severity == "WARNING" and highest_severity not in ["CRITICAL", "EMERGENCY"]:
                    highest_severity = "WARNING"

                # Record event
                event_record = {
                    "rule_id": rule["rule_id"],
                    "machine_id": machine_id,
                    "parameter": param,
                    "trigger_value": val,
                    "threshold_value": threshold,
                    "severity": severity,
                    "action_taken": rule["action_required"],
                    "timestamp": telemetry.get("timestamp")
                }
                cls._events.append(event_record)
                if len(cls._events) > 100:
                    cls._events.pop(0)

                AuditLogger.log(
                    who="DeterministicSafetyEngine",
                    what="SAFETY_INTERLOCK_TRIGGERED",
                    resource=f"{machine_id}:{rule['rule_id']}",
                    result="TRIGGERED",
                    reason=f"{param} measured {val} breached {threshold}",
                    details=event_record
                )

        return {
            "machine_id": machine_id,
            "system_safety_state": highest_severity,
            "triggered_rules": triggered_rules,
            "interlocks_active": len(triggered_rules) > 0,
            "requires_human_approval": any(r["action_required"] == "APPROVAL_REQUIRED" for r in triggered_rules),
            "requires_automatic_shutdown": highest_severity == "EMERGENCY"
        }
