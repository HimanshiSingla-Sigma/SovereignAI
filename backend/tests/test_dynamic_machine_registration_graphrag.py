import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import SessionLocal, Base, engine
from app.models.all_models import Machine, Component, Sensor
from app.machines.registry_service import MachineRegistryService
from app.graphrag.knowledge_graph import SovereignKnowledgeGraph
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.agents.tools.registry import ToolRegistry

client = TestClient(app)

@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield

def test_dynamic_machine_registration_and_postgres_persistence():
    """Test 1 & 2: Dynamic registration of a new machine and DB persistence."""
    machine_data = {
        "machine_id": "Machine-TEST-001",
        "name": "High-Tonnage Hydraulic Press",
        "category": "HYDRAULIC_PRESS",
        "status": "SIMULATED",
        "data_source": "SIMULATOR",
        "location": "Stamping Cell B",
        "production_line": "Line-4",
        "capabilities": ["DEEP_DRAWING", "HOT_FORMING"],
        "safety_profile": {
            "max_hydraulic_pressure_bar": 250.0,
            "max_oil_temp_c": 75.0
        },
        "components": [
            {"component_id": "P01-RAM", "name": "Hydraulic Main Ram", "component_type": "Actuator"},
            {"component_id": "P01-VALVE", "name": "Proportional Relief Valve", "component_type": "Hydraulics"}
        ],
        "sensors": [
            {"sensor_id": "P01-PRESS-01", "sensor_type": "PRESSURE", "unit": "bar", "max_threshold": 260.0},
            {"sensor_id": "P01-TEMP-01", "sensor_type": "TEMPERATURE", "unit": "°C", "max_threshold": 80.0}
        ]
    }

    report = MachineRegistryService.register_machine(machine_data)
    assert report["machine_id"] == "Machine-TEST-001"
    assert report["database_status"] == "synced"
    assert report["graph_status"] == "synced"
    assert report["data_source"] == "SIMULATOR"

    # Verify DB persistence
    db = SessionLocal()
    try:
        m = db.query(Machine).filter(Machine.machine_id == "Machine-TEST-001").first()
        assert m is not None
        assert m.name == "High-Tonnage Hydraulic Press"
        assert m.data_source == "SIMULATOR"
        assert m.location == "Stamping Cell B"
        assert m.production_line == "Line-4"
        assert "DEEP_DRAWING" in m.capabilities

        comps = db.query(Component).filter(Component.machine_id == m.id).all()
        assert len(comps) == 2

        sens = db.query(Sensor).filter(Sensor.machine_id == m.id).all()
        assert len(sens) == 2
    finally:
        db.close()

def test_automatic_graphrag_synchronization_and_idempotency():
    """Test 3 & 4: Automatic GraphRAG / Neo4j synchronization and Idempotent MERGE."""
    m_id = "Machine-TEST-001"

    # Verify node creation in Knowledge Graph
    node = SovereignKnowledgeGraph.get_node(m_id)
    assert node is not None
    assert node["type"] == "Machine"
    assert node["properties"]["status"] == "SIMULATED"
    assert node["properties"]["data_source"] == "SIMULATOR"

    # Verify relationships
    subgraph = SovereignKnowledgeGraph.find_subgraph_for_entity(m_id, max_depth=2)
    edge_types = {e["type"] for e in subgraph["edges"]}
    assert "HAS_COMPONENT" in edge_types
    assert "HAS_SENSOR" in edge_types
    assert "LOCATED_IN" in edge_types
    assert "HAS_CAPABILITY" in edge_types
    assert "HAS_SAFETY_PROFILE" in edge_types

    initial_node_count = len(SovereignKnowledgeGraph._nodes)
    initial_edge_count = len(SovereignKnowledgeGraph._edges)

    # Re-synchronize identical machine data (Idempotency check)
    machine_data = MachineRegistryService.get_machine(m_id)
    MachineRegistryService.register_machine(machine_data)

    assert len(SovereignKnowledgeGraph._nodes) == initial_node_count, "Nodes should not be duplicated"
    assert len(SovereignKnowledgeGraph._edges) == initial_edge_count, "Edges should not be duplicated"

