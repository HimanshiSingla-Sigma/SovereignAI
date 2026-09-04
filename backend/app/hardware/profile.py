from typing import Dict, Any
from app.hardware.detector import HardwareDetector
from app.core.config import settings

class HardwareTier:
    TIER_1_LOW_CPU = "TIER_1_LOW_CPU"          # Dual-core laptop, <= 12GB RAM, Integrated GPU
    TIER_2_MID_CPU = "TIER_2_MID_CPU"          # 6-8 core modern CPU, 16-32GB RAM, Integrated GPU
    TIER_3_GPU_DESKTOP = "TIER_3_GPU_DESKTOP"  # Dedicated GPU 6-12GB VRAM
    TIER_4_SERVER = "TIER_4_ENTERPRISE_SERVER" # High-end GPU server (A10G, A100, 24GB+ VRAM)

class HardwareProfile:
    """Computes operational boundaries and safe memory limits based on detected hardware."""

    def __init__(self):
        self.raw_data = HardwareDetector.get_full_hardware_scan()
        self.tier = self._classify_tier()
        self.max_model_ram_gb = self._calculate_max_model_ram()

    def _classify_tier(self) -> str:
        if settings.HARDWARE_TIER_OVERRIDE:
            return settings.HARDWARE_TIER_OVERRIDE

        gpu = self.raw_data["gpu"]
        mem = self.raw_data["memory"]
        cpu = self.raw_data["cpu"]

        if gpu.get("cuda_available") and gpu.get("vram_mb", 0) >= 16000:
            return HardwareTier.TIER_4_SERVER
        elif gpu.get("has_dedicated_gpu") and gpu.get("vram_mb", 0) >= 6000:
            return HardwareTier.TIER_3_GPU_DESKTOP
        elif cpu.get("logical_cores", 0) >= 8 and mem.get("total_gb", 0) >= 16.0:
            return HardwareTier.TIER_2_MID_CPU
        else:
            return HardwareTier.TIER_1_LOW_CPU

    def _calculate_max_model_ram(self) -> float:
        avail_ram = self.raw_data["memory"]["available_gb"]
        total_ram = self.raw_data["memory"]["total_gb"]

        if self.tier == HardwareTier.TIER_1_LOW_CPU:
            # Leave at least 1.5GB for OS and browser; allocate up to 50% of available RAM
            safe_budget = min(avail_ram * 0.6, 3.0)
            return round(max(safe_budget, 1.0), 2)
        elif self.tier == HardwareTier.TIER_2_MID_CPU:
            return round(min(avail_ram * 0.7, 8.0), 2)
        elif self.tier == HardwareTier.TIER_3_GPU_DESKTOP:
            return 12.0
        else:
            return 32.0

    def get_summary(self) -> Dict[str, Any]:
        cpu = self.raw_data["cpu"]
        mem = self.raw_data["memory"]
        gpu = self.raw_data["gpu"]

        return {
            "tier": self.tier,
            "hardware_tier": self.tier,
            "cpu_model": cpu["model"],
            "physical_cores": cpu["physical_cores"],
            "logical_cores": cpu["logical_cores"],
            "total_ram_gb": mem["total_gb"],
            "available_ram_gb": mem["available_gb"],
            "gpu_name": gpu["gpu_name"],
            "gpu_vendor": gpu["gpu_vendor"],
            "gpu_memory_mb": gpu["vram_mb"],
            "has_dedicated_gpu": gpu["has_dedicated_gpu"],
            "max_model_ram_gb": self.max_model_ram_gb,
            "max_safe_model_ram_gb": self.max_model_ram_gb,
            "acceleration": "CUDA" if gpu.get("cuda_available") else "CPU (Optimized)",
            "operating_system": self.raw_data["os"]
        }
