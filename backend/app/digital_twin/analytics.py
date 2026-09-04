from typing import Dict, List, Any
from app.digital_twin.assets import AssetRegistry
from app.digital_twin.correlation_engine import MultiSensorCorrelationEngine

class IndustrialAnalytics:
    """
    Computes health scores, risk scores, predictive failure probability,
    and Remaining Useful Life (RUL) backed by physical sensor data.
    """

    @classmethod
    def calculate_health_and_risk(cls, machine_id: str) -> Dict[str, Any]:
        asset = AssetRegistry.get_by_id(machine_id)
        if not asset:
            return {}

        corr = MultiSensorCorrelationEngine.analyze_machine(machine_id)
        anomaly = corr["anomaly_score"]

        # Health Score: 0 (failed) to 100 (pristine)
        health_score = round(max(5.0, 100.0 - (anomaly * 0.85)), 1)
        # Risk Score: 0 (safe) to 100 (catastrophic)
        risk_score = round(min(98.0, anomaly * 0.95), 1)

        # Failure Probability (0.0 to 1.0)
        failure_prob = round(1.0 / (1.0 + math_exp(-0.08 * (risk_score - 50.0))), 3)

        # Remaining Useful Life (RUL) estimation in operational hours
        if risk_score > 75.0:
            rul_hours = round(max(4.0, (100.0 - risk_score) * 3.5), 1)
            priority = "CRITICAL"
        elif risk_score > 40.0:
            rul_hours = round((100.0 - risk_score) * 12.0, 1)
            priority = "HIGH"
        elif risk_score > 20.0:
            rul_hours = round((100.0 - risk_score) * 35.0, 1)
            priority = "MEDIUM"
        else:
            rul_hours = 4500.0
            priority = "LOW"

        recommendations = []
        if priority == "CRITICAL":
            recommendations.append("Immediate operational slowdown or controlled halt recommended.")
            recommendations.append("Dispatch reliability technician for emergency bearing/cooling diagnostic.")
        elif priority == "HIGH":
            recommendations.append("Schedule preventive maintenance inspection within next 24 operating hours.")
            recommendations.append("Execute SOP-MNT-042: Inspect lubrication, seal integrity, and alignment.")
        elif priority == "MEDIUM":
            recommendations.append("Monitor high-frequency vibration spectral harmonics during shift transitions.")
        else:
            recommendations.append("Maintain standard operating parameters and periodic lube schedule.")

        return {
            "machine_id": machine_id,
            "health_score": health_score,
            "risk_score": risk_score,
            "failure_probability": failure_prob,
            "estimated_rul_hours": rul_hours,
            "maintenance_priority": priority,
            "recommended_actions": recommendations
        }

def math_exp(x: float) -> float:
    import math
    return math.exp(max(-50.0, min(50.0, x)))
