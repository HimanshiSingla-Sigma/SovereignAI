from fastapi.testclient import TestClient

def test_list_all_digital_twins(client: TestClient, engineer_headers):
    res = client.get("/api/machines", headers=engineer_headers)
    assert res.status_code == 200
    machines = res.json()
    assert len(machines) >= 6
    machine_ids = [m["machine_id"] for m in machines]
    assert "Machine-001" in machine_ids
    assert "Machine-002" in machine_ids
    assert "Machine-003" in machine_ids
    assert "Pump-001" in machine_ids
    assert "Motor-001" in machine_ids
    assert "Compressor-001" in machine_ids

def test_machine_telemetry_and_history(client: TestClient, engineer_headers):
    res = client.get("/api/machines/Machine-002/telemetry", headers=engineer_headers)
    assert res.status_code == 200
    data = res.json()
    assert data["machine_id"] == "Machine-002"
    assert "temperature" in data
    assert "vibration" in data
    assert "current" in data
    assert "gas" in data

    hist_res = client.get("/api/machines/Machine-002/history?limit=10", headers=engineer_headers)
    assert hist_res.status_code == 200
    assert len(hist_res.json()) > 0

def test_cross_sensor_correlation_analytics(client: TestClient, engineer_headers):
    res = client.get("/api/analytics/Machine-002/correlation", headers=engineer_headers)
    assert res.status_code == 200
    data = res.json()
    assert "anomaly_score" in data
    assert "cross_sensor_inconsistencies" in data
    assert "correlation_matrix" in data

def test_health_and_risk_analytics(client: TestClient, engineer_headers):
    res = client.get("/api/analytics/Machine-002/health", headers=engineer_headers)
    assert res.status_code == 200
    data = res.json()
    assert "health_score" in data
    assert "risk_score" in data
    assert "failure_probability" in data
    assert "estimated_rul_hours" in data
    assert "maintenance_priority" in data
