import os
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.seed_data import seed_database
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.digital_twin.assets import AssetRegistry

from app.core.database import Base, engine
from app.models import all_models  # Ensure all models are registered with Base.metadata

# Import all routers
from app.api.auth_routes import router as auth_router
from app.api.user_routes import router as user_router
from app.api.role_routes import router as role_router
from app.api.digital_twin_routes import router as twin_router
from app.api.telemetry_routes import router as telemetry_router
from app.api.analytics_routes import router as analytics_router
from app.api.safety_routes import router as safety_router
from app.api.approval_routes import router as approval_router
from app.api.simulation_routes import router as simulation_router
from app.api.document_routes import router as document_router
from app.api.rag_routes import router as rag_router
from app.api.graphrag_routes import router as graphrag_router
from app.api.ai_routes import router as ai_router
from app.api.hardware_routes import router as hardware_router
from app.api.audit_routes import router as audit_router
from app.api.security_routes import router as security_router
from app.api.network_routes import router as network_router
from app.api.document_page_routes import router as document_page_router
from app.api.orchestrator_routes import router as orchestrator_router
from app.api.conversation_routes import router as conversation_router

# Ensure all tables exist immediately upon import
Base.metadata.create_all(bind=engine)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ensure all tables (including conversations and messages) exist
    Base.metadata.create_all(bind=engine)
    # Initialize asset registry & seed DB if necessary
    AssetRegistry.initialize()
    try:
        seed_database()
    except Exception as e:
        print(f"Notice: Seed check completed ({e})")
    yield

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.BACKEND_CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount all Routers
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(user_router, prefix=settings.API_V1_STR)
app.include_router(role_router, prefix=settings.API_V1_STR)
app.include_router(twin_router, prefix=settings.API_V1_STR)
app.include_router(telemetry_router, prefix=settings.API_V1_STR)
app.include_router(analytics_router, prefix=settings.API_V1_STR)
app.include_router(safety_router, prefix=settings.API_V1_STR)
app.include_router(approval_router, prefix=settings.API_V1_STR)
app.include_router(simulation_router, prefix=settings.API_V1_STR)
app.include_router(document_router, prefix=settings.API_V1_STR)
app.include_router(rag_router, prefix=settings.API_V1_STR)
app.include_router(graphrag_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)
app.include_router(hardware_router, prefix=settings.API_V1_STR)
app.include_router(audit_router, prefix=settings.API_V1_STR)
app.include_router(security_router, prefix=settings.API_V1_STR)
app.include_router(network_router, prefix=settings.API_V1_STR)
app.include_router(document_page_router, prefix=settings.API_V1_STR)
app.include_router(orchestrator_router, prefix=settings.API_V1_STR)
app.include_router(conversation_router, prefix=settings.API_V1_STR)

from sqlalchemy import text
from app.ai.gateway import model_gateway
from app.graphrag.knowledge_graph import SovereignKnowledgeGraph
from app.hardware.detector import HardwareDetector

@app.get("/health")
@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "mode": "AIR_GAPPED_LOCAL",
        "deployment_mode": getattr(settings, "DEPLOYMENT_MODE", "air_gapped"),
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
    }

@app.get("/health/llm")
@app.get("/api/health/llm")
def health_llm():
    return model_gateway.get_model_health()

@app.get("/health/database")
@app.get("/api/health/database")
def health_database():
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        return {
            "status": "HEALTHY",
            "database": "postgresql" if "postgresql" in settings.DATABASE_URL else "sqlite",
            "connected": True
        }
    except Exception as e:
        return {"status": "UNHEALTHY", "error": str(e), "connected": False}

@app.get("/health/qdrant")
@app.get("/api/health/qdrant")
def health_qdrant():
    storage_exists = os.path.exists(settings.VECTOR_DB_DIR)
    return {
        "status": "READY",
        "mode": "local_vector_store",
        "storage_path": settings.VECTOR_DB_DIR,
        "storage_initialized": storage_exists
    }

@app.get("/health/neo4j")
@app.get("/api/health/neo4j")
def health_neo4j():
    g = SovereignKnowledgeGraph.get_graph()
    return {
        "status": "READY",
        "mode": "local_sovereign_graphrag",
        "node_count": len(g.get("nodes", [])),
        "edge_count": len(g.get("edges", []))
    }

@app.get("/health/mqtt")
@app.get("/api/health/mqtt")
def health_mqtt():
    assets = AssetRegistry.get_all()
    return {
        "status": "READY",
        "mode": "local_industrial_telemetry_gateway",
        "data_source": "SIMULATOR",
        "monitored_machines": len(assets)
    }

@app.get("/health/hardware")
@app.get("/api/health/hardware")
def health_hardware():
    scan = HardwareDetector.get_full_hardware_scan()
    return {
        "status": "HEALTHY",
        "tier": model_gateway.profile.tier,
        "max_ram_budget_gb": model_gateway.profile.max_model_ram_gb,
        "max_vram_budget_gb": model_gateway.profile.max_model_vram_gb,
        "hardware_scan": scan
    }

# Real-Time WebSocket Telemetry Stream
@app.websocket("/ws/telemetry/{machine_id}")
async def websocket_telemetry_endpoint(websocket: WebSocket, machine_id: str):
    await websocket.accept()
    try:
        while True:
            # Generate next dynamic physical telemetry point
            point = TelemetrySimulator.step(machine_id)
            await websocket.send_json(point)
            await asyncio.sleep(1.5)
    except WebSocketDisconnect:
        pass
    except Exception:
        await websocket.close()

# Mount Frontend Single-Page App if dist exists (Portable SSD Single-Server Mode)
from fastapi.staticfiles import StaticFiles
dist_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "frontend", "dist")
if os.path.isdir(dist_path):
    app.mount("/", StaticFiles(directory=dist_path, html=True), name="frontend")
