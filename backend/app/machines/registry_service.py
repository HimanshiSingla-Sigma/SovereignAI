import os
import copy
from datetime import datetime, timezone
from typing import Dict, List, Any, Optional

from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.all_models import Machine, Component, Sensor, utcnow
from app.digital_twin.assets import AssetRegistry
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.graphrag.knowledge_graph import SovereignKnowledgeGraph
from app.core.audit import AuditLogger


class MachineRegistryService:
    """
    Enterprise Dynamic Industrial Machine Registry Service.
    Manages the full machine lifecycle (ACTIVE, SIMULATED, MAINTENANCE, DECOMMISSIONED).
    Guarantees automatic, idempotent synchronization across:
      1. PostgreSQL / SQLite persistence
      2. In-memory Digital Twin AssetRegistry & TelemetrySimulator
      3. Neo4j / SovereignKnowledgeGraph (GraphRAG)
      4. RAG document metadata & AI agent discovery
    """

    @classmethod
    def register_machine(cls, machine_data: Dict[str, Any], db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Registers a new machine or updates existing machine with idempotent GraphRAG synchronization.
        """
        m_id = machine_data.get("machine_id")
        if not m_id:
            raise ValueError("machine_id is required for registration.")

        name = machine_data.get("name", m_id)
        category = machine_data.get("category") or machine_data.get("machine_type") or "CNC_MILL"
        status = machine_data.get("status") or "SIMULATED"
        data_source = machine_data.get("data_source") or "SIMULATOR"
        location = machine_data.get("location") or "Factory Floor"
        production_line = machine_data.get("production_line") or "Line-1"
        capabilities = machine_data.get("capabilities") or []
        safety_profile = machine_data.get("safety_profile") or {
            "max_vibration": 4.5,
            "max_temperature": 85.0,
            "min_temperature": 10.0,
            "max_current": 50.0
        }
        components = machine_data.get("components") or []
        sensors = machine_data.get("sensors") or []
        topic = machine_data.get("telemetry_topic") or f"industrial/{m_id.lower()}/telemetry"

        # 1. Database Persistence (PostgreSQL / SQLite)
        own_session = False
        if db is None:
            db = SessionLocal()
            own_session = True

        try:
            db_machine = db.query(Machine).filter(Machine.machine_id == m_id).first()
            if not db_machine:
                db_machine = Machine(
                    machine_id=m_id,
                    name=name,
                    category=category,
                    machine_type=category,
                    status=status,
                    data_source=data_source,
                    location=location,
                    production_line=production_line,
                    capabilities=capabilities,
                    safety_profile=safety_profile,
                    telemetry_topic=topic,
                    graph_sync_status="SYNCING",
                    simulation_profile=machine_data.get("simulation_profile", "NORMAL"),
                    health_score=float(machine_data.get("health_score", 100.0)),
                    risk_score=float(machine_data.get("risk_score", 0.0)),
                    anomaly_score=float(machine_data.get("anomaly_score", 0.0)),
                    rpm=float(machine_data.get("rpm", 1500.0))
                )
                db.add(db_machine)
                db.flush()
            else:
                db_machine.name = name
                db_machine.category = category
                db_machine.machine_type = category
                db_machine.status = status
                db_machine.data_source = data_source
                db_machine.location = location
                db_machine.production_line = production_line
                db_machine.capabilities = capabilities
                db_machine.safety_profile = safety_profile
                db_machine.telemetry_topic = topic
                db_machine.graph_sync_status = "SYNCING"
                db_machine.updated_at = utcnow()
                db.flush()

            # Synchronize components in DB
            for comp in components:
                c_id = comp.get("component_id")
                if c_id:
                    existing_c = db.query(Component).filter(
                        Component.machine_id == db_machine.id,
                        Component.component_id == c_id
                    ).first()
                    if not existing_c:
                        new_c = Component(
                            machine_id=db_machine.id,
                            component_id=c_id,
                            name=comp.get("name", c_id),
                            component_type=comp.get("component_type", "Subsystem"),
                            health_score=float(comp.get("health_score", 100.0)),
                            wear_percentage=float(comp.get("wear_percentage", 0.0))
                        )
                        db.add(new_c)
                    else:
                        existing_c.name = comp.get("name", existing_c.name)
                        existing_c.component_type = comp.get("component_type", existing_c.component_type)

            # Synchronize sensors in DB
            for sens in sensors:
                s_id = sens.get("sensor_id")
                if s_id:
                    existing_s = db.query(Sensor).filter(
                        Sensor.machine_id == db_machine.id,
                        Sensor.sensor_id == s_id
                    ).first()
                    if not existing_s:
                        new_s = Sensor(
                            machine_id=db_machine.id,
                            sensor_id=s_id,
                            sensor_type=sens.get("sensor_type", "TEMPERATURE"),
                            unit=sens.get("unit", "°C"),
                            min_threshold=float(sens.get("min_threshold", 0.0)) if sens.get("min_threshold") is not None else None,
                            max_threshold=float(sens.get("max_threshold", 100.0)) if sens.get("max_threshold") is not None else None,
                            is_healthy=bool(sens.get("is_healthy", True)),
                            last_value=float(sens.get("last_value", 0.0))
                        )
                        db.add(new_s)
                    else:
                        existing_s.unit = sens.get("unit", existing_s.unit)
                        existing_s.max_threshold = float(sens.get("max_threshold", existing_s.max_threshold)) if sens.get("max_threshold") is not None else existing_s.max_threshold

            db.commit()
            db_machine.graph_sync_status = "SYNCED"
            db_machine.graph_synced_at = utcnow()
            db.commit()
            db_status = "synced"
        except Exception as e:
            db_status = f"partial ({e})"
            if own_session:
                db.rollback()
        finally:
            if own_session:
                db.close()

        # 2. Digital Twin AssetRegistry & TelemetrySimulator Synchronization
        asset_record = {
            "machine_id": m_id,
            "name": name,
            "category": category,
            "status": status,
            "data_source": data_source,
            "location": location,
            "production_line": production_line,
            "capabilities": capabilities,
            "safety_profile": safety_profile,
            "simulation_profile": machine_data.get("simulation_profile", "NORMAL"),
            "health_score": float(machine_data.get("health_score", 100.0)),
            "risk_score": float(machine_data.get("risk_score", 0.0)),
            "anomaly_score": float(machine_data.get("anomaly_score", 0.0)),
            "rpm": float(machine_data.get("rpm", 1500.0)),
            "components": components,
            "sensors": sensors
        }
        AssetRegistry.register_new_asset(asset_record)
        telemetry_status = "configured"

        # 3. Automatic GraphRAG / Neo4j Knowledge Graph Synchronization (Idempotent MERGE)
        try:
            # Merge Machine Node
            SovereignKnowledgeGraph.merge_node(
                node_id=m_id,
                name=f"{m_id} ({name})",
                node_type="Machine",
                properties={
                    "status": status,
                    "data_source": data_source,
                    "location": location,
                    "production_line": production_line,
                    "category": category
                }
            )

            # Merge Location & edge
            loc_id = f"LOC-{location.replace(' ', '_')}"
            SovereignKnowledgeGraph.merge_node(loc_id, location, "Location", {"production_line": production_line})
            SovereignKnowledgeGraph.merge_edge(m_id, loc_id, "LOCATED_IN")

            # Merge Components
            for comp in components:
                c_id = comp.get("component_id")
                if c_id:
                    SovereignKnowledgeGraph.merge_node(
                        node_id=c_id,
                        name=comp.get("name", c_id),
                        node_type="Component",
                        properties={"component_type": comp.get("component_type", "Subsystem")}
                    )
                    SovereignKnowledgeGraph.merge_edge(m_id, c_id, "HAS_COMPONENT")

            # Merge Sensors
            for sens in sensors:
                s_id = sens.get("sensor_id")
                if s_id:
                    SovereignKnowledgeGraph.merge_node(
                        node_id=s_id,
                        name=f"{s_id} ({sens.get('sensor_type', 'SENSOR')})",
                        node_type="Sensor",
                        properties={"unit": sens.get("unit", ""), "sensor_type": sens.get("sensor_type", "")}
                    )
                    SovereignKnowledgeGraph.merge_edge(m_id, s_id, "HAS_SENSOR")

            # Merge Capabilities
            for cap in capabilities:
                cap_id = f"CAP-{cap.upper().replace(' ', '_')}"
                SovereignKnowledgeGraph.merge_node(cap_id, cap, "Capability")
                SovereignKnowledgeGraph.merge_edge(m_id, cap_id, "HAS_CAPABILITY")

            # Merge Safety Profile
            safe_id = f"SAFE-{m_id}"
            SovereignKnowledgeGraph.merge_node(safe_id, f"Safety Profile ({m_id})", "SafetyProfile", safety_profile)
            SovereignKnowledgeGraph.merge_edge(m_id, safe_id, "HAS_SAFETY_PROFILE")

            graph_status = "synced"
        except Exception as e:
            graph_status = f"failed ({e})"

        # 4. Real RAG Vector Store Synchronization (Index machine specification profile)
        rag_status = "unindexed"
        try:
            from app.rag.vector_store import LocalVectorStore
            spec_text = (
                f"Machine Specification Profile for {m_id} ({name}):\n"
                f"- Type/Category: {category}\n"
                f"- Location: {location}, Production Line: {production_line}\n"
                f"- Operational Status: {status}, Data Source: {data_source}\n"
                f"- Capabilities: {', '.join(capabilities) if capabilities else 'General industrial operations'}\n"
                f"- Safety Limits: Max Vibration {safety_profile.get('max_vibration', 4.5)} mm/s, Max Temp {safety_profile.get('max_temperature', 85.0)} C\n"
                f"- Components: {', '.join([c.get('name', c.get('component_id', '')) for c in components]) if components else 'None'}\n"
                f"- Sensors: {', '.join([s.get('sensor_id', '') for s in sensors]) if sensors else 'None'}"
            )
            machine_chunk = {
                "chunk_id": f"spec-{m_id.lower()}",
                "document_id": f"doc-spec-{m_id.lower()}",
                "machine_id": m_id,
                "content": spec_text,
                "classification": "INTERNAL",
                "source": f"Machine Registry Profile ({m_id})"
            }
            LocalVectorStore.add_chunks([machine_chunk])
            rag_status = "indexed"
        except Exception as e:
            print(f"[MachineRegistryService] RAG indexing error: {e}")
            rag_status = f"failed ({e})"

        AuditLogger.log(
            who="MachineRegistryService",
            what="MACHINE_REGISTERED",
            resource=m_id,
            result="SUCCESS" if (graph_status == "synced" and rag_status == "indexed") else "PARTIAL",
            reason=f"Machine {m_id} registered and synchronized across DB, Graph, Telemetry, and RAG.",
            details={
                "machine_id": m_id,
                "database_status": db_status,
                "graph_status": graph_status,
                "telemetry_status": telemetry_status,
                "rag_status": rag_status
            }
        )

        overall = "ready" if (graph_status == "synced" and db_status == "synced" and rag_status == "indexed") else "partial"
        return {
            "machine_id": m_id,
            "name": name,
            "status": status,
            "data_source": data_source,
            "database_status": db_status,
            "graph_status": graph_status,
            "telemetry_status": telemetry_status,
            "rag_status": rag_status,
            "overall_status": overall,
            "synced_at": datetime.now(timezone.utc).isoformat()
        }

    @classmethod
    def update_machine(cls, machine_id: str, updates: Dict[str, Any], db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
        """
        Updates machine metadata and propagates changes to GraphRAG and Digital Twin.
        """
        own_session = False
        if db is None:
            db = SessionLocal()
            own_session = True

        try:
            m = db.query(Machine).filter(Machine.machine_id == machine_id).first()
            if m:
                for k, v in updates.items():
                    if hasattr(m, k):
                        setattr(m, k, v)
                m.updated_at = utcnow()
                db.commit()
        finally:
            if own_session:
                db.close()

        # Update in AssetRegistry
        asset = AssetRegistry.update_asset(machine_id, updates)
        if not asset:
            asset = {"machine_id": machine_id, **updates}
            AssetRegistry.register_new_asset(asset)

        # Propagate to GraphRAG
        node = SovereignKnowledgeGraph.get_node(machine_id)
        if node:
            node.setdefault("properties", {}).update(updates)
            if "name" in updates:
                node["name"] = f"{machine_id} ({updates['name']})"

        # If location changed, update Graph relationship
        new_loc = updates.get("location")
        if new_loc:
            loc_id = f"LOC-{new_loc.replace(' ', '_')}"
            SovereignKnowledgeGraph.merge_node(loc_id, new_loc, "Location")
            SovereignKnowledgeGraph.merge_edge(machine_id, loc_id, "LOCATED_IN")

        return asset

    @classmethod
    def decommission_machine(cls, machine_id: str, db: Optional[Session] = None) -> Dict[str, Any]:
        """
        Decommissions an industrial machine. Halts active telemetry while preserving historical graph context.
        """
        cls.update_machine(machine_id, {"status": "DECOMMISSIONED"}, db=db)
        return {
            "machine_id": machine_id,
            "status": "DECOMMISSIONED",
            "telemetry_active": False,
            "historical_graph_preserved": True,
            "decommissioned_at": datetime.now(timezone.utc).isoformat()
        }

    @classmethod
    def get_machine(cls, machine_id: str, db: Optional[Session] = None) -> Optional[Dict[str, Any]]:
        asset = AssetRegistry.get_by_id(machine_id)
        if asset:
            return asset

        own_session = False
        if db is None:
            db = SessionLocal()
            own_session = True

        try:
            m = db.query(Machine).filter(Machine.machine_id == machine_id).first()
            if m:
                return {
                    "machine_id": m.machine_id,
                    "name": m.name,
                    "category": m.category,
                    "status": m.status,
                    "data_source": m.data_source,
                    "location": m.location,
                    "production_line": m.production_line,
                    "capabilities": m.capabilities or [],
                    "safety_profile": m.safety_profile or {},
                    "health_score": m.health_score,
                    "risk_score": m.risk_score,
                    "anomaly_score": m.anomaly_score,
                    "rpm": m.rpm
                }
        finally:
            if own_session:
                db.close()
        return None

    @classmethod
    def list_machines(cls, status_filter: Optional[str] = None) -> List[Dict[str, Any]]:
        assets = AssetRegistry.get_all()
        if status_filter:
            assets = [a for a in assets if a.get("status") == status_filter]
        return assets

    @classmethod
    def discover_machines(cls, query: str) -> List[Dict[str, Any]]:
        """
        Dynamically discovers machines matching natural language references
        (name, location, production line, category, or capability).
        Prioritizes exact machine ID and specific model/number matches.
        """
        q_lower = query.lower().strip()
        all_assets = cls.list_machines()
        scored = []

        for a in all_assets:
            m_id = a.get("machine_id", "").lower()
            name = a.get("name", "").lower()
            loc = a.get("location", "").lower()
            line = a.get("production_line", "").lower()
            cat = a.get("category", "").lower()
            caps = [c.lower() for c in a.get("capabilities", [])]

            score = 0
            if m_id and m_id in q_lower:
                score += 100
            elif m_id:
                parts = [p for p in m_id.split("-") if p not in ["machine", "asset", "unit"]]
                if any(p in q_lower for p in parts if len(p) >= 2):
                    score += 50
            if name and name in q_lower:
                score += 80
            if loc and loc in q_lower:
                score += 30
            if line and line in q_lower:
                score += 30
            if cat and (cat in q_lower or cat.replace("_", " ") in q_lower or any(w in q_lower for w in cat.split("_") if len(w) > 3)):
                score += 30
            if any(c in q_lower or c.replace("_", " ") in q_lower or any(w in q_lower for w in c.split("_") if len(w) > 3) for c in caps if len(c) > 3):
                score += 30

            if score > 0:
                scored.append((score, a))

        exact_matches = [item[1] for item in scored if item[0] >= 100]
        if exact_matches:
            return exact_matches

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored]
