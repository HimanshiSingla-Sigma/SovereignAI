from fastapi import APIRouter, Depends, HTTPException
from app.core.rbac import require_permission
from app.simulation.what_if_engine import WhatIfEngine
from app.schemas.schemas import WhatIfScenarioRequest, WhatIfScenarioResponse

router = APIRouter(prefix="/simulation", tags=["What-If Simulation"])

@router.post("/what-if", response_model=WhatIfScenarioResponse)
def run_what_if_scenario(
    req: WhatIfScenarioRequest,
    payload: dict = Depends(require_permission("simulation:run"))
):
    try:
        result = WhatIfEngine.run_scenario(
            machine_id=req.machine_id,
            temp_delta=req.temp_delta,
            vibration_delta=req.vibration_delta,
            current_delta=req.current_delta,
            gas_delta=req.gas_delta,
            ambient_stress_multiplier=req.ambient_stress_multiplier,
            simulation_steps=req.simulation_steps
        )
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