def test_telemetry_simulation_with_simulator_tagging():
    """Test 6 & 8: Telemetry generation tagged as SIMULATOR."""
    m_id = "Machine-TEST-001"
    point = TelemetrySimulator.step(m_id)

    assert point is not None
    assert point["machine_id"] == m_id
    assert point["data_source"] == "SIMULATOR"
    assert "temperature" in point
    assert "vibration" in point

def test_ai_machine_discovery_tool():
    """Test 5: AI tool dynamically discovers machine without hardcoding."""
    # Query matching by location
    res_loc = ToolRegistry.execute_tool(
        tool_name="discover_machines",
        args={"query": "Stamping Cell B"},
        user="operator",
        user_role="ENGINEER"
    )
    assert res_loc["status"] == "SUCCESS"
    matched_ids = [m["machine_id"] for m in res_loc["result"]]
    assert "Machine-TEST-001" in matched_ids

    # Query matching by capability
    res_cap = ToolRegistry.execute_tool(
        tool_name="discover_machines",
        args={"query": "hydraulic deep drawing press"},
        user="operator",
        user_role="ENGINEER"
    )
    assert res_cap["status"] == "SUCCESS"
    matched_cap_ids = [m["machine_id"] for m in res_cap["result"]]
    assert "Machine-TEST-001" in matched_cap_ids

def test_dynamic_graphrag_root_cause_analysis():
    """Test 7: Knowledge Graph analysis on newly registered machine reports true topology without fake failures."""
    m_id = "Machine-TEST-001"
    analysis = SovereignKnowledgeGraph.analyze_root_cause(m_id)

    assert analysis["target_entity"] == m_id
    assert "P01-RAM" in analysis["connected_components"]
    assert "P01-PRESS-01 (PRESSURE)" in analysis["connected_sensors"]
    assert "No historical or active failure modes identified" in analysis["probable_root_cause"]
    assert "operating within nominal parameters" in analysis["recommended_mitigation"]

def test_machine_update_synchronization():
    """Test 8: Machine update dynamically propagates to DB and Graph."""
    m_id = "Machine-TEST-001"
    updates = {
        "location": "Stamping Bay Line-C",
        "status": "MAINTENANCE"
    }

    updated = MachineRegistryService.update_machine(m_id, updates)
    assert updated["location"] == "Stamping Bay Line-C"
    assert updated["status"] == "MAINTENANCE"

    # Verify Graph node updated
    node = SovereignKnowledgeGraph.get_node(m_id)
    assert node["properties"]["location"] == "Stamping Bay Line-C"
    assert node["properties"]["status"] == "MAINTENANCE"

    # Verify Graph LOCATED_IN edge updated
    subgraph = SovereignKnowledgeGraph.find_subgraph_for_entity(m_id, max_depth=1)
    locations = [e["target"] for e in subgraph["edges"] if e["type"] == "LOCATED_IN"]
    assert "LOC-Stamping_Bay_Line-C" in locations

def test_machine_decommissioning_lifecycle():
    """Test 9: Decommissioning transitions status to DECOMMISSIONED while preserving historical graph context."""
    m_id = "Machine-TEST-001"
    res = MachineRegistryService.decommission_machine(m_id)

    assert res["status"] == "DECOMMISSIONED"
    assert res["telemetry_active"] is False
    assert res["historical_graph_preserved"] is True

    node = SovereignKnowledgeGraph.get_node(m_id)
    assert node["properties"]["status"] == "DECOMMISSIONED"
    # Graph relationships still exist for post-mortem audit
    subgraph = SovereignKnowledgeGraph.find_subgraph_for_entity(m_id, max_depth=1)
    assert len(subgraph["edges"]) > 0
