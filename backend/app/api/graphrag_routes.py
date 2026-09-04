from fastapi import APIRouter, Depends
from app.core.rbac import require_permission
from app.graphrag.knowledge_graph import SovereignKnowledgeGraph
from app.schemas.schemas import KnowledgeGraphResponse, GraphRootCauseResponse

router = APIRouter(prefix="/graphrag", tags=["Knowledge Graph (GraphRAG)"])

@router.get("/graph", response_model=KnowledgeGraphResponse)
def get_knowledge_graph(payload: dict = Depends(require_permission("graphrag:query"))):
    return SovereignKnowledgeGraph.get_graph()

@router.get("/root-cause/{machine_id}", response_model=GraphRootCauseResponse)
def get_root_cause_analysis(machine_id: str, payload: dict = Depends(require_permission("graphrag:query"))):
    return SovereignKnowledgeGraph.analyze_root_cause(machine_id)
