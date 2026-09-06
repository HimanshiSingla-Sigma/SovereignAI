from typing import Dict, List, Any, Optional
from app.hardware.profile import HardwareProfile
from app.hardware.router import HardwareAwareRouter
from app.ai.task_classifier import TaskClassifier
from app.ai.inference_engine import SovereignInferenceEngine
from app.ai.prompt_guard import PromptGuard
from app.ai.output_guard import OutputGuard
from app.core.audit import AuditLogger

class ModelGateway:
    """
    Unified Sovereign AI Model Gateway.
    Classifies task intent, enforces prompt security, evaluates runtime hardware resources,
    deterministically routes to the optimal local model, sanitizes output, and audits invocations.
    """

    def __init__(self):
        self.profile = HardwareProfile()
        self.engine = SovereignInferenceEngine()

    def process_request(
        self,
        prompt: str,
        user: str,
        task_type: Optional[str] = None,
        context_chunks: Optional[List[str]] = None,
        graph_facts: Optional[List[str]] = None,
        telemetry_data: Optional[Dict[str, Any]] = None,
        conversation_history: Optional[List[Dict[str, Any]]] = None
    ) -> Dict[str, Any]:
        if conversation_history:
            history_chunks = [
                f"Prior Dialogue [{m.get('role', 'user').upper()}]: {m.get('content', '')}"
                for m in conversation_history[-6:]
            ]
            context_chunks = (history_chunks + (context_chunks or []))
        # 1. Prompt Guard: Check for Prompt Injection & Policy Violations
        guard_result = PromptGuard.inspect_prompt(prompt)
        if guard_result["decision"] == "BLOCK":
            AuditLogger.log(
                who=user,
                what="AI_PROMPT_BLOCKED",
                resource="ModelGateway",
                result="BLOCKED",
                reason="; ".join(guard_result["reasons"]),
                details={"prompt_preview": prompt[:100]}
            )
            return {
                "response": "REQUEST BLOCKED BY SOVEREIGN PROMPT GUARD: Your input violates the sovereign security policy. Prompt injection and system override attempts are prohibited and logged.",
                "model_used": "PROMPT_GUARD_SECURITY_SHIELD",
                "safety_check": "BLOCKED",
                "guard_details": guard_result
            }

        # 2. Task Classification (Explicit or Automatic Detection)
        classification = TaskClassifier.classify(
            prompt=prompt,
            explicit_task=task_type,
            has_machine=bool(telemetry_data),
            has_rag_context=bool(context_chunks),
            has_graph_facts=bool(graph_facts)
        )
        resolved_task = classification["task_type"]

        # 3. Hardware-Aware Model Selection
        routing_decision = HardwareAwareRouter.route_task(
            task_type=resolved_task,
            prompt=prompt,
            profile=self.profile
        )
        selected_model = routing_decision["selected_model"]

        # 4. Execute Local Inference
        raw_output = self.engine.generate(
            prompt=guard_result["safe_prompt"] or prompt,
            selected_model=selected_model,
            routing_decision=routing_decision,
            context_chunks=context_chunks,
            graph_facts=graph_facts,
            telemetry_data=telemetry_data,
            task_type=resolved_task
        )

        # 5. Output Guard: Exfiltration & Credential Leak Protection
        sanitized = OutputGuard.sanitize_output(raw_output["text"])

        # 6. Audit Invocation with Resource Snapshot & Routing Rationale
        AuditLogger.log(
            who=user,
            what="MODEL_INVOCATION",
            resource=raw_output["model_used"],
            result="SUCCESS",
            reason=f"Task: {resolved_task} ({routing_decision['execution_mode']})",
            details={
                "task_type": resolved_task,
                "model_id": routing_decision["selected_model_id"],
                "is_fallback": routing_decision["is_fallback"],
                "execution_mode": routing_decision["execution_mode"],
                "score": routing_decision["score"],
                "hardware_tier": self.profile.tier,
                "context_items": len(context_chunks or [])
            }
        )

        return {
            "response": sanitized["sanitized_output"],
            "model_used": raw_output["model_used"],
            "model_id": routing_decision["selected_model_id"],
            "task_type": resolved_task,
            "execution_mode": routing_decision["execution_mode"],
            "is_fallback": routing_decision["is_fallback"],
            "routing_explanation": routing_decision["reasons"],
            "hardware_snapshot": routing_decision["hardware_snapshot"],
            "resource_budget": routing_decision["resource_budget"],
            "safety_check": "PASSED" if sanitized["is_clean"] else "SANITIZED",
            "hardware_tier": self.profile.tier
        }

    def generate(
        self,
        prompt: str,
        user: str = "operator",
        task_type: Optional[str] = None,
        context_chunks: Optional[List[str]] = None,
        graph_facts: Optional[List[str]] = None,
        telemetry_data: Optional[Dict[str, Any]] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Direct generation entrypoint through Model Gateway."""
        return self.process_request(
            prompt=prompt,
            user=user,
            task_type=task_type,
            context_chunks=context_chunks,
            graph_facts=graph_facts,
            telemetry_data=telemetry_data
        )

    def chat(
        self,
        messages: List[Dict[str, str]],
        user: str = "operator",
        task_type: Optional[str] = None,
        **kwargs
    ) -> Dict[str, Any]:
        """Conversational chat entrypoint through Model Gateway."""
        history = messages[:-1] if len(messages) > 1 else []
        last_prompt = messages[-1].get("content", "") if messages else ""
        return self.process_request(
            prompt=last_prompt,
            user=user,
            task_type=task_type,
            conversation_history=history
        )

    def embed(self, texts: List[str]) -> List[List[float]]:
        """Dense local neural embedding generation through Model Gateway."""
        from app.rag.embeddings import LocalEmbeddingEngine
        if isinstance(texts, str):
            texts = [texts]
        return [LocalEmbeddingEngine.embed_text(t) for t in texts]

    def rerank(self, query: str, documents: List[Dict[str, Any]], top_k: int = 5) -> List[Dict[str, Any]]:
        """Semantic reranking through Model Gateway."""
        from app.rag.embeddings import LocalEmbeddingEngine
        query_vec = LocalEmbeddingEngine.embed_text(query)
        scored = []
        for doc in documents:
            text = doc.get("content") or doc.get("text", "")
            doc_vec = doc.get("embedding") or LocalEmbeddingEngine.embed_text(text)
            sim = LocalEmbeddingEngine.cosine_similarity(query_vec, doc_vec)
            scored.append({**doc, "rerank_score": round(sim, 4)})
        scored.sort(key=lambda x: x.get("rerank_score", 0), reverse=True)
        return scored[:top_k]

    def vision(self, image_path: str) -> Dict[str, Any]:
        """Local vision inference through Model Gateway."""
        from app.agents.specialized.vision_agent import VisionInspectionAgent
        return VisionInspectionAgent().analyze_image(image_path)

    def classify(self, text: str, categories: Optional[List[str]] = None) -> Dict[str, Any]:
        """Intent / Task classification through Model Gateway."""
        return TaskClassifier.classify(prompt=text)

    def get_model_health(self) -> Dict[str, Any]:
        """
        Tests actual availability and health of local models and runtime dependencies.
        Never fabricates health status.
        """
        status = self.engine.get_active_status()
        llama_ok = status.get("llama_cpp_installed", False)
        active_model = status.get("active_model_name", "None")

        return {
            "status": "HEALTHY" if llama_ok else "DEGRADED",
            "runtime": "llama-cpp-python / local-gguf",
            "runtime_status": "READY" if llama_ok else "NOT_INSTALLED",
            "active_model": active_model,
            "is_loaded_in_memory": status.get("is_loaded_in_memory", False),
            "is_fallback": status.get("is_fallback", True),
            "hardware_tier": self.profile.tier,
            "max_model_ram_gb": self.profile.max_model_ram_gb,
            "max_model_vram_gb": self.profile.max_model_vram_gb
        }

    def get_available_models(self) -> List[Dict[str, Any]]:
        from app.hardware.registry import ModelRegistry
        return ModelRegistry.list_models()

model_gateway = ModelGateway()
