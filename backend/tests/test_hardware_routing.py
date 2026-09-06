"""
Unit tests for the SovereignAIWorkbench Real Hardware-Aware Multi-Model Gateway.
Validates:
1. Pure Python GGUF binary reader (zero external dependencies)
2. Hardware detector & profile generation
3. Industrial Task Classifier
4. Hardware-Aware Router:
   - CPU-only 8GB RAM host
   - Low-RAM 4GB host
   - High-RAM 64GB host
   - Dedicated GPU host
   - No GGUFs / Native Fallback Engine
5. Model residency lifecycle (instance reuse & clean unload)
"""
import io
import struct
import unittest
from unittest.mock import patch, MagicMock

from app.hardware.gguf_reader import read_gguf_metadata, estimate_runtime_memory
from app.hardware.detector import HardwareDetector
from app.hardware.profile import get_hardware_profile
from app.hardware.registry import ModelRegistry
from app.ai.task_classifier import TaskClassifier, TaskType
from app.hardware.router import HardwareAwareRouter
from app.ai.inference_engine import InferenceEngine


class TestGGUFReader(unittest.TestCase):
    """Test pure-Python GGUF header reader without external libraries."""

    def _create_mock_gguf_bytes(self, arch="llama", quant_type=2, context_len=4096, tensor_count=128):
        """Build minimal valid GGUF v3 binary header."""
        buf = io.BytesIO()
        buf.write(b"GGUF")
        buf.write(struct.pack("<I", 3))  # Version 3
        buf.write(struct.pack("<Q", tensor_count))  # Tensor count
        buf.write(struct.pack("<Q", 3))  # Metadata count

        def write_str(s):
            b = s.encode("utf-8")
            buf.write(struct.pack("<Q", len(b)))
            buf.write(b)

        # general.architecture
        write_str("general.architecture")
        buf.write(struct.pack("<I", 8))
        write_str(arch)

        # general.quantization_version
        write_str("general.quantization_version")
        buf.write(struct.pack("<I", 4))
        buf.write(struct.pack("<I", quant_type))

        # {arch}.context_length
        write_str(f"{arch}.context_length")
        buf.write(struct.pack("<I", 4))
        buf.write(struct.pack("<I", context_len))

        buf.write(b"\x00" * 1024)
        return buf.getvalue()

    def test_read_valid_gguf_bytes(self):
        gguf_bytes = self._create_mock_gguf_bytes(arch="qwen2", quant_type=2, context_len=8192, tensor_count=200)
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".gguf", delete=True) as tmp:
            tmp.write(gguf_bytes)
            tmp.flush()
            meta = read_gguf_metadata(tmp.name)

        self.assertTrue(meta["is_valid_gguf"])
        self.assertEqual(meta["architecture"], "qwen2")
        self.assertEqual(meta["context_length"], 8192)
        self.assertEqual(meta["tensor_count"], 200)
        self.assertGreater(meta["estimated_ram_gb"], 0.0)

    def test_corrupt_file_fallback(self):
        import tempfile
        with tempfile.NamedTemporaryFile(suffix=".gguf", delete=True) as tmp:
            tmp.write(b"NOT_A_VALID_GGUF_FILE_HEADER")
            tmp.flush()
            meta = read_gguf_metadata(tmp.name)

        self.assertFalse(meta["is_valid_gguf"])
        self.assertEqual(meta["architecture"], "unknown")
        self.assertIn("error", meta)

    def test_estimate_runtime_memory(self):
        ram, vram = estimate_runtime_memory(
            file_size_bytes=2 * (1024**3),
            quantization_code="Q4_K_M",
            context_length=4096,
            architecture="llama"
        )
        self.assertGreaterEqual(ram, 2.3)
        self.assertGreaterEqual(vram, 2.3)


class TestHardwareDetector(unittest.TestCase):
    """Test safe cross-platform hardware detection."""

    def test_scan_returns_valid_structure(self):
        scan = HardwareDetector.get_full_hardware_scan()
        self.assertIn("cpu", scan)
        self.assertIn("memory", scan)
        self.assertIn("gpu", scan)
        self.assertIn("storage", scan)
        self.assertGreater(scan["memory"]["total_gb"], 0.0)
        self.assertGreater(scan["cpu"]["logical_cores"], 0)


