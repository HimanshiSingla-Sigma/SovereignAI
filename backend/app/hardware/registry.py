from typing import Dict, List, Any
from app.hardware.profile import HardwareTier

class ModelRegistry:
    """Catalog of supported AI models, parameter sizes, quantizations, and hardware prerequisites."""

    MODELS: List[Dict[str, Any]] = [
        {
            "model_id": "sovereign-neural-cpu-1b",
            "name": "Sovereign Industrial Neural Reasoner (Native CPU)",
            "model_type": "GENERAL_LLM",
            "parameters": "1.0B Equivalent",
            "quantization": "Native FP16/INT8",
            "ram_required_gb": 0.4,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 4096,
            "description": "Ultra-fast zero-latency sovereign industrial inference engine running directly on host CPU cores."
        },
        {
            "model_id": "qwen2.5-0.5b-instruct-q4",
            "name": "Qwen 2.5 0.5B Instruct (GGUF)",
            "model_type": "GENERAL_LLM",
            "parameters": "0.5B",
            "quantization": "Q4_K_M",
            "ram_required_gb": 0.7,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 4096,
            "description": "Compact general instruction model optimized for low-spec dual-core laptops."
        },
        {
            "model_id": "smollm2-1.7b-instruct-q4",
            "name": "SmolLM2 1.7B Instruct (GGUF)",
            "model_type": "REASONING",
            "parameters": "1.7B",
            "quantization": "Q4_K_M",
            "ram_required_gb": 1.6,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 4096,
            "description": "Balanced agentic reasoning model for root-cause analysis and maintenance workflows."
        },
        {
            "model_id": "llama-3.2-3b-instruct-q4",
            "name": "Llama 3.2 3B Instruct (GGUF)",
            "model_type": "REASONING",
            "parameters": "3.2B",
            "quantization": "Q4_K_M",
            "ram_required_gb": 2.8,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_2_MID_CPU,
            "context_length": 8192,
            "description": "Mid-tier reasoning model for quad-core and high-RAM workstations."
        },
        {
            "model_id": "mistral-7b-instruct-v0.3-q4",
            "name": "Mistral 7B Instruct v0.3 (GGUF)",
            "model_type": "GENERAL_LLM",
            "parameters": "7.3B",
            "quantization": "Q4_K_M",
            "ram_required_gb": 5.8,
            "vram_required_gb": 6.0,
            "cpu_compatible": False,  # Too slow on dual-core 2.0GHz
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_3_GPU_DESKTOP,
            "context_length": 8192,
            "description": "High-accuracy open model for workstations with dedicated 6GB+ NVIDIA GPUs."
        },
        {
            "model_id": "qwen2.5-14b-instruct-q4",
            "name": "Qwen 2.5 14B Instruct (GGUF)",
            "model_type": "REASONING",
            "parameters": "14.7B",
            "quantization": "Q4_K_M",
            "ram_required_gb": 11.2,
            "vram_required_gb": 16.0,
            "cpu_compatible": False,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_4_SERVER,
            "context_length": 16384,
            "description": "Enterprise-grade model for dedicated industrial servers with NVIDIA A100/H100."
        },
        {
            "model_id": "local-semantic-embedding",
            "name": "Sovereign Industrial Dense Embedder",
            "model_type": "EMBEDDING",
            "parameters": "384-Dim",
            "quantization": "FP32",
            "ram_required_gb": 0.2,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 512,
            "description": "Normalized semantic vector space for RAG document chunk retrieval."
        },
        {
            "model_id": "local-cpu-ocr-engine",
            "name": "Sovereign OCR & Document Intelligence",
            "model_type": "OCR",
            "parameters": "Lightweight",
            "quantization": "Native",
            "ram_required_gb": 0.3,
            "vram_required_gb": 0.0,
            "cpu_compatible": True,
            "gpu_compatible": True,
            "recommended_tier": HardwareTier.TIER_1_LOW_CPU,
            "context_length": 2048,
            "description": "CPU-friendly document parser for scanned PDFs, engineering drawings, and SOPs."
        }
    ]

    @classmethod
    def get_all(cls) -> List[Dict[str, Any]]:
        return cls.MODELS

    @classmethod
    def get_by_id(cls, model_id: str) -> Dict[str, Any]:
        for m in cls.MODELS:
            if m["model_id"] == model_id:
                return m
        return cls.MODELS[0]
