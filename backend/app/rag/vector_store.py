import os
import json
from typing import List, Dict, Any, Optional
from app.rag.embeddings import LocalEmbeddingEngine
from app.core.config import settings

VECTOR_STORE_FILE = os.path.join(settings.VECTOR_DB_DIR, "chunks_store.json")

class LocalVectorStore:
    """
    In-memory and JSON-backed sovereign vector store.
    Supports persistent storage, classification filtering, and dense cosine similarity search.
    """
    _chunks: List[Dict[str, Any]] = []

    @classmethod
    def load_from_disk(cls):
        if os.path.exists(VECTOR_STORE_FILE):
            try:
                with open(VECTOR_STORE_FILE, "r", encoding="utf-8") as f:
                    cls._chunks = json.load(f)
            except Exception:
                cls._chunks = []

    @classmethod
    def save_to_disk(cls):
        try:
            with open(VECTOR_STORE_FILE, "w", encoding="utf-8") as f:
                json.dump(cls._chunks, f)
        except Exception as e:
            print(f"Warning: Failed to persist vector store: {e}")

    @classmethod
    def add_chunks(cls, new_chunks: List[Dict[str, Any]]):
        cls.load_from_disk()
        for chunk in new_chunks:
            if "embedding" not in chunk:
                chunk["embedding"] = LocalEmbeddingEngine.embed_text(chunk["content"])
            cls._chunks.append(chunk)
        cls.save_to_disk()

    @classmethod
    def get_all_chunks(cls) -> List[Dict[str, Any]]:
        if not cls._chunks:
            cls.load_from_disk()
        return cls._chunks

    @classmethod
    def similarity_search(
        cls,
        query_vector: List[float],
        top_k: int = 4,
        allowed_classifications: Optional[List[str]] = None
    ) -> List[Dict[str, Any]]:
        chunks = cls.get_all_chunks()
        results = []

        for chunk in chunks:
            if allowed_classifications:
                if chunk.get("classification", "INTERNAL") not in allowed_classifications:
                    continue

            emb = chunk.get("embedding")
            if not emb:
                continue

            sim = LocalEmbeddingEngine.cosine_similarity(query_vector, emb)
            results.append({
                "chunk": chunk,
                "score": round(sim, 4)
            })

        results.sort(key=lambda x: x["score"], reverse=True)
        return results[:top_k]