class TestTaskClassifier(unittest.TestCase):
    """Test industrial task classification."""

    def test_classification_patterns(self):
        classifier = TaskClassifier()

        cases = [
            ("Why did compressor-001 overheat during stage 2 compression?", TaskType.REASONING),
            ("Analyze root cause of high vibration in pump-002", TaskType.REASONING),
            ("Generate an automated maintenance plan to inspect hydraulic valves", TaskType.AGENT_PLANNER),
            ("Schedule technician workflow for turbine replacement", TaskType.AGENT_PLANNER),
            ("What is the standard operating procedure SOP for emergency boiler shutdown?", TaskType.SOP_RAG),
            ("According to operating manual section 4, what is the nominal pressure?", TaskType.SOP_RAG),
            ("Extract text from OCR scan of equipment rating plate", TaskType.OCR),
            ("Summarize PDF document compliance checklist", TaskType.DOCUMENT_ANALYSIS),
            ("Compute vector embedding for document index", TaskType.EMBEDDING),
            ("Hello system, what are your core capabilities?", TaskType.GENERAL_LLM),
        ]

        for text, expected_task in cases:
            res = classifier.classify(text)
            self.assertEqual(res["task_type"], expected_task, f"Failed for query: '{text}', got {res['task_type']}")


class TestHardwareAwareRouter(unittest.TestCase):
    """Test router decision engine under multiple hardware profiles."""

    def setUp(self):
        self.router = HardwareAwareRouter()
        self.mock_models = [
            {
                "model_id": "qwen2.5-0.5b-instruct.Q4_K_M.gguf",
                "name": "Qwen 2.5 0.5B (Local GGUF)",
                "model_type": "GENERAL_LLM",
                "supported_tasks": ["GENERAL_LLM", "AGENT_PLANNER", "SOP_RAG"],
                "parameters": "0.5B",
                "parameters_b": 0.5,
                "quantization": "Q4_K_M",
                "ram_required_gb": 0.8,
                "vram_required_gb": 0.8,
                "cpu_compatible": True,
                "gpu_compatible": True,
                "is_installed": True,
                "is_fallback": False,
                "priority": 40,
                "file_size_gb": 0.5
            },
            {
                "model_id": "smollm2-1.7b-instruct.Q4_K_M.gguf",
                "name": "SmolLM2 1.7B (Local GGUF)",
                "model_type": "REASONING",
                "supported_tasks": ["REASONING", "AGENT_PLANNER", "GENERAL_LLM"],
                "parameters": "1.7B",
                "parameters_b": 1.7,
                "quantization": "Q4_K_M",
                "ram_required_gb": 1.6,
                "vram_required_gb": 1.6,
                "cpu_compatible": True,
                "gpu_compatible": True,
                "is_installed": True,
                "is_fallback": False,
                "priority": 50,
                "file_size_gb": 1.1
            },
            {
                "model_id": "qwen2.5-7b-instruct.Q4_K_M.gguf",
                "name": "Qwen 2.5 7B (Local GGUF)",
                "model_type": "REASONING",
                "supported_tasks": ["REASONING", "AGENT_PLANNER", "GENERAL_LLM"],
                "parameters": "7B",
                "parameters_b": 7.0,
                "quantization": "Q4_K_M",
                "ram_required_gb": 5.4,
                "vram_required_gb": 5.4,
                "cpu_compatible": True,
                "gpu_compatible": True,
                "is_installed": True,
                "is_fallback": False,
                "priority": 60,
                "file_size_gb": 4.5
            },
        ]

    def test_cpu_8gb_environment(self):
        """Host: 8GB total RAM, 5.0GB free, CPU-only.
        Safe RAM limit (70%) = 3.5GB.
        7B model (5.4GB) must be DISQUALIFIED.
        1.7B model (1.6GB) and 0.5B model (0.8GB) must be FEASIBLE.
        For REASONING, 1.7B should be selected over 0.5B because it's feasible and specialized for REASONING.
        """
        raw_hw = {
            "cpu": {"model": "Intel Core i5-8250U", "logical_cores": 8, "physical_cores": 4, "available_threads": 4},
            "memory": {"total_gb": 8.0, "available_gb": 5.0, "used_gb": 3.0, "percent_used": 37.5},
            "gpu": {"gpu_name": "None", "has_dedicated_gpu": False, "vram_mb": 0.0, "vram_available_mb": 0.0, "cuda_available": False, "metal_available": False},
            "storage": {"free_gb": 20.0},
            "os": "Linux"
        }
        profile = get_hardware_profile(raw_data_override=raw_hw)
        decision = self.router.route_task(
            task="REASONING",
            available_models=self.mock_models,
            hw_profile=profile
        )

        self.assertFalse(decision.is_fallback)
        self.assertEqual(decision.selected_model_id, "smollm2-1.7b-instruct.Q4_K_M.gguf")
        self.assertEqual(decision.execution_mode, "llama_cpp")
        self.assertEqual(decision.target_hardware, "CPU (llama.cpp)")

        candidates = {c["model_id"]: c for c in decision.candidates_evaluated}
        self.assertIn("qwen2.5-7b-instruct.Q4_K_M.gguf", candidates)
        self.assertFalse(candidates["qwen2.5-7b-instruct.Q4_K_M.gguf"]["is_feasible"])
        self.assertTrue(candidates["smollm2-1.7b-instruct.Q4_K_M.gguf"]["is_feasible"])

    def test_low_ram_4gb_environment(self):
        """Host: 4GB total RAM, 2.0GB free, CPU-only.
        Safe RAM budget (70%) = 1.4GB.
        1.7B model (1.6GB) and 7B model (5.4GB) are disqualified.
        Only 0.5B model (0.8GB) fits in budget.
        """
        raw_hw = {
            "cpu": {"model": "Intel Celeron N4020", "logical_cores": 2, "physical_cores": 2, "available_threads": 2},
            "memory": {"total_gb": 4.0, "available_gb": 2.0, "used_gb": 2.0, "percent_used": 50.0},
            "gpu": {"gpu_name": "None", "has_dedicated_gpu": False, "vram_mb": 0.0, "vram_available_mb": 0.0, "cuda_available": False, "metal_available": False},
            "storage": {"free_gb": 10.0},
            "os": "Linux"
        }
        profile = get_hardware_profile(raw_data_override=raw_hw)
        decision = self.router.route_task(
            task="GENERAL_LLM",
            available_models=self.mock_models,
            hw_profile=profile
        )

        self.assertEqual(decision.selected_model_id, "qwen2.5-0.5b-instruct.Q4_K_M.gguf")
        self.assertFalse(decision.is_fallback)

    def test_high_ram_64gb_environment(self):
        """Host: 64GB total RAM, 45.0GB free, CPU-only.
        All models fit. 7B model should win REASONING due to quality capacity score.
        """
        raw_hw = {
            "cpu": {"model": "AMD Ryzen 9 7950X", "logical_cores": 32, "physical_cores": 16, "available_threads": 8},
            "memory": {"total_gb": 64.0, "available_gb": 45.0, "used_gb": 19.0, "percent_used": 29.0},
            "gpu": {"gpu_name": "None", "has_dedicated_gpu": False, "vram_mb": 0.0, "vram_available_mb": 0.0, "cuda_available": False, "metal_available": False},
            "storage": {"free_gb": 200.0},
            "os": "Linux"
        }
        profile = get_hardware_profile(raw_data_override=raw_hw)
        decision = self.router.route_task(
            task="REASONING",
            available_models=self.mock_models,
            hw_profile=profile
        )

        self.assertEqual(decision.selected_model_id, "qwen2.5-7b-instruct.Q4_K_M.gguf")

    def test_dedicated_gpu_24gb_environment(self):
        """Host: NVIDIA RTX 4090 with 24GB VRAM.
        GPU acceleration selected.
        """
        raw_hw = {
            "cpu": {"model": "AMD Ryzen 9 7950X", "logical_cores": 32, "physical_cores": 16, "available_threads": 8},
            "memory": {"total_gb": 64.0, "available_gb": 50.0, "used_gb": 14.0, "percent_used": 22.0},
            "gpu": {"gpu_name": "NVIDIA GeForce RTX 4090", "has_dedicated_gpu": True, "vram_mb": 24576.0, "vram_available_mb": 22000.0, "cuda_available": True, "metal_available": False},
            "storage": {"free_gb": 500.0},
            "os": "Linux"
        }
        profile = get_hardware_profile(raw_data_override=raw_hw)
        decision = self.router.route_task(
            task="REASONING",
            available_models=self.mock_models,
            hw_profile=profile
        )

        self.assertEqual(decision.selected_model_id, "qwen2.5-7b-instruct.Q4_K_M.gguf")
        self.assertEqual(decision.execution_mode, "cuda")
        self.assertEqual(decision.target_hardware, "GPU (CUDA)")

    def test_no_installed_models_graceful_fallback(self):
        """When zero local GGUFs are installed, router selects Level-4 Native Fallback."""
        uninstalled = [
            {
                "model_id": "qwen2.5-0.5b-instruct-q4",
                "name": "Qwen 2.5 0.5B",
                "model_type": "GENERAL_LLM",
                "supported_tasks": ["GENERAL_LLM"],
                "parameters": "0.5B",
                "parameters_b": 0.5,
                "quantization": "Q4_K_M",
                "ram_required_gb": 0.7,
                "vram_required_gb": 0.0,
                "cpu_compatible": True,
                "gpu_compatible": True,
                "is_installed": False,
                "is_fallback": False,
            }
        ]
        raw_hw = {
            "cpu": {"model": "Apple M1", "logical_cores": 8, "physical_cores": 8, "available_threads": 4},
            "memory": {"total_gb": 8.0, "available_gb": 4.0, "used_gb": 4.0, "percent_used": 50.0},
            "gpu": {"gpu_name": "Host CPU", "has_dedicated_gpu": False, "vram_mb": 0.0, "vram_available_mb": 0.0, "cuda_available": False, "metal_available": False},
            "storage": {"free_gb": 50.0},
            "os": "Darwin"
        }
        profile = get_hardware_profile(raw_data_override=raw_hw)
        decision = self.router.route_task(
            task="REASONING",
            available_models=uninstalled,
            hw_profile=profile
        )

        self.assertTrue(decision.is_fallback)
        self.assertEqual(decision.selected_model_id, "sovereign-neural-cpu-1b")
        self.assertEqual(decision.execution_mode, "native")
        self.assertIn("Level-4 Native Fallback", decision.reasons[0])


