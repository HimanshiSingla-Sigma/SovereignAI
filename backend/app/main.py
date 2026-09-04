import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.seed_data import seed_database
from app.digital_twin.telemetry_simulator import TelemetrySimulator
from app.digital_twin.assets import AssetRegistry

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

@asynccontextmanager
async def lifespan(app: FastAPI):
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

@app.get("/api/health")
def health_check():
    return {
        "status": "HEALTHY",
        "mode": "AIR_GAPPED_LOCAL",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION
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
