try:
    import numpy as np
    HAS_NUMPY = True
except ImportError:
    HAS_NUMPY = False
    np = None

from typing import Dict, List, Any
import math
from app.digital_twin.telemetry_simulator import TelemetrySimulator


class MultiSensorCorrelationEngine:
    """
    Correlates multi-sensor telemetry (temperature, vibration, current, gas)
    to detect cross-sensor inconsistencies, mechanical stress, and multivariate anomalies.
    """

    @classmethod
    def analyze_machine(cls, machine_id: str) -> Dict[str, Any]:
        history = TelemetrySimulator.get_history(machine_id, limit=30)
        if not history:
            return {
                "machine_id": machine_id,
                "anomaly_score": 0.0,
                "cross_sensor_inconsistencies": [],
                "correlation_matrix": {},
                "detected_patterns": ["Insufficient telemetry data"],
                "status": "INSUFFICIENT_DATA"
            }

        latest = history[-1]
        temp = latest["temperature"]
        vib = latest["vibration"]
        curr = latest["current"]
        gas = latest["gas"]

        inconsistencies = []
        patterns = []

        # 1. Cross-sensor Physical Correlation Checks
        # Bearing / Mechanical Fault: High vibration without motor current spike
        if vib > 3.0 and curr < 35.0:
            inconsistencies.append(
                f"Localized mechanical stress: Radial vibration ({vib} mm/s) is elevated while drive current ({curr} A) remains normal. Indicates localized bearing race degradation or spindle unbalance rather than electrical motor overload."
            )
            patterns.append("MECHANICAL_BEARING_DEGRADATION")

        # Cooling Failure / Thermal Runaway: High temp without excessive current
        if temp > 75.0 and curr < 30.0:
            inconsistencies.append(
                f"Thermal divergence: Temperature ({temp} °C) is abnormally high despite moderate electrical draw ({curr} A). Suggests coolant line blockage or insufficient thermal paste dissipation."
            )
            patterns.append("COOLING_SYSTEM_DEGRADATION")

        # Electrical Overload: High current accompanied by rapid thermal ramp
        if curr > 40.0 and temp > 70.0:
            patterns.append("ELECTRICAL_OVERLOAD_THERMAL_STRESS")

        # Environmental / Atmospheric Hazard: Elevated gas concentration
        if gas > 20.0:
            inconsistencies.append(
                f"Atmospheric anomaly: Combustible/toxic gas concentration ({gas} ppm) exceeds environmental threshold. Potential refrigerant or cutting fluid vaporization."
            )
            patterns.append("ATMOSPHERIC_GAS_LEAK")

        # 2. Compute Correlation Matrix across History
        if HAS_NUMPY:
            t_arr = np.array([r["temperature"] for r in history])
            v_arr = np.array([r["vibration"] for r in history])
            c_arr = np.array([r["current"] for r in history])
            g_arr = np.array([r["gas"] for r in history])

            matrix_data = np.stack([t_arr, v_arr, c_arr, g_arr])
            std_devs = np.std(matrix_data, axis=1)
            if np.any(std_devs == 0):
                corr = np.eye(4)
            else:
                corr = np.corrcoef(matrix_data)
                corr = np.nan_to_num(corr, nan=0.0)

            corr_matrix = {
                "temperature": {"temperature": 1.0, "vibration": round(float(corr[0, 1]), 2), "current": round(float(corr[0, 2]), 2), "gas": round(float(corr[0, 3]), 2)},
                "vibration": {"temperature": round(float(corr[1, 0]), 2), "vibration": 1.0, "current": round(float(corr[1, 2]), 2), "gas": round(float(corr[1, 3]), 2)},
                "current": {"temperature": round(float(corr[2, 0]), 2), "vibration": round(float(corr[2, 1]), 2), "current": 1.0, "gas": round(float(corr[2, 3]), 2)},
                "gas": {"temperature": round(float(corr[3, 0]), 2), "vibration": round(float(corr[3, 1]), 2), "current": round(float(corr[3, 2]), 2), "gas": 1.0}
            }
        else:
            def pearson(a: List[float], b: List[float]) -> float:
                if len(a) < 2 or len(b) < 2:
                    return 0.0
                mean_a = sum(a) / len(a)
                mean_b = sum(b) / len(b)
                numerator = sum((x - mean_a) * (y - mean_b) for x, y in zip(a, b))
                den_a = sum((x - mean_a) ** 2 for x in a)
                den_b = sum((y - mean_b) ** 2 for y in b)
                if den_a <= 0 or den_b <= 0:
                    return 0.0
                return round(numerator / math.sqrt(den_a * den_b), 2)

            t_list = [float(r["temperature"]) for r in history]
            v_list = [float(r["vibration"]) for r in history]
            c_list = [float(r["current"]) for r in history]
            g_list = [float(r["gas"]) for r in history]

            corr_matrix = {
                "temperature": {"temperature": 1.0, "vibration": pearson(t_list, v_list), "current": pearson(t_list, c_list), "gas": pearson(t_list, g_list)},
                "vibration": {"temperature": pearson(v_list, t_list), "vibration": 1.0, "current": pearson(v_list, c_list), "gas": pearson(v_list, g_list)},
                "current": {"temperature": pearson(c_list, t_list), "vibration": pearson(c_list, v_list), "current": 1.0, "gas": pearson(c_list, g_list)},
                "gas": {"temperature": pearson(g_list, t_list), "vibration": pearson(g_list, v_list), "current": pearson(g_list, c_list), "gas": 1.0}
            }


        # 3. Overall Multi-sensor Anomaly Score (0 to 100)
        anomaly_score = float(latest.get("anomaly_score", 0.0))
        if inconsistencies and anomaly_score < 40.0:
            anomaly_score = 45.0 + len(inconsistencies) * 10.0

        return {
            "machine_id": machine_id,
            "anomaly_score": round(anomaly_score, 1),
            "cross_sensor_inconsistencies": inconsistencies,
            "correlation_matrix": corr_matrix,
            "detected_patterns": patterns if patterns else ["NOMINAL_CROSS_CORRELATION"],
            "status": "ANOMALY_DETECTED" if anomaly_score > 50.0 else "NOMINAL"
        }
