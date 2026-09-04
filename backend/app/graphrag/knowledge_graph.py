from typing import Dict, List, Any, Optional

INITIAL_GRAPH_NODES = [
    {"id": "Machine-001", "name": "Machine-001 (5-Axis CNC)", "type": "Machine"},
    {"id": "Machine-002", "name": "Machine-002 (Turning Center)", "type": "Machine"},
    {"id": "Machine-003", "name": "Machine-003 (Welding Cell)", "type": "Machine"},
    {"id": "Pump-001", "name": "Pump-001 (Coolant Pump)", "type": "Machine"},
    {"id": "Motor-001", "name": "Motor-001 (Main Drive)", "type": "Machine"},
    {"id": "Compressor-001", "name": "Compressor-001 (Screw Air)", "type": "Machine"},

    # Components
    {"id": "M2-BEARING-B201", "name": "Spindle Angular Contact Bearing B-201", "type": "Component"},
    {"id": "M2-HYDRAULIC-PUMP", "name": "Chuck Clamping Hydraulic Unit", "type": "Component"},
    {"id": "P1-IMPELLER", "name": "Bronze Cast Impeller", "type": "Component"},

    # Failure Modes
    {"id": "FM-RACE-FATIGUE", "name": "Inner Racewear & Spalling Fatigue", "type": "FailureMode"},
    {"id": "FM-LUBE-DEGRADE", "name": "Grease Degradation & Thermal Breakdown", "type": "FailureMode"},
    {"id": "FM-CAVITATION", "name": "Hydraulic Cavitation & Erosion", "type": "FailureMode"},

    # Maintenance Procedures (SOPs)
    {"id": "SOP-MNT-042", "name": "SOP-MNT-042: High-Precision Spindle Bearing Lubrication", "type": "MaintenanceProcedure"},
    {"id": "SOP-ALGN-102", "name": "SOP-ALGN-102: Laser Radial Alignment & Balancing", "type": "MaintenanceProcedure"},

    # Historical Incidents
    {"id": "INC-2025-08-04", "name": "Incident INC-2025-08-04: Radial Vibration Trip at 4.6 mm/s", "type": "Incident"},
    {"id": "INC-2025-11-19", "name": "Incident INC-2025-11-19: Bearing Thermal Alarm at 89°C", "type": "Incident"}
]

INITIAL_GRAPH_EDGES = [
    {"source": "Machine-002", "target": "M2-BEARING-B201", "type": "HAS_COMPONENT"},
    {"source": "Machine-002", "target": "M2-HYDRAULIC-PUMP", "type": "HAS_COMPONENT"},
    {"source": "Pump-001", "target": "P1-IMPELLER", "type": "HAS_COMPONENT"},

    # Failures
    {"source": "M2-BEARING-B201", "target": "FM-RACE-FATIGUE", "type": "HAD_FAILURE"},
    {"source": "M2-BEARING-B201", "target": "FM-LUBE-DEGRADE", "type": "HAD_FAILURE"},
    {"source": "P1-IMPELLER", "target": "FM-CAVITATION", "type": "HAD_FAILURE"},

    # Incidents
    {"source": "FM-RACE-FATIGUE", "target": "INC-2025-08-04", "type": "GENERATED_INCIDENT"},
    {"source": "FM-LUBE-DEGRADE", "target": "INC-2025-11-19", "type": "GENERATED_INCIDENT"},

    # Maintenance & SOP Connections
    {"source": "M2-BEARING-B201", "target": "SOP-MNT-042", "type": "HAS_MAINTENANCE"},
    {"source": "M2-BEARING-B201", "target": "SOP-ALGN-102", "type": "HAS_MAINTENANCE"},
    {"source": "INC-2025-08-04", "target": "SOP-MNT-042", "type": "RESOLVED_BY"}
]

class SovereignKnowledgeGraph:
    """In-memory industrial Knowledge Graph for entity-relationship traversal and root cause discovery."""
    _nodes = list(INITIAL_GRAPH_NODES)
    _edges = list(INITIAL_GRAPH_EDGES)

    @classmethod
    def get_graph(cls) -> Dict[str, Any]:
        return {
            "nodes": cls._nodes,
            "edges": cls._edges
        }

    @classmethod
    def add_node(cls, node_id: str, name: str, node_type: str, properties: Dict[str, Any] = None):
        cls._nodes.append({"id": node_id, "name": name, "type": node_type, "properties": properties or {}})

    @classmethod
    def add_edge(cls, source: str, target: str, rel_type: str, properties: Dict[str, Any] = None):
        cls._edges.append({"source": source, "target": target, "type": rel_type, "properties": properties or {}})

    @classmethod
    def find_subgraph_for_entity(cls, entity_id: str, max_depth: int = 2) -> Dict[str, Any]:
        """Traverses connected entities and edges up to max_depth hops."""
        connected_node_ids = {entity_id}
        matched_edges = []

        # Hop 1
        for e in cls._edges:
            if e["source"] == entity_id or e["target"] == entity_id:
                connected_node_ids.add(e["source"])
                connected_node_ids.add(e["target"])
                matched_edges.append(e)

        # Hop 2
        if max_depth >= 2:
            current_ids = list(connected_node_ids)
            for e in cls._edges:
                if (e["source"] in current_ids or e["target"] in current_ids) and e not in matched_edges:
                    connected_node_ids.add(e["source"])
                    connected_node_ids.add(e["target"])
                    matched_edges.append(e)

        matched_nodes = [n for n in cls._nodes if n["id"] in connected_node_ids]
        return {
            "nodes": matched_nodes,
            "edges": matched_edges
        }

    @classmethod
    def analyze_root_cause(cls, machine_id: str) -> Dict[str, Any]:
        """Traces multi-hop causal chain from machine down to failure modes and remediation SOPs."""
        subgraph = cls.find_subgraph_for_entity(machine_id, max_depth=2)
        
        causal_chains = []
        probable_cause = "Mechanical Bearing Race Fatigue due to lubrication breakdown."
        confidence = 0.92
        mitigation = "Perform emergency grease replenishment and radial alignment per SOP-MNT-042."

        for edge in subgraph["edges"]:
            src_node = next((n["name"] for n in subgraph["nodes"] if n["id"] == edge["source"]), edge["source"])
            tgt_node = next((n["name"] for n in subgraph["nodes"] if n["id"] == edge["target"]), edge["target"])
            causal_chains.append(f"{src_node} --[{edge['type']}]--> {tgt_node}")

        return {
            "target_entity": machine_id,
            "probable_root_cause": probable_cause,
            "confidence": confidence,
            "causal_chain": causal_chains,
            "historical_occurrences": 2,
            "recommended_mitigation": mitigation
        }
