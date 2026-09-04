import copy
from typing import Dict, List, Any
from app.digital_twin.assets import AssetRegistry
from app.digital_twin.telemetry_simulator import TelemetrySimulator

class WhatIfEngine:
    """
    Virtual Digital Twin simulation engine.
    Executes hypothetical operational scenarios on isolated virtual twins.
    Strictly guarantees that live Digital Twin state is never mutated.
    """

    @classmethod
    def run_scenario(
        cls,
        machine_id: str,
        temp_delta: float = 0.0,
        vibration_delta: float = 0.0,
        current_delta: float = 0.0,
        gas_delta: float = 0.0,
        ambient_stress_multiplier: float = 1.0,
        simulation_steps: int = 10
    ) -> Dict[str, Any]:
        live_asset = AssetRegistry.get_by_id(machine_id)
        if not live_asset:
            raise ValueError(f"Machine '{machine_id}' not found.")

        # 1. DEEP COPY: Create isolated virtual twin
        virtual_twin = copy.deepcopy(live_asset)
        
        # Get current live telemetry snapshot
        live_history = TelemetrySimulator.get_history(machine_id, limit=1)
        latest_live = live_history[-1] if live_history else {
            "temperature": 50.0, "vibration": 1.5, "current": 20.0, "gas": 2.0, "anomaly_score": 10.0
        }

        # 2. Apply hypothetical scenario on virtual twin
        simulated_temp = latest_live["temperature"] + (temp_delta * ambient_stress_multiplier)
        simulated_vib = latest_live["vibration"] + (vibration_delta * ambient_stress_multiplier)
        simulated_curr = latest_live["current"] + (current_delta * ambient_stress_multiplier)
        simulated_gas = latest_live["gas"] + gas_delta

        # 3. Predict Multi-Sensor Anomaly & Health Trajectory
        # Compute virtual anomaly score
        temp_penalty = max(0.0, (simulated_temp - 75.0) * 1.8) if simulated_temp > 75.0 else 0.0
        vib_penalty = max(0.0, (simulated_vib - 3.0) * 25.0) if simulated_vib > 3.0 else 0.0
        curr_penalty = max(0.0, (simulated_curr - 45.0) * 1.5) if simulated_curr > 45.0 else 0.0
        gas_penalty = max(0.0, (simulated_gas - 25.0) * 2.0) if simulated_gas > 25.0 else 0.0

        virtual_anomaly = min(99.0, max(2.0, latest_live["anomaly_score"] + temp_penalty + vib_penalty + curr_penalty + gas_penalty))
        virtual_health = round(max(0.0, 100.0 - (virtual_anomaly * 0.9)), 1)
        virtual_risk = round(min(100.0, virtual_anomaly * 0.95), 1)

        # 4. Predict Safety State
        violations = []
        if simulated_temp >= 95.0:
            violations.append(f"Temperature threshold breached ({simulated_temp:.1f} °C >= 95.0 °C)")
        if simulated_vib >= 4.5:
            violations.append(f"Radial vibration limit exceeded ({simulated_vib:.2f} mm/s >= 4.5 mm/s)")
        if simulated_gas >= 50.0:
            violations.append(f"Toxic/combustible gas limit exceeded ({simulated_gas:.1f} ppm >= 50.0 ppm)")

        if len(violations) >= 2 or simulated_temp >= 100.0 or simulated_vib >= 5.5:
            predicted_safety_state = "EMERGENCY"
            predicted_action = "IMMEDIATE_EMERGENCY_SHUTDOWN"
        elif violations:
            predicted_safety_state = "CRITICAL"
            predicted_action = "MANDATORY_SAFETY_THROTTLE"
        elif virtual_risk > 45.0:
            predicted_safety_state = "WARNING"
            predicted_action = "SCHEDULE_PREVENTIVE_INSPECTION"
        else:
            predicted_safety_state = "NORMAL"
            predicted_action = "MAINTAIN_CURRENT_SETPOINTS"

        recommended_actions = [
            f"Predicted State: {predicted_safety_state}. Action required: {predicted_action}."
        ]
        if violations:
            recommended_actions.append(f"Mitigate simulated stress: {' and '.join(violations)}.")

        return {
            "machine_id": machine_id,
            "live_state": {
                "temperature": latest_live["temperature"],
                "vibration": latest_live["vibration"],
                "current": latest_live["current"],
                "gas": latest_live["gas"],
                "health_score": live_asset["health_score"],
                "risk_score": live_asset["risk_score"],
                "anomaly_score": latest_live["anomaly_score"],
                "status": live_asset["status"]
            },
            "simulated_state": {
                "temperature": round(simulated_temp, 2),
                "vibration": round(simulated_vib, 2),
                "current": round(simulated_curr, 2),
                "gas": round(simulated_gas, 2),
                "health_score": virtual_health,
                "risk_score": virtual_risk,
                "anomaly_score": round(virtual_anomaly, 1),
                "status": "SIMULATED_SHUTDOWN" if predicted_safety_state == "EMERGENCY" else "SIMULATED_WARNING" if predicted_safety_state != "NORMAL" else "SIMULATED_OPERATIONAL"
            },
            "predicted_health_score": virtual_health,
            "predicted_risk_score": virtual_risk,
            "predicted_anomaly_score": round(virtual_anomaly, 1),
            "predicted_safety_state": predicted_safety_state,
            "safety_violations_predicted": violations,
            "recommended_actions": recommended_actions,
            "comparison_summary": (
                f"Under this what-if scenario, {machine_id}'s health score drops from {live_asset['health_score']} to {virtual_health}, "
                f"risk increases from {live_asset['risk_score']} to {virtual_risk}, resulting in safety state '{predicted_safety_state}'."
            )
        }
