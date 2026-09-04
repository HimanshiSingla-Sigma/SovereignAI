from fastapi import APIRouter, Depends
from app.core.rbac import require_permission
from app.rag.retriever import HybridRetriever
from app.ai.gateway import model_gateway
from app.schemas.schemas import RAGQueryRequest, RAGQueryResponse, DocumentCitation

router = APIRouter(prefix="/rag", tags=["Private RAG"])

@router.post("/query", response_model=RAGQueryResponse)
def query_rag(req: RAGQueryRequest, payload: dict = Depends(require_permission("rag:query"))):
    user = payload["sub"]
    role = payload.get("role", "OPERATOR")

    # 1. Retrieve citations matching query
    citations_raw = HybridRetriever.retrieve(
        query=req.query,
        user_role=role,
        top_k=req.top_k,
        min_score=req.min_score
    )

    citations = [
        DocumentCitation(
            doc_id=c["doc_id"],
            title=c["title"],
            page_number=c["page_number"],
            snippet=c["snippet"],
            relevance_score=c["relevance_score"]
        ) for c in citations_raw
    ]

    # 2. Synthesize answer with Model Gateway
    context_chunks = [c["full_content"] for c in citations_raw]
    ai_response = model_gateway.process_request(
        prompt=req.query,
        user=user,
        task_type="GENERAL_LLM",
        context_chunks=context_chunks
    )

    return RAGQueryResponse(
        query=req.query,
        answer=ai_response["response"],
        citations=citations,
        retrieval_method="HYBRID_DENSE_LEXICAL",
        classification_checked=role
    )
