import os
from typing import Dict, List, Any, Optional
from app.hardware.profile import HardwareTier
from app.hardware.gguf_reader import GGUFMetadataReader
from app.core.config import settings

class ModelRegistry:
    """
    Catalog and dynamic scanner of AI models, parameter sizes, quantizations,
    and hardware requirements. Automatically discovers local GGUF models from
    settings.LOCAL_MODEL_PATH and maintains the Sovereign Native Deterministic Fallback.
    """

    NATIVE_FALLBACK: Dict[str, Any] = {
        "model_id": "sovereign-neural-cpu-1b",
        "name": "Sovereign Industrial Reasoner (Native Deterministic Fallback)",
        "model_type": "GENERAL_LLM",
        "supported_tasks": ["GENERAL_LLM", "REASONING", "AGENT_PLANNER", "SOP_RAG"],
        "parameters": "Deterministic In-Memory Engine",
        "parameters_b": 0.0,
        "quantization": "Native In-Process Python",
        "ram_required_gb": 0.4,
        "vram_required_gb": 0.0,
        "cpu_compatible": True,
        "gpu_compatible": True,
        "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
        "context_length": 4096,
        "file_size_gb": 0.0,
        "disk_size_gb": 0.0,
        "is_fallback": True,
        "is_installed": True,
        "model_path": None,
        "priority": 10,
        "description": "Zero-dependency sovereign industrial reasoner running natively in memory with deterministic safety rule evaluation."
    }

    STATIC_CATALOG: List[Dict[str, Any]] = [
        {
            "model_id": "qwen2.5-0.5b-instruct-q4",
            "name": "Qwen 2.5 0.5B Instruct (GGUF)",
            "model_type": "GENERAL_LLM",
            "supported_tasks": ["GENERAL_LLM", "SOP_RAG", "CODE", "PYTHON_EXECUTION", "CALCULATOR", "REASONING", "AGENT_PLANNER"],
            "parameters": "0.5B",
            "parameters_b": 0.5,
            "quantization": "Q4_K_M",
            "ram_required_gb": 0.7,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 4096,
            "recommended_filename": "qwen2.5-0.5b-instruct-q4_k_m.gguf",
            "disk_size_gb": 0.35,
            "file_size_gb": 0.35,
            "is_fallback": False,
            "is_installed": False,
            "priority": 50,
            "description": "Ultra-compact general instruction model optimized for low-spec dual-core laptops and low RAM."
        },
        {
            "model_id": "smollm2-1.7b-instruct-q4",
            "name": "SmolLM2 1.7B Instruct (GGUF)",
            "model_type": "REASONING",
            "supported_tasks": ["REASONING", "AGENT_PLANNER", "GENERAL_LLM"],
            "parameters": "1.7B",
            "parameters_b": 1.7,
            "quantization": "Q4_K_M",
            "ram_required_gb": 1.6,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 4096,
            "recommended_filename": "smollm2-1.7b-instruct-q4_k_m.gguf",
            "disk_size_gb": 1.05,
            "file_size_gb": 1.05,
            "is_fallback": False,
            "is_installed": False,
            "priority": 80,
            "description": "Balanced agentic reasoning model for root-cause analysis and telemetry diagnostics on CPU."
        },
        {
            "model_id": "qwen2.5-1.5b-instruct-q4",
            "name": "Qwen 2.5 1.5B Instruct (GGUF)",
            "model_type": "AGENT_PLANNER",
            "supported_tasks": ["AGENT_PLANNER", "GENERAL_LLM", "SOP_RAG"],
            "parameters": "1.5B",
            "parameters_b": 1.5,
            "quantization": "Q4_K_M",
            "ram_required_gb": 1.5,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 4096,
            "recommended_filename": "qwen2.5-1.5b-instruct-q4_k_m.gguf",
            "disk_size_gb": 0.98,
            "file_size_gb": 0.98,
            "is_fallback": False,
            "is_installed": False,
            "priority": 75,
            "description": "Deterministic agentic planner for actuator control sequences and safety interlock verification."
        },
        {
            "model_id": "llama-3.2-1b-instruct-q4",
            "name": "Llama 3.2 1B Instruct (GGUF)",
            "model_type": "SOP_RAG",
            "supported_tasks": ["SOP_RAG", "GENERAL_LLM"],
            "parameters": "1.2B",
            "parameters_b": 1.2,
            "quantization": "Q4_K_M",
            "ram_required_gb": 1.1,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 4096,
            "recommended_filename": "llama-3.2-1b-instruct-q4_k_m.gguf",
            "disk_size_gb": 0.74,
            "file_size_gb": 0.74,
            "is_fallback": False,
            "is_installed": False,
            "priority": 70,
            "description": "High-precision document parsing and technical manual SOP compliance QA for low-memory CPU."
        },
        {
            "model_id": "llama-3.2-3b-instruct-q4",
            "name": "Llama 3.2 3B Instruct (GGUF)",
            "model_type": "REASONING",
            "supported_tasks": ["REASONING", "AGENT_PLANNER", "SOP_RAG", "GENERAL_LLM"],
            "parameters": "3.2B",
            "parameters_b": 3.2,
            "quantization": "Q4_K_M",
            "ram_required_gb": 2.8,
            "vram_required_gb": 3.2,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_2_MID_CPU,
            "context_length": 8192,
            "recommended_filename": "llama-3.2-3b-instruct-q4_k_m.gguf",
            "disk_size_gb": 2.0,
            "file_size_gb": 2.0,
            "is_fallback": False,
            "is_installed": False,
            "priority": 85,
            "description": "Mid-tier reasoning model for quad-core and high-RAM workstations or 4GB VRAM GPUs."
        },
        {
            "model_id": "mistral-7b-instruct-v0.3-q4",
            "name": "Mistral 7B Instruct v0.3 (GGUF)",
            "model_type": "GENERAL_LLM",
            "supported_tasks": ["GENERAL_LLM", "REASONING", "AGENT_PLANNER", "SOP_RAG"],
            "parameters": "7.3B",
            "parameters_b": 7.3,
            "quantization": "Q4_K_M",
            "ram_required_gb": 5.8,
            "vram_required_gb": 5.5,
            "cpu_compatible": False,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_3_GPU_DESKTOP,
            "context_length": 8192,
            "recommended_filename": "mistral-7b-instruct-v0.3-q4_k_m.gguf",
            "disk_size_gb": 4.37,
            "file_size_gb": 4.37,
            "is_fallback": False,
            "is_installed": False,
            "priority": 90,
            "description": "High-accuracy open model for workstations with dedicated 6GB+ NVIDIA GPUs."
        },
        {
            "model_id": "qwen2.5-14b-instruct-q4",
            "name": "Qwen 2.5 14B Instruct (GGUF)",
            "model_type": "REASONING",
            "supported_tasks": ["REASONING", "AGENT_PLANNER", "GENERAL_LLM"],
            "parameters": "14.7B",
            "parameters_b": 14.7,
            "quantization": "Q4_K_M",
            "ram_required_gb": 11.2,
            "vram_required_gb": 12.0,
            "cpu_compatible": False,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_4_SERVER,
            "context_length": 16384,
            "recommended_filename": "qwen2.5-14b-instruct-q4_k_m.gguf",
            "disk_size_gb": 8.99,
            "file_size_gb": 8.99,
            "is_fallback": False,
            "is_installed": False,
            "priority": 95,
            "description": "Enterprise-grade model for dedicated industrial servers with NVIDIA A100/H100."
        },
        {
            "model_id": "local-semantic-embedding",
            "name": "Sovereign Industrial Dense Embedder",
            "model_type": "EMBEDDING",
            "supported_tasks": ["EMBEDDING"],
            "parameters": "384-Dim",
            "parameters_b": 0.05,
            "quantization": "FP32",
            "ram_required_gb": 0.2,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 512,
            "file_size_gb": 0.13,
            "disk_size_gb": 0.13,
            "is_fallback": False,
            "is_installed": True,
            "priority": 99,
            "description": "Normalized semantic vector space for RAG document chunk retrieval."
        },
        {
            "model_id": "local-cpu-ocr-engine",
            "name": "Sovereign OCR & Document Intelligence",
            "model_type": "OCR",
            "supported_tasks": ["OCR", "DOCUMENT_ANALYSIS"],
            "parameters": "Lightweight",
            "parameters_b": 0.1,
            "quantization": "Native",
            "ram_required_gb": 0.3,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 2048,
            "file_size_gb": 0.05,
            "disk_size_gb": 0.05,
            "is_fallback": False,
            "is_installed": True,
            "priority": 99,
            "description": "CPU-friendly document parser for scanned PDFs, engineering drawings, and SOPs."
        }
    ]

    _cached_discovered: Optional[List[Dict[str, Any]]] = None

    @classmethod
    def discover_local_models(cls, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Discovers all .gguf files in settings.LOCAL_MODEL_PATH and extracts metadata.
        Returns list of model dicts ready for routing.
        """
        if cls._cached_discovered is not None and not force_refresh:
            return cls._cached_discovered

        discovered: List[Dict[str, Any]] = [dict(cls.NATIVE_FALLBACK)]
        seen_paths = set()
        seen_filenames = set()

        base_project_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
        candidate_dirs = [
            settings.LOCAL_MODEL_PATH,
            "./models",
            "./backend/models",
            "../models",
            "models",
            "backend/models",
            os.path.join(base_project_dir, "models"),
            os.path.join(base_project_dir, "backend", "models"),
        ]

        for cand in candidate_dirs:
            if not cand:
                continue
            abs_cand = os.path.abspath(cand)
            if not os.path.isdir(abs_cand):
                continue

            try:
                files = [f for f in os.listdir(abs_cand) if f.lower().endswith(".gguf")]
                for fname in sorted(files):
                    fpath = os.path.join(abs_cand, fname)
                    real_path = os.path.realpath(fpath)
                    if real_path in seen_paths or fname in seen_filenames:
                        continue
                    seen_paths.add(real_path)
                    seen_filenames.add(fname)

                    meta = GGUFMetadataReader.inspect_file(fpath)
                    
                    # Deduce supported tasks and tier from parameters
                    params_b = meta["parameters_b"]
                    if params_b <= 1.0:
                        tasks = ["GENERAL_LLM", "SOP_RAG", "CODE", "PYTHON_EXECUTION", "CALCULATOR", "REASONING", "AGENT_PLANNER"]
                        tier = HardwareTier.TIER_1_LOW_CPU
                        priority = 60
                    elif params_b <= 2.5:
                        tasks = ["REASONING", "AGENT_PLANNER", "GENERAL_LLM", "SOP_RAG", "CODE", "PYTHON_EXECUTION", "CALCULATOR"]
                        tier = HardwareTier.TIER_1_LOW_CPU
                        priority = 80
                    elif params_b <= 4.0:
                        tasks = ["REASONING", "AGENT_PLANNER", "SOP_RAG", "GENERAL_LLM", "CODE"]
                        tier = HardwareTier.TIER_2_MID_CPU
                        priority = 85
                    elif params_b <= 8.0:
                        tasks = ["REASONING", "AGENT_PLANNER", "GENERAL_LLM", "SOP_RAG"]
                        tier = HardwareTier.TIER_3_GPU_DESKTOP
                        priority = 90
                    else:
                        tasks = ["REASONING", "AGENT_PLANNER", "GENERAL_LLM"]
                        tier = HardwareTier.TIER_4_SERVER
                        priority = 95

                    # Match with static catalog entry if recognizable to retain rich descriptions
                    cat_match = None
                    for c in cls.STATIC_CATALOG:
                        rec_name = c.get("recommended_filename", "").lower()
                        if rec_name and rec_name in fname.lower():
                            cat_match = c
                            break

                    if cat_match:
                        tasks = list(cat_match.get("supported_tasks", tasks))
                        tier = cat_match.get("recommended_tier", tier)
                        priority = cat_match.get("priority", priority)

                    model_id = cat_match["model_id"] if cat_match else f"local-{fname.lower().replace('.gguf', '')}"
                    display_name = cat_match["name"] if cat_match else meta["model_name"]
                    desc = cat_match["description"] if cat_match else f"Locally discovered GGUF model: {fname}"

                    if cat_match:
                        ram_required = cat_match.get("ram_required_gb", 0.7)
                        vram_required = cat_match.get("vram_required_gb", 0.0)
                        cpu_compat = cat_match.get("cpu_compatible", params_b <= 4.0)
                    else:
                        cpu_compat = params_b <= 4.0
                        kv_overhead = (min(meta["context_length"], 4096) / 2048) * (0.15 if params_b <= 1.0 else 0.35)
                        ram_required = round(meta["file_size_gb"] * 1.15 + kv_overhead, 2)
                        vram_required = 0.0 if cpu_compat else meta["estimated_vram_gb"]

                    entry = {
                        "model_id": model_id,
                        "name": display_name,
                        "model_type": tasks[0],
                        "supported_tasks": tasks,
                        "parameters": meta["parameters"],
                        "parameters_b": params_b,
                        "quantization": meta["quantization"],
                        "ram_required_gb": ram_required,
                        "vram_required_gb": vram_required,
                        "cpu_compatible": cpu_compat,
                        "gpu_compatible": True,
                        "recommended_tier": tier,
                        "context_length": meta["context_length"],
                        "file_size_gb": meta["file_size_gb"],
                        "disk_size_gb": meta["file_size_gb"],
                        "is_fallback": False,
                        "is_installed": True,
                        "model_path": fpath,
                        "priority": priority,
                        "description": desc,
                        "metadata": meta
                    }
                    discovered.append(entry)
            except Exception as e:
                print(f"[ModelRegistry] Discovery scan notice: {e}")

        cls._cached_discovered = discovered
        return discovered

    @classmethod
    def get_all(cls) -> List[Dict[str, Any]]:
        """
        Returns all models: discovered local models + static catalog entries.
        """
        discovered = cls.discover_local_models()
        disc_ids = {m["model_id"] for m in discovered}

        all_models = list(discovered)
        for cat in cls.STATIC_CATALOG:
            if cat["model_id"] not in disc_ids:
                all_models.append(dict(cat))
        return all_models

    @classmethod
    def get_available_models(cls) -> List[Dict[str, Any]]:
        """
        Returns only models that are currently installed and ready for local inference.
        """
        return cls.discover_local_models()

    @classmethod
    def get_by_id(cls, model_id: str) -> Dict[str, Any]:
        all_models = cls.get_all()
        for m in all_models:
            if m["model_id"] == model_id:
                return m
        return cls.NATIVE_FALLBACK

    @classmethod
    def refresh(cls):
        cls._cached_discovered = None
        return cls.discover_local_models(force_refresh=True)
