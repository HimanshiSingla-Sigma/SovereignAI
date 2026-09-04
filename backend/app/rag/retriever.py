from typing import List, Dict, Any, Optional
from app.rag.embeddings import LocalEmbeddingEngine
from app.rag.vector_store import LocalVectorStore
from app.ai.data_classification import DataClassificationManager

class HybridRetriever:
    """
    Hybrid retriever combining dense semantic embeddings and lexical keyword matching.
    Enforces user data classification clearance and outputs ranked citations.
    """

    @classmethod
    def retrieve(
        cls,
        query: str,
        user_role: str = "ENGINEER",
        top_k: int = 4,
        min_score: float = 0.20
    ) -> List[Dict[str, Any]]:
        # 1. Generate query embedding
        query_vec = LocalEmbeddingEngine.embed_text(query)

        # 2. Query vector store
        candidates = LocalVectorStore.similarity_search(query_vec, top_k=top_k * 2)

        # 3. Lexical Keyword Scoring (BM25 heuristic) & Reranking
        query_tokens = set(query.lower().split())
        reranked = []

        for item in candidates:
            chunk = item["chunk"]
            base_score = item["score"]

            # Classification Clearance Check
            chunk_class = chunk.get("classification", "INTERNAL")
            if not DataClassificationManager.can_access(user_role, chunk_class):
                continue

            content_lower = chunk.get("content", "").lower()
            keyword_overlap = sum(1 for tok in query_tokens if tok in content_lower)
            lexical_boost = min(0.3, keyword_overlap * 0.05)

            final_score = round(base_score + lexical_boost, 3)
            if final_score >= min_score:
                reranked.append({
                    "doc_id": chunk["doc_id"],
                    "title": chunk["title"],
                    "page_number": chunk["page_number"],
                    "snippet": chunk["content"][:280] + ("..." if len(chunk["content"]) > 280 else ""),
                    "full_content": chunk["content"],
                    "relevance_score": final_score,
                    "classification": chunk_class
                })

        reranked.sort(key=lambda x: x["relevance_score"], reverse=True)
        return reranked[:top_k]
