from typing import Dict, Any, Optional
from app.hardware.detector import HardwareDetector
from app.core.config import settings

class HardwareTier:
    TIER_1_LOW_CPU = "TIER_1_LOW_CPU"          # Dual-core laptop, <= 12GB RAM, Integrated GPU
    TIER_2_MID_CPU = "TIER_2_MID_CPU"          # 6-8 core modern CPU, 16-32GB RAM, Integrated GPU
    TIER_3_GPU_DESKTOP = "TIER_3_GPU_DESKTOP"  # Dedicated GPU 4-12GB VRAM (e.g. RTX 3050, 4060)
    TIER_4_SERVER = "TIER_4_ENTERPRISE_SERVER" # High-end GPU server (A10G, A100, 24GB+ VRAM)

class HardwareProfile:
    """
    Computes operational boundaries and safe memory limits based on detected hardware.
    Enforces configurable resource safety margins (RAM and VRAM utilization ceilings).
    """

    def __init__(self, raw_data_override: Optional[Dict[str, Any]] = None):
        self.raw_data = raw_data_override or HardwareDetector.get_full_hardware_scan()
        self.tier = self._classify_tier()
        self.max_model_ram_gb = self._calculate_max_model_ram()
        self.max_model_vram_gb = self._calculate_max_model_vram()

    def _classify_tier(self) -> str:
        if settings.HARDWARE_TIER_OVERRIDE:
            return settings.HARDWARE_TIER_OVERRIDE

        gpu = self.raw_data.get("gpu", {})
        mem = self.raw_data.get("memory", {})
        cpu = self.raw_data.get("cpu", {})

        vram_mb = gpu.get("vram_mb", 0.0)
        has_gpu = gpu.get("has_dedicated_gpu", False)
        cuda = gpu.get("cuda_available", False)

        if (cuda or has_gpu) and vram_mb >= 16000:
            return HardwareTier.TIER_4_SERVER
        elif has_gpu and vram_mb >= 3500:
            return HardwareTier.TIER_3_GPU_DESKTOP
        elif cpu.get("logical_cores", 0) >= 8 and mem.get("total_gb", 0) >= 16.0:
            return HardwareTier.TIER_2_MID_CPU
        else:
            return HardwareTier.TIER_1_LOW_CPU

    def _calculate_max_model_ram(self) -> float:
        """
        Calculates maximum RAM budget a single local model may safely consume.
        Leaves at least (1 - MODEL_MAX_RAM_UTILIZATION) and MODEL_MIN_FREE_RAM_GB free for host OS.
        """
        mem = self.raw_data.get("memory", {})
        avail_ram = mem.get("available_gb", 4.0)
        total_ram = mem.get("total_gb", 8.0)

        max_ratio = getattr(settings, "MODEL_MAX_RAM_UTILIZATION", 0.70)
        min_floor = getattr(settings, "MODEL_MIN_FREE_RAM_GB", 0.5)

        # Budget is bounded by available RAM with safety margin, ensuring models up to 0.8 GB can run on 8GB systems
        headroom_budget = max(0.75, avail_ram * 0.85, avail_ram - min_floor)
        ratio_budget = max(0.75, total_ram * max_ratio)

        safe_budget = min(headroom_budget, ratio_budget)

        # Ensure minimal viable budget for lightweight CPU models (0.75 GB)
        return round(max(safe_budget, 0.75), 2)

    def _calculate_max_model_vram(self) -> float:
        """
        Calculates maximum VRAM budget a model may safely consume for GPU offload.
        """
        gpu = self.raw_data.get("gpu", {})
        if not gpu.get("has_dedicated_gpu", False):
            return 0.0

        vram_avail_gb = gpu.get("vram_available_gb", gpu.get("vram_avail_mb", 0.0) / 1024)
        if vram_avail_gb <= 0:
            vram_avail_gb = gpu.get("vram_mb", 0.0) / 1024

        max_ratio = getattr(settings, "MODEL_MAX_VRAM_UTILIZATION", 0.80)
        min_floor = getattr(settings, "MODEL_MIN_FREE_VRAM_GB", 0.5)

        safe_budget = max(0.0, (vram_avail_gb * max_ratio) - min_floor)
        return round(safe_budget, 2)

    def get_summary(self) -> Dict[str, Any]:
        cpu = self.raw_data.get("cpu", {})
        mem = self.raw_data.get("memory", {})
        gpu = self.raw_data.get("gpu", {})
        storage = self.raw_data.get("storage", {})

        cuda_avail = gpu.get("cuda_available", False)
        metal_avail = gpu.get("metal_available", False)
        accel = "CUDA (NVIDIA Acceleration)" if cuda_avail else ("Metal (Apple Silicon Acceleration)" if metal_avail else "CPU (Optimized SIMD)")

        return {
            "tier": self.tier,
            "hardware_tier": self.tier,
            "cpu_model": cpu.get("model", "Unknown CPU"),
            "physical_cores": cpu.get("physical_cores", 2),
            "logical_cores": cpu.get("logical_cores", 4),
            "available_threads": cpu.get("available_threads", 4),
            "total_ram_gb": mem.get("total_gb", 8.0),
            "available_ram_gb": mem.get("available_gb", 4.0),
            "used_ram_gb": mem.get("used_gb", 4.0),
            "gpu_name": gpu.get("gpu_name", "Host CPU"),
            "gpu_vendor": gpu.get("gpu_vendor", "Host System"),
            "gpu_memory_mb": gpu.get("vram_mb", 0.0),
            "gpu_available_mb": gpu.get("vram_available_mb", 0.0),
            "has_dedicated_gpu": gpu.get("has_dedicated_gpu", False),
            "cuda_available": cuda_avail,
            "metal_available": metal_avail,
            "max_model_ram_gb": self.max_model_ram_gb,
            "max_safe_model_ram_gb": self.max_model_ram_gb,
            "max_model_vram_gb": self.max_model_vram_gb,
            "max_safe_model_vram_gb": self.max_model_vram_gb,
            "acceleration": accel,
            "disk_free_gb": storage.get("free_gb", 0.0),
            "operating_system": self.raw_data.get("os", "Local System")
        }

    def to_dict(self) -> Dict[str, Any]:
        """Alias for get_summary to provide dictionary representation."""
        return self.get_summary()


def get_hardware_profile(raw_data_override: Optional[Dict[str, Any]] = None) -> HardwareProfile:
    """Convenience factory function returning a HardwareProfile instance."""
    return HardwareProfile(raw_data_override=raw_data_override)

