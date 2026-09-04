from typing import Dict, List, Any
from app.rag.retriever import HybridRetriever
from app.graphrag.knowledge_graph import SovereignKnowledgeGraph

class UnifiedEvidenceRetriever:
    """
    Synthesizes unstructured text chunks (RAG) and structured entity graphs (GraphRAG)
    into a cohesive evidence package for AI reasoning.
    """

    @classmethod
    def get_evidence(
        cls,
        query: str,
        machine_id: str = None,
        user_role: str = "ENGINEER"
    ) -> Dict[str, Any]:
        # 1. Unstructured RAG Retrieval
        rag_citations = HybridRetriever.retrieve(query=query, user_role=user_role, top_k=3)
        context_chunks = [c["full_content"] for c in rag_citations]

        # 2. Structured GraphRAG Subgraph Traversal
        graph_facts = []
        target_machine = machine_id
        if not target_machine:
            for m in ["Machine-001", "Machine-002", "Machine-003", "Pump-001", "Motor-001", "Compressor-001"]:
                if m.lower() in query.lower():
                    target_machine = m
                    break

        if target_machine:
            rc = SovereignKnowledgeGraph.analyze_root_cause(target_machine)
            graph_facts = rc["causal_chain"]

        return {
            "rag_citations": rag_citations,
            "context_chunks": context_chunks,
            "graph_facts": graph_facts,
            "target_machine": target_machine
        }
