import os
import json
import uuid
from typing import List, Dict, Any, Optional
from app.rag.embeddings import LocalEmbeddingEngine
from app.core.config import settings

VECTOR_STORE_FILE = os.path.join(settings.VECTOR_DB_DIR, "chunks_store.json")
QDRANT_STORAGE_PATH = os.path.join(settings.VECTOR_DB_DIR, "qdrant_storage")

class LocalVectorStore:
    """
    Sovereign Hybrid Vector Store powered by Local Qdrant with JSON persistence fallback.
    Guarantees genuine local vector search, metadata filtering, and zero-cloud operation.
    """
    _qdrant_client = None
    _qdrant_initialized = False
    _collection_name = "sovereign_documents"
    _chunks: List[Dict[str, Any]] = []

    @classmethod
    def _get_qdrant(cls):
        if not cls._qdrant_initialized:
            cls._qdrant_initialized = True
            try:
                from qdrant_client import QdrantClient
                from qdrant_client.models import Distance, VectorParams

                os.makedirs(QDRANT_STORAGE_PATH, exist_ok=True)
                cls._qdrant_client = QdrantClient(path=QDRANT_STORAGE_PATH)
                collections = [c.name for c in cls._qdrant_client.get_collections().collections]
                if cls._collection_name not in collections:
                    cls._qdrant_client.create_collection(
                        collection_name=cls._collection_name,
                        vectors_config=VectorParams(size=LocalEmbeddingEngine.DIMENSION, distance=Distance.COSINE)
                    )
                print(f"[LocalVectorStore] Initialized Local Qdrant at {QDRANT_STORAGE_PATH}")
            except Exception as e:
                print(f"[LocalVectorStore] Qdrant note: Running with JSON store fallback ({e})")
                cls._qdrant_client = None
        return cls._qdrant_client

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
        client = cls._get_qdrant()
        points_to_upsert = []

        for chunk in new_chunks:
            if "embedding" not in chunk:
                content = chunk.get("content", "")
                chunk["embedding"] = LocalEmbeddingEngine.embed_text(content)
            cls._chunks.append(chunk)

            if client:
                try:
                    from qdrant_client.models import PointStruct
                    raw_id = chunk.get("chunk_id") or chunk.get("id") or str(uuid.uuid4())
                    try:
                        point_id = str(uuid.UUID(str(raw_id)))
                    except Exception:
                        point_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(raw_id)))

                    payload = {k: v for k, v in chunk.items() if k != "embedding"}
                    points_to_upsert.append(
                        PointStruct(id=point_id, vector=chunk["embedding"], payload=payload)
                    )
                except Exception as e:
                    print(f"[LocalVectorStore] PointStruct error: {e}")

        if client and points_to_upsert:
            try:
                client.upsert(collection_name=cls._collection_name, points=points_to_upsert)
            except Exception as e:
                print(f"[LocalVectorStore] Qdrant upsert error: {e}")

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
        allowed_classifications: Optional[List[str]] = None,
        machine_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        client = cls._get_qdrant()

        if client:
            try:
                from qdrant_client.models import Filter, FieldCondition, MatchValue
                must_conditions = []
                if machine_id:
                    must_conditions.append(
                        FieldCondition(key="machine_id", match=MatchValue(value=machine_id))
                    )
                query_filter = Filter(must=must_conditions) if must_conditions else None

                if hasattr(client, "query_points"):
                    res = client.query_points(
                        collection_name=cls._collection_name,
                        query=query_vector,
                        limit=top_k,
                        query_filter=query_filter
                    )
                    scored_points = res.points
                else:
                    scored_points = client.search(
                        collection_name=cls._collection_name,
                        query_vector=query_vector,
                        limit=top_k,
                        query_filter=query_filter
                    )

                results = []
                for pt in scored_points:
                    payload = pt.payload or {}
                    if allowed_classifications and payload.get("classification", "INTERNAL") not in allowed_classifications:
                        continue
                    results.append({
                        "chunk": payload,
                        "score": round(float(pt.score), 4)
                    })
                if results:
                    return results[:top_k]
            except Exception as e:
                print(f"[LocalVectorStore] Qdrant search fallback to memory: {e}")

        chunks = cls.get_all_chunks()
        results = []

        for chunk in chunks:
            if allowed_classifications:
                if chunk.get("classification", "INTERNAL") not in allowed_classifications:
                    continue
            if machine_id and chunk.get("machine_id") and chunk.get("machine_id") != machine_id:
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
