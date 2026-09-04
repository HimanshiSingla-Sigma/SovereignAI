import math
import random
import time
from datetime import datetime, timezone
from typing import Dict, List, Any
from app.digital_twin.assets import AssetRegistry

class TelemetrySimulator:
    """
    Realistic physics-grounded telemetry generator for sovereign industrial machines.
    Simulates cross-sensor relationships with deterministic profiles and historical ring-buffers.
    """
    _history: Dict[str, List[Dict[str, Any]]] = {}
    _step_counters: Dict[str, int] = {}

    @classmethod
    def get_history(cls, machine_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        if machine_id not in cls._history or len(cls._history[machine_id]) == 0:
            # Seed initial realistic history
            cls.seed_history(machine_id, count=30)
        return cls._history.get(machine_id, [])[-limit:]

    @classmethod
    def seed_history(cls, machine_id: str, count: int = 30):
        cls._history[machine_id] = []
        cls._step_counters[machine_id] = 0
        now = time.time()
        for i in range(count):
            # Step back in time
            past_time = now - (count - i) * 2.0
            iso_time = datetime.fromtimestamp(past_time, tz=timezone.utc).isoformat()
            cls.step(machine_id, timestamp_override=iso_time)

    @classmethod
    def step(cls, machine_id: str, timestamp_override: str = None) -> Dict[str, Any]:
        asset = AssetRegistry.get_by_id(machine_id)
        if not asset:
            return {}

        profile = asset.get("simulation_profile", "NORMAL")
        step_idx = cls._step_counters.get(machine_id, 0)
        cls._step_counters[machine_id] = step_idx + 1

        # Base nominal operating parameters per category
        category = asset.get("category", "CNC_MILL")
        if category == "PUMP":
            base_temp, base_vib, base_curr, base_gas = 45.0, 1.8, 22.0, 1.0
        elif category == "MOTOR":
            base_temp, base_vib, base_curr, base_gas = 55.0, 1.4, 68.0, 0.5
        elif category == "COMPRESSOR":
            base_temp, base_vib, base_curr, base_gas = 68.0, 2.1, 45.0, 3.0
        else:
            base_temp, base_vib, base_curr, base_gas = 50.0, 1.2, 20.0, 2.0

        # Sine wave harmonic fluctuation (represents cyclic rotational physics)
        harmonic = math.sin(step_idx * 0.2) * 1.5
        noise = random.uniform(-0.3, 0.3)

        if profile == "NORMAL":
            temp = base_temp + harmonic + noise
            vib = base_vib + (harmonic * 0.1) + (noise * 0.1)
            curr = base_curr + (harmonic * 0.8)
            gas = max(0.5, base_gas + (noise * 0.2))
            anomaly_score = round(max(0.5, random.uniform(1.0, 4.5)), 1)
            status = "OPERATIONAL"

        elif profile == "WARNING":
            # Rising temperature and vibration trend
            temp = base_temp + 22.0 + harmonic * 2.0 + (step_idx % 15) * 0.4
            vib = base_vib + 1.8 + (harmonic * 0.2)
            curr = base_curr + 8.5
            gas = base_gas + 4.0
            anomaly_score = round(min(55.0 + (step_idx % 20), 75.0), 1)
            status = "WARNING"

        elif profile == "CRITICAL":
            # Exceeding safety interlocks
            temp = base_temp + 42.0 + harmonic * 3.0
            vib = base_vib + 3.2 + abs(noise * 1.5)
            curr = base_curr + 24.0
            gas = base_gas + 22.0
            anomaly_score = round(min(85.0 + random.uniform(0, 10), 99.0), 1)
            status = "CRITICAL"

        elif profile == "SENSOR_ANOMALY":
            # Specific bearing fault pattern on Machine-002:
            # High localized vibration and thermal rise on spindle, but normal motor current!
            temp = 78.5 + harmonic * 1.8 + noise
            vib = 4.25 + abs(math.sin(step_idx * 0.35) * 0.6) + noise * 0.2
            curr = base_curr + 4.0  # Current is normal, indicating mechanical bearing wear, not motor stall!
            gas = 3.2 + noise * 0.2
            anomaly_score = 74.2
            status = "WARNING"

        elif profile == "FAILURE":
            temp = 98.0 + noise * 5.0
            vib = 5.8 + noise * 2.0
            curr = 5.0  # Tripped / stalled
            gas = 15.0
            anomaly_score = 98.5
            status = "SHUTDOWN"

        elif profile == "STRESS":
            # High torque load
            temp = base_temp + 18.0
            vib = base_vib + 1.0
            curr = base_curr * 1.6
            gas = base_gas + 1.0
            anomaly_score = 48.0
            status = "WARNING"

        else:
            temp, vib, curr, gas, anomaly_score, status = base_temp, base_vib, base_curr, base_gas, 2.0, "OPERATIONAL"

        t_stamp = timestamp_override or datetime.now(timezone.utc).isoformat()

        record = {
            "timestamp": t_stamp,
            "machine_id": machine_id,
            "temperature": round(temp, 2),
            "vibration": round(vib, 2),
            "current": round(curr, 2),
            "gas": round(gas, 2),
            "anomaly_score": anomaly_score,
            "machine_status": status,
            "sensor_health": {
                "temperature_sensor": True,
                "vibration_sensor": True,
                "current_sensor": True,
                "gas_sensor": True
            }
        }

        # Update in-memory history ring buffer
        if machine_id not in cls._history:
            cls._history[machine_id] = []
        cls._history[machine_id].append(record)
        if len(cls._history[machine_id]) > 60:
            cls._history[machine_id].pop(0)

        # Update current asset state
        AssetRegistry.update_asset(machine_id, {
            "status": status,
            "anomaly_score": anomaly_score,
            "health_score": round(max(0.0, 100.0 - (anomaly_score * 0.8)), 1),
            "risk_score": round(min(100.0, anomaly_score * 0.9), 1)
        })

        return record
