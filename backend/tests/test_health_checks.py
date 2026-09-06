import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_health_aggregate_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["mode"] == "AIR_GAPPED_LOCAL"
    assert "service" in data

def test_health_llm_endpoint():
    response = client.get("/health/llm")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] in ["HEALTHY", "DEGRADED"]
    assert "runtime" in data
    assert "hardware_tier" in data

def test_health_database_endpoint():
    response = client.get("/health/database")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert data["connected"] is True

def test_health_qdrant_endpoint():
    response = client.get("/health/qdrant")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "READY"
    assert "storage_path" in data

def test_health_neo4j_endpoint():
    response = client.get("/health/neo4j")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "READY"
    assert data["node_count"] > 0
    assert data["edge_count"] > 0

def test_health_mqtt_endpoint():
    response = client.get("/health/mqtt")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "READY"
    assert data["data_source"] == "SIMULATOR"
    assert data["monitored_machines"] > 0

def test_health_hardware_endpoint():
    response = client.get("/health/hardware")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "HEALTHY"
    assert "tier" in data
    assert "hardware_scan" in data
