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
        candidates = LocalVectorStore.similarity_search(query_vec, top_k=max(25, top_k * 5))

        # 3. Lexical Keyword Scoring (BM25 heuristic) with Stopword Filtering & Reranking
        STOPWORDS = {
            "a", "about", "above", "after", "again", "against", "all", "am", "an", "and",
            "any", "are", "aren't", "as", "at", "be", "because", "been", "before", "being",
            "below", "between", "both", "but", "by", "can", "can't", "cannot", "could",
            "couldn't", "did", "didn't", "do", "does", "doesn't", "doing", "don't", "down",
            "during", "each", "few", "for", "from", "further", "had", "hadn't", "has",
            "hasn't", "have", "haven't", "having", "he", "her", "here", "hers", "herself",
            "him", "himself", "his", "how", "i", "if", "in", "into", "is", "isn't", "it",
            "its", "itself", "let's", "me", "more", "most", "mustn't", "my", "myself",
            "no", "nor", "not", "of", "off", "on", "once", "only", "or", "other", "ought",
            "our", "ours", "ourselves", "out", "over", "own", "same", "shan't", "she",
            "should", "shouldn't", "so", "some", "such", "than", "that", "the", "their",
            "theirs", "them", "themselves", "then", "there", "these", "they", "this",
            "those", "through", "to", "too", "under", "until", "up", "very", "was",
            "wasn't", "we", "were", "weren't", "what", "when", "where", "which", "while",
            "who", "whom", "why", "with", "won't", "would", "wouldn't", "you", "your",
            "yours", "yourself", "yourselves", "app", "application", "task", "main"
        }
        raw_tokens = [t.strip("?,.:;!\"'()") for t in query.lower().split()]
        meaningful_tokens = {t for t in raw_tokens if t and t not in STOPWORDS and len(t) > 2}

        # If query has no domain tokens, it is a meta/conversational query not in plant manuals
        if not meaningful_tokens:
            return []

        reranked = []
        for item in candidates:
            chunk = item["chunk"]
            base_score = item["score"]

            # Classification Clearance Check
            chunk_class = chunk.get("classification", "INTERNAL")
            if not DataClassificationManager.can_access(user_role, chunk_class):
                continue

            content_lower = chunk.get("content", "").lower()
            keyword_overlap = sum(1 for tok in meaningful_tokens if tok in content_lower)

            # Prevent irrelevant documents from matching on purely accidental dense similarity
            if keyword_overlap == 0 and base_score < 0.65:
                continue

            lexical_boost = min(0.3, keyword_overlap * 0.08)
            final_score = round(base_score + lexical_boost, 3)
            doc_id = chunk.get("doc_id") or chunk.get("document_id") or chunk.get("chunk_id", "DOC-001")
            title = chunk.get("title") or chunk.get("source") or f"Document {doc_id}"
            page_num = chunk.get("page_number", 1)
            content = chunk.get("content", "")
            if final_score >= min_score:
                reranked.append({
                    "doc_id": doc_id,
                    "title": title,
                    "page_number": page_num,
                    "snippet": content[:280] + ("..." if len(content) > 280 else ""),
                    "full_content": content,
                    "relevance_score": final_score,
                    "classification": chunk_class
                })

        reranked.sort(key=lambda x: x["relevance_score"], reverse=True)
        return reranked[:top_k]
