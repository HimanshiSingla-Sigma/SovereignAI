from typing import List, Dict, Any

DEFAULT_SAFETY_RULES: List[Dict[str, Any]] = [
    {
        "rule_id": "SR-TEMP-01",
        "name": "High Thermal Divergence Warning",
        "parameter": "TEMPERATURE",
        "operator": ">=",
        "threshold": 80.0,
        "severity": "WARNING",
        "action_required": "ALERT",
        "is_active": True
    },
    {
        "rule_id": "SR-TEMP-02",
        "name": "Extreme Bearing Overheat Critical",
        "parameter": "TEMPERATURE",
        "operator": ">=",
        "threshold": 95.0,
        "severity": "CRITICAL",
        "action_required": "APPROVAL_REQUIRED",
        "is_active": True
    },
    {
        "rule_id": "SR-VIB-01",
        "name": "Spindle Vibration Warning (ISO 10816)",
        "parameter": "VIBRATION",
        "operator": ">=",
        "threshold": 3.0,
        "severity": "WARNING",
        "action_required": "ALERT",
        "is_active": True
    },
    {
        "rule_id": "SR-VIB-02",
        "name": "Catastrophic Mechanical Vibration Trip",
        "parameter": "VIBRATION",
        "operator": ">=",
        "threshold": 4.5,
        "severity": "CRITICAL",
        "action_required": "APPROVAL_REQUIRED",
        "is_active": True
    },
    {
        "rule_id": "SR-GAS-01",
        "name": "Combustible/Toxic Gas Enclosure Alert",
        "parameter": "GAS",
        "operator": ">=",
        "threshold": 30.0,
        "severity": "CRITICAL",
        "action_required": "APPROVAL_REQUIRED",
        "is_active": True
    },
    {
        "rule_id": "SR-GAS-02",
        "name": "Atmospheric Flammability Emergency Level",
        "parameter": "GAS",
        "operator": ">=",
        "threshold": 50.0,
        "severity": "EMERGENCY",
        "action_required": "AUTOMATIC_SHUTDOWN",
        "is_active": True
    },
    {
        "rule_id": "SR-ANOMALY-01",
        "name": "Multi-Sensor Correlation Collapse",
        "parameter": "ANOMALY",
        "operator": ">=",
        "threshold": 85.0,
        "severity": "CRITICAL",
        "action_required": "APPROVAL_REQUIRED",
        "is_active": True
    }
]
