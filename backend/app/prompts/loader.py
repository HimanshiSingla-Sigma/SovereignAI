import os
from typing import Dict, Optional

class PromptLoader:
    """
    Centralized loader for system and agent prompt templates.
    Loads from disk with in-memory caching and guaranteed safe fallbacks.
    """
    _cache: Dict[str, str] = {}
    _base_dir = os.path.dirname(os.path.abspath(__file__))

    @classmethod
    def load(cls, relative_path: str) -> str:
        """
        Load a prompt file by relative path from the prompts directory.
        e.g. PromptLoader.load("orchestrator/system.txt")
        """
        if relative_path in cls._cache:
            return cls._cache[relative_path]

        full_path = os.path.join(cls._base_dir, relative_path)
        if os.path.exists(full_path):
            try:
                with open(full_path, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    cls._cache[relative_path] = content
                    return content
            except Exception as e:
                print(f"Warning: Failed to read prompt file {full_path}: {e}")

        # Fallback to internal defaults if file missing
        default_content = cls._get_default_prompt(relative_path)
        cls._cache[relative_path] = default_content
        return default_content

    @classmethod
    def clear_cache(cls):
        cls._cache.clear()

    @classmethod
    def _get_default_prompt(cls, key: str) -> str:
        if "system.txt" in key or "planner.txt" in key:
            return (
                "You are the Sovereign Industrial AI Workbench Agent Planner ('The Brain').\n"
                "Your role is to formulate structured, deterministic task plans for plant operations.\n"
                "SPECIALIZED AGENTS AND STRICT BOUNDARIES:\n"
                "- TELEMETRY: Fetches live sensor streams, vibration, temperature, RPM, digital twin metrics, and knowledge graph causal chains. NEVER use RAG for sensor metrics!\n"
                "- RAG: Retrieves static technical documentation, standard operating procedures (SOPs), manuals, and compliance guidelines. NEVER use TELEMETRY for manuals!\n"
                "- SAFETY_CONTROL: Checks deterministic safety limits OR commands physical actuators. Informational rule checks do NOT require human approval; actuator actions unconditionally require Safety Officer sign-off.\n"
                "- VISION_OCR: Extracts text from scanned PDFs, maintenance sheets, and technical diagrams.\n"
                "- REASONING: Synthesizes multi-source diagnostic reports, executes math/code calculations, and responds to general inquiries.\n"
            )
        elif "telemetry" in key:
            return (
                "You are the Telemetry and Digital Twin Agent. You inspect live sensor streams (temperature, "
                "vibration, RPM), correlate multi-sensor anomalies, and traverse causal knowledge graphs."
            )
        elif "rag" in key:
            return (
                "You are the RAG (Retrieval-Augmented Generation) Agent. You retrieve and ground operational answers "
                "in standard operating procedures (SOPs) and technical engineering manuals."
            )
        elif "safety" in key:
            return (
                "You are the Safety & Actuator Interlock Agent. You evaluate physical safety thresholds "
                "and enforce deterministic Human-in-the-Loop approvals for all physical machine commands."
            )
        elif "reasoning" in key:
            return (
                "You are the Reasoning & Diagnostic Synthesis Agent. You provide engineering root cause analysis "
                "by combining empirical telemetry, procedural SOPs, and causal graph facts."
            )
        elif "vision" in key or "ocr" in key:
            return (
                "You are the Vision & OCR Agent. You extract structured technical data from scanned inspection "
                "sheets, calibration logs, and engineering drawings using offline local models."
            )
        return "You are an AI assistant in the Sovereign Industrial AI Workbench."
