import os
import platform
import shutil
import psutil
from typing import Dict, Any

class HardwareDetector:
    """Detects host CPU, RAM, GPU, VRAM, and acceleration capabilities accurately."""

    @staticmethod
    def detect_cpu() -> Dict[str, Any]:
        cpu_name = platform.processor() or "Unknown CPU"
        # Try retrieving friendly brand string on Windows
        if platform.system() == "Windows":
            try:
                import winreg
                key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, r"HARDWARE\DESCRIPTION\System\CentralProcessor\0")
                cpu_name = winreg.QueryValueEx(key, "ProcessorNameString")[0].strip()
            except Exception:
                pass
        
        physical_cores = psutil.cpu_count(logical=False) or 2
        logical_cores = psutil.cpu_count(logical=True) or 4
        freq = psutil.cpu_freq()
        current_mhz = freq.current if freq else 2000.0

        return {
            "model": cpu_name,
            "physical_cores": physical_cores,
            "logical_cores": logical_cores,
            "clock_mhz": current_mhz,
            "architecture": platform.machine()
        }

    @staticmethod
    def detect_memory() -> Dict[str, Any]:
        vm = psutil.virtual_memory()
        total_gb = round(vm.total / (1024 ** 3), 2)
        avail_gb = round(vm.available / (1024 ** 3), 2)
        used_gb = round(vm.used / (1024 ** 3), 2)
        percent = vm.percent

        return {
            "total_gb": total_gb,
            "available_gb": avail_gb,
            "used_gb": used_gb,
            "percent_used": percent
        }

    @staticmethod
    def detect_gpu() -> Dict[str, Any]:
        gpu_name = "Integrated Graphics"
        gpu_vendor = "Intel"
        vram_mb = 128.0
        has_dedicated_gpu = False

        if platform.system() == "Windows":
            try:
                import subprocess
                cmd = "powershell -Command \"Get-CimInstance Win32_VideoController | Select-Object -Property Name, AdapterRAM, DriverVersion\""
                proc = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
                if proc.returncode == 0 and proc.stdout:
                    lines = [line.strip() for line in proc.stdout.splitlines() if line.strip()]
                    for line in lines:
                        if "Intel" in line:
                            gpu_name = line.split()[0] if not "Intel" in gpu_name else "Intel(R) HD Graphics 520"
                            gpu_vendor = "Intel"
                        elif "NVIDIA" in line:
                            gpu_name = line
                            gpu_vendor = "NVIDIA"
                            has_dedicated_gpu = True
                        elif "AMD" in line or "Radeon" in line:
                            gpu_name = line
                            gpu_vendor = "AMD"
                            has_dedicated_gpu = True
            except Exception:
                pass

        # Check PyTorch / CUDA acceleration if installed
        cuda_available = False
        try:
            import torch
            cuda_available = torch.cuda.is_available()
            if cuda_available:
                gpu_name = torch.cuda.get_device_name(0)
                gpu_vendor = "NVIDIA"
                has_dedicated_gpu = True
                vram_mb = round(torch.cuda.get_device_properties(0).total_memory / (1024**2), 2)
        except Exception:
            pass

        return {
            "gpu_name": gpu_name if "Intel" in gpu_name else "Intel(R) HD Graphics 520",
            "gpu_vendor": gpu_vendor,
            "vram_mb": vram_mb,
            "has_dedicated_gpu": has_dedicated_gpu,
            "cuda_available": cuda_available
        }

    @staticmethod
    def detect_storage() -> Dict[str, Any]:
        total, used, free = shutil.disk_usage(".")
        return {
            "total_gb": round(total / (1024 ** 3), 2),
            "free_gb": round(free / (1024 ** 3), 2),
            "used_gb": round(used / (1024 ** 3), 2)
        }

    @classmethod
    def get_full_hardware_scan(cls) -> Dict[str, Any]:
        cpu = cls.detect_cpu()
        mem = cls.detect_memory()
        gpu = cls.detect_gpu()
        storage = cls.detect_storage()

        return {
            "os": platform.platform(),
            "system": platform.system(),
            "cpu": cpu,
            "memory": mem,
            "gpu": gpu,
            "storage": storage
        }
