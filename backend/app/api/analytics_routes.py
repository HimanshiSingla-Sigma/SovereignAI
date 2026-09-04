from fastapi import APIRouter, Depends, HTTPException
from app.core.rbac import require_permission
from app.digital_twin.correlation_engine import MultiSensorCorrelationEngine
from app.digital_twin.analytics import IndustrialAnalytics
from app.schemas.schemas import CorrelationResponse, HealthRiskResponse

router = APIRouter(prefix="/analytics", tags=["Industrial Analytics"])

@router.get("/{machine_id}/correlation", response_model=CorrelationResponse)
def get_correlation_analytics(machine_id: str, payload: dict = Depends(require_permission("telemetry:read"))):
    result = MultiSensorCorrelationEngine.analyze_machine(machine_id)
    return result

@router.get("/{machine_id}/health", response_model=HealthRiskResponse)
def get_health_and_risk(machine_id: str, payload: dict = Depends(require_permission("telemetry:read"))):
    result = IndustrialAnalytics.calculate_health_and_risk(machine_id)
    if not result:
        raise HTTPException(status_code=404, detail=f"Machine '{machine_id}' not found.")
    return result
