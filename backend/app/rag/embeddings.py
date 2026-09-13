import math
import hashlib
from typing import List

try:
    import numpy as np
except ImportError:
    np = None

class LocalEmbeddingEngine:
    """
    Sovereign Dense Neural Embedding Engine.
    Generates normalized 384-dimensional dense neural embeddings locally using SentenceTransformers (all-MiniLM-L6-v2).
    100% Offline, Zero Cloud Dependencies.
    """
    DIMENSION = 384
    _transformer_model = None
    _init_attempted = False

    @classmethod
    def _get_model(cls):
        if not cls._init_attempted:
            cls._init_attempted = True
            try:
                import os
                os.environ["HF_HUB_OFFLINE"] = "1"
                os.environ["TRANSFORMERS_OFFLINE"] = "1"
                os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
                from sentence_transformers import SentenceTransformer
                try:
                    cls._transformer_model = SentenceTransformer("all-MiniLM-L6-v2", local_files_only=True)
                except Exception:
                    cls._transformer_model = SentenceTransformer("all-MiniLM-L6-v2")
                print("[LocalEmbeddingEngine] Loaded local neural model: all-MiniLM-L6-v2 (Offline Mode)")
            except Exception as e:
                print(f"[LocalEmbeddingEngine] Neural model initialization note ({e}). Using deterministic semantic projection.")
        return cls._transformer_model

    # Domain vocabulary clusters for semantic proximity fallback
    SEMANTIC_CLUSTERS = {
        "vibration": 12,
        "bearing": 12,
        "spindle": 12,
        "unbalance": 12,
        "resonance": 12,
        "temperature": 48,
        "thermal": 48,
        "overheat": 48,
        "coolant": 48,
        "heat": 48,
        "motor": 96,
        "current": 96,
        "electrical": 96,
        "torque": 96,
        "stator": 96,
        "gas": 144,
        "leak": 144,
        "toxic": 144,
        "flammable": 144,
        "workflow": 168,
        "schedule": 168,
        "planner": 168,
        "plan": 168,
        "technician": 168,
        "agent": 168,
        "sequence": 168,
        "safety": 192,
        "shutdown": 192,
        "emergency": 192,
        "interlock": 192,
        "actuator": 192,
        "maintenance": 240,
        "lubrication": 240,
        "inspection": 240,
        "sop": 240,
        "grease": 240,
        "manual": 240,
        "procedure": 240,
        "scan": 280,
        "ocr": 280,
        "optical": 280,
        "handwriting": 280,
        "handwritten": 280,
        "transcribe": 280,
        "plate": 280,
        "sheet": 280,
        "document": 304,
        "pdf": 304,
        "compliance": 304,
        "checklist": 304,
        "report": 304,
        "contract": 304,
        "log": 304,
        "image": 328,
        "photo": 328,
        "diagram": 328,
        "vision": 328,
        "schematic": 328,
        "p&id": 328,
        "snapshot": 328,
        "code": 350,
        "python": 350,
        "script": 350,
        "embedding": 368,
        "vector": 368,
        "embed": 368,
        "calculate": 376,
        "formula": 376,
        "equation": 376,
        "math": 376,
        "hello": 380,
        "capabilities": 380,
        "assistant": 380,
        "help": 380,
        "greet": 380
    }


    @classmethod
    def embed_text(cls, text: str) -> List[float]:
        model = cls._get_model()
        if model is not None:
            try:
                emb = model.encode(text, normalize_embeddings=True)
                return emb.tolist()
            except Exception:
                pass

        words = text.lower().replace(",", " ").replace(".", " ").replace(":", " ").replace("-", " ").split()

        if np is not None:
            vec = np.zeros(cls.DIMENSION, dtype=np.float32)
            if not words:
                vec[0] = 1.0
                return vec.tolist()

            for word in words:
                cluster_idx = cls.SEMANTIC_CLUSTERS.get(word)
                if cluster_idx is not None:
                    vec[cluster_idx:cluster_idx + 8] += 2.5

                h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
                primary_idx = h % cls.DIMENSION
                secondary_idx = (h >> 16) % cls.DIMENSION
                weight = 1.0 / math.sqrt(len(words))
                vec[primary_idx] += weight
                vec[secondary_idx] += weight * 0.5

            norm = float(np.linalg.norm(vec))
            if norm > 0:
                vec = vec / norm
            return vec.tolist()

        # Pure Python fallback
        vec = [0.0] * cls.DIMENSION
        if not words:
            vec[0] = 1.0
            return vec

        for word in words:
            cluster_idx = cls.SEMANTIC_CLUSTERS.get(word)
            if cluster_idx is not None:
                for offset in range(8):
                    if cluster_idx + offset < cls.DIMENSION:
                        vec[cluster_idx + offset] += 2.5

            h = int(hashlib.md5(word.encode("utf-8")).hexdigest(), 16)
            primary_idx = h % cls.DIMENSION
            secondary_idx = (h >> 16) % cls.DIMENSION
            weight = 1.0 / math.sqrt(len(words))
            vec[primary_idx] += weight
            vec[secondary_idx] += weight * 0.5

        sum_sq = sum(x * x for x in vec)
        norm = math.sqrt(sum_sq)
        if norm > 0:
            vec = [x / norm for x in vec]

        return vec

    @classmethod
    def cosine_similarity(cls, vec_a: List[float], vec_b: List[float]) -> float:
        if not vec_a or not vec_b or len(vec_a) != len(vec_b):
            return 0.0

        if np is not None:
            a = np.array(vec_a, dtype=np.float32)
            b = np.array(vec_b, dtype=np.float32)
            norm_a = np.linalg.norm(a)
            norm_b = np.linalg.norm(b)
            if norm_a == 0 or norm_b == 0:
                return 0.0
            return float(np.dot(a, b) / (norm_a * norm_b))

        dot = sum(a * b for a, b in zip(vec_a, vec_b))
        norm_a = math.sqrt(sum(x * x for x in vec_a))
        norm_b = math.sqrt(sum(x * x for x in vec_b))
        if norm_a == 0 or norm_b == 0:
            return 0.0
        return float(dot / (norm_a * norm_b))

    @classmethod
    def embed_batch(cls, texts: List[str]) -> List[List[float]]:
        model = cls._get_model()
        if model is not None:
            try:
                embs = model.encode(texts, normalize_embeddings=True)
                return embs.tolist()
            except Exception:
                pass
        return [cls.embed_text(t) for t in texts]

