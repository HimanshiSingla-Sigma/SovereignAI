from fastapi.testclient import TestClient
from app.digital_twin.telemetry_simulator import TelemetrySimulator

def test_what_if_simulation_state_isolation(client: TestClient, engineer_headers):
    # Step 1: Pre-seed history and capture live machine state before simulation
    TelemetrySimulator.seed_history("Machine-001", count=10)
    before_res = client.get("/api/machines/Machine-001", headers=engineer_headers)
    assert before_res.status_code == 200
    live_before = before_res.json()
    orig_health = live_before["health_score"]
    orig_status = live_before["status"]

    # Step 2: Run extreme What-If scenario (Temperature +60°C, Vibration +4.0 mm/s)
    sim_res = client.post(
        "/api/simulation/what-if",
        headers=engineer_headers,
        json={
            "machine_id": "Machine-001",
            "temp_delta": 60.0,
            "vibration_delta": 4.0,
            "current_delta": 15.0,
            "gas_delta": 30.0
        }
    )
    assert sim_res.status_code == 200
    sim_data = sim_res.json()
    assert sim_data["predicted_safety_state"] in ["CRITICAL", "EMERGENCY"]
    assert sim_data["predicted_health_score"] < orig_health

    # Step 3: Verify Live Digital Twin is COMPLETELY UNTOUCHED
    after_res = client.get("/api/machines/Machine-001", headers=engineer_headers)
    assert after_res.status_code == 200
    live_after = after_res.json()

    assert live_after["health_score"] == orig_health
    assert live_after["status"] == orig_status
    assert live_after["status"] == "OPERATIONAL"