class TestInferenceEngineLifecycle(unittest.TestCase):
    """Test model instance reuse and clean unloader."""

    @patch("os.path.exists", return_value=True)
    def test_model_reuse_and_unload(self, mock_exists):
        engine = InferenceEngine()

        mock_instance1 = MagicMock()
        mock_instance2 = MagicMock()

        import sys
        mock_llama_module = MagicMock()
        mock_llama_module.Llama = MagicMock(side_effect=[mock_instance1, mock_instance2])

        with patch.dict("sys.modules", {"llama_cpp": mock_llama_module}):
            # First load of model A
            inst_a1, _ = engine._load_or_reuse_model("/fake/path/model_a.gguf")
            self.assertEqual(inst_a1, mock_instance1)
            self.assertEqual(mock_llama_module.Llama.call_count, 1)

            # Second load of same model A -> MUST REUSE active instance
            inst_a2, _ = engine._load_or_reuse_model("/fake/path/model_a.gguf")
            self.assertEqual(inst_a2, mock_instance1)
            self.assertEqual(mock_llama_module.Llama.call_count, 1)

            # Switching to model B -> MUST unload model A first and invoke GC
            with patch("gc.collect") as mock_gc:
                inst_b, _ = engine._load_or_reuse_model("/fake/path/model_b.gguf")
                self.assertEqual(inst_b, mock_instance2)
                self.assertEqual(engine.active_model_path, "/fake/path/model_b.gguf")
                self.assertTrue(mock_gc.called)

    def test_native_fallback_generate(self):
        """Verify engine generates deterministic response when no GGUF is available."""
        engine = InferenceEngine()
        fallback_decision = {
            "selected_model_id": "sovereign-neural-cpu-1b",
            "is_fallback": True,
            "execution_mode": "native",
            "task": "REASONING"
        }
        res = engine.generate(
            prompt="Analyze vibration spike in compressor-001",
            selected_model=None,
            routing_decision=fallback_decision
        )

        self.assertIn("response", res)
        self.assertEqual(res["model"], "sovereign-neural-cpu-1b (Native Rule Engine)")
        self.assertIn("Industrial Assessment", res["response"])

    def test_active_model_status(self):
        """Verify get_active_status returns valid metadata and detects runtime state."""
        engine = InferenceEngine()
        status = engine.get_active_status()
        self.assertIn("active_model_name", status)
        self.assertIn("is_loaded_in_memory", status)
        self.assertIn("llama_cpp_installed", status)
        self.assertIn("llama_cpp_status", status)

    def test_multi_path_discovery(self):
        """Verify discover_local_models finds models in candidates without crashing."""
        from app.hardware.registry import ModelRegistry
        discovered = ModelRegistry.discover_local_models(force_refresh=True)
        self.assertTrue(len(discovered) >= 1)
        self.assertEqual(discovered[0]["model_id"], "sovereign-neural-cpu-1b")


if __name__ == "__main__":
    unittest.main()
