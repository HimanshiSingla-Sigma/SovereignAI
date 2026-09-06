import os
import struct
import re
from typing import Dict, Any, Optional, Tuple, List


GGUF_MAGIC = b'GGUF'

FILE_TYPE_MAP = {
    0: 'ALL_F32',
    1: 'MOSTLY_F16',
    2: 'MOSTLY_Q4_0',
    3: 'MOSTLY_Q4_1',
    7: 'MOSTLY_Q4_K',
    8: 'MOSTLY_Q5_K',
    9: 'MOSTLY_Q6_K',
    10: 'MOSTLY_Q8_0',
    11: 'MOSTLY_Q4_K_S',
    12: 'MOSTLY_Q4_K_M',
    13: 'MOSTLY_Q5_K_S',
    14: 'MOSTLY_Q5_K_M',
    15: 'MOSTLY_Q6_K'
}

class GGUFMetadataReader:
    """
    Zero-dependency, pure-Python binary reader for GGUF model files (v2 and v3).
    Extracts architecture, quantization type, context length, tensor count,
    and estimates parameter count and RAM/VRAM consumption in < 2ms without loading weights.
    """

    @classmethod
    def inspect_file(cls, file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            return cls._fallback_from_filename(file_path, error='File does not exist')

        file_size_bytes = os.path.getsize(file_path)
        file_size_gb = round(file_size_bytes / (1024 ** 3), 3)

        try:
            with open(file_path, 'rb') as f:
                header = f.read(4)
                if header != GGUF_MAGIC:
                    return cls._fallback_from_filename(
                        file_path, file_size_gb=file_size_gb, error='Invalid GGUF magic header'
                    )

                version = struct.unpack('<I', f.read(4))[0]
                if version not in (2, 3):
                    return cls._fallback_from_filename(
                        file_path, file_size_gb=file_size_gb, error=f'Unsupported GGUF version {version}'
                    )

                tensor_count = struct.unpack('<Q', f.read(8))[0]
                kv_count = struct.unpack('<Q', f.read(8))[0]

                metadata: Dict[str, Any] = {}
                # Parse metadata key-value pairs (up to 256 keys for safety)
                for _ in range(min(kv_count, 256)):
                    key = cls._read_string(f)
                    if key is None:
                        break
                    val = cls._read_value(f)
                    metadata[key] = val

                return cls._normalize_metadata(file_path, metadata, file_size_gb, tensor_count)

        except Exception as e:
            return cls._fallback_from_filename(file_path, file_size_gb=file_size_gb, error=str(e))

    @classmethod
    def _read_string(cls, f) -> Optional[str]:
        try:
            length_bytes = f.read(8)
            if len(length_bytes) < 8:
                return None
            length = struct.unpack('<Q', length_bytes)[0]
            if length > 1024:  # Safety bound for key string
                return None
            data = f.read(length)
            return data.decode('utf-8', errors='ignore')
        except Exception:
            return None

    @classmethod
    def _read_value(cls, f) -> Any:
        try:
            type_id_bytes = f.read(4)
            if len(type_id_bytes) < 4:
                return None
            type_id = struct.unpack('<I', type_id_bytes)[0]

            if type_id == 0:    # UINT8
                return struct.unpack('<B', f.read(1))[0]
            elif type_id == 1:  # INT8
                return struct.unpack('<b', f.read(1))[0]
            elif type_id == 2:  # UINT16
                return struct.unpack('<H', f.read(2))[0]
            elif type_id == 3:  # INT16
                return struct.unpack('<h', f.read(2))[0]
            elif type_id == 4:  # UINT32
                return struct.unpack('<I', f.read(4))[0]
            elif type_id == 5:  # INT32
                return struct.unpack('<i', f.read(4))[0]
            elif type_id == 6:  # FLOAT32
                return struct.unpack('<f', f.read(4))[0]
            elif type_id == 7:  # BOOL
                return struct.unpack('<?', f.read(1))[0]
            elif type_id == 8:  # STRING
                return cls._read_string(f)
            elif type_id == 9:  # ARRAY
                elem_type = struct.unpack('<I', f.read(4))[0]
                arr_len = struct.unpack('<Q', f.read(8))[0]
                # Skip array payload to advance stream quickly
                if elem_type == 8: # array of strings
                    for _ in range(min(arr_len, 32)):
                        cls._read_string(f)
                else:
                    sizes = {0: 1, 1: 1, 2: 2, 3: 2, 4: 4, 5: 4, 6: 4, 7: 1, 10: 8, 11: 8, 12: 8}
                    elem_sz = sizes.get(elem_type, 4)
                    f.seek(arr_len * elem_sz, os.SEEK_CUR)
                return f'Array[{arr_len}]'
            elif type_id == 10: # UINT64
                return struct.unpack('<Q', f.read(8))[0]
            elif type_id == 11: # INT64
                return struct.unpack('<q', f.read(8))[0]
            elif type_id == 12: # FLOAT64
                return struct.unpack('<d', f.read(8))[0]
            else:
                return None
        except Exception:
            return None

    @classmethod
    def _normalize_metadata(
        cls,
        file_path: str,
        meta: Dict[str, Any],
        file_size_gb: float,
        tensor_count: int
    ) -> Dict[str, Any]:
        filename = os.path.basename(file_path)
        arch = meta.get('general.architecture', 'transformer')
        name = meta.get('general.name', filename)

        # Context length
        context_length = (
            meta.get(f'{arch}.context_length') or
            meta.get('general.context_length') or
            4096
        )

        # Quantization
        file_type_code = meta.get('general.file_type')
        if file_type_code is not None and file_type_code in FILE_TYPE_MAP:
            quant = FILE_TYPE_MAP[file_type_code]
        else:
            quant = cls._detect_quant_from_filename(filename)

        # Parameter count
        params_raw = meta.get('general.parameter_count')
        if params_raw:
            params_b = round(params_raw / 1e9, 2)
            params_str = f'{params_b}B'
        else:
            params_b, params_str = cls._estimate_params_from_size(file_size_gb, quant, filename)

        # Memory calculations
        # CPU RAM: weights + 25% llama.cpp runtime overhead + KV cache for 2048 context
        estimated_ram_gb = round(file_size_gb * 1.25 + (min(context_length, 4096) / 2048) * 0.35, 2)
        # GPU VRAM: weights offload + CUDA context + KV cache
        estimated_vram_gb = round(file_size_gb * 1.15 + (min(context_length, 4096) / 2048) * 0.40, 2)

        return {
            'file_name': filename,
            'file_path': file_path,
            'architecture': arch,
            'model_name': name,
            'parameters': params_str,
            'parameters_b': params_b,
            'quantization': quant,
            'context_length': context_length,
            'file_size_gb': file_size_gb,
            'estimated_ram_gb': estimated_ram_gb,
            'estimated_vram_gb': estimated_vram_gb,
            'tensor_count': tensor_count,
            'metadata_extracted': True,
            'is_valid_gguf': True,
            'raw_metadata': {k: str(v) for k, v in list(meta.items())[:15]}
        }

    @classmethod
    def _fallback_from_filename(
        cls,
        file_path: str,
        file_size_gb: float = 0.5,
        error: str = ''
    ) -> Dict[str, Any]:
        filename = os.path.basename(file_path)
        quant = cls._detect_quant_from_filename(filename)
        params_b, params_str = cls._estimate_params_from_size(file_size_gb, quant, filename)

        estimated_ram_gb = round(max(0.4, file_size_gb * 1.25 + 0.35), 2)
        estimated_vram_gb = round(max(0.4, file_size_gb * 1.15 + 0.40), 2)

        return {
            'file_name': filename,
            'file_path': file_path,
            'architecture': 'unknown' if error else 'transformer',
            'model_name': filename.replace('.gguf', '').replace('_', ' ').title(),
            'parameters': params_str,
            'parameters_b': params_b,
            'quantization': quant,
            'context_length': 4096,
            'file_size_gb': file_size_gb,
            'estimated_ram_gb': estimated_ram_gb,
            'estimated_vram_gb': estimated_vram_gb,
            'tensor_count': 0,
            'metadata_extracted': False,
            'is_valid_gguf': False,
            'error': error,
            'note': f'Estimated from file size and naming ({error})'
        }

    @staticmethod
    def _detect_quant_from_filename(filename: str) -> str:
        fn = filename.upper()
        if 'Q4_K_M' in fn: return 'Q4_K_M'
        if 'Q4_K_S' in fn: return 'Q4_K_S'
        if 'Q4_K' in fn: return 'Q4_K'
        if 'Q4_0' in fn: return 'Q4_0'
        if 'Q5_K_M' in fn: return 'Q5_K_M'
        if 'Q5_K' in fn: return 'Q5_K'
        if 'Q6_K' in fn: return 'Q6_K'
        if 'Q8_0' in fn: return 'Q8_0'
        if 'F16' in fn or 'FP16' in fn: return 'FP16'
        if 'F32' in fn or 'FP32' in fn: return 'FP32'
        return 'Q4_K_M'

    @staticmethod
    def _estimate_params_from_size(file_size_gb: float, quant: str, filename: str):
        # Check filename regex first (e.g. 0.5b, 1.5b, 1.7b, 3b, 7b, 14b)
        m = re.search(r'([0-9]+(?:\.[0-9]+)?)\s*[bB]', filename)
        if m:
            p_val = float(m.group(1))
            return p_val, f'{p_val}B'

        # Otherwise estimate based on size & quant ratio
        ratio = 0.65 if 'Q4' in quant else (0.85 if 'Q5' in quant else (1.1 if 'Q8' in quant else 2.0))
        p_val = round(file_size_gb / ratio, 1)
        if p_val < 0.1: p_val = 0.5
        return p_val, f'{p_val}B'


def read_gguf_metadata(file_path: str) -> Dict[str, Any]:
    """Convenience functional wrapper for GGUFMetadataReader.inspect_file."""
    return GGUFMetadataReader.inspect_file(file_path)


def estimate_runtime_memory(
    file_size_bytes: int,
    quantization_code: str = 'Q4_K_M',
    context_length: int = 4096,
    architecture: str = 'llama'
) -> Tuple[float, float]:
    """Calculates runtime RAM and VRAM footprints given weights size + KV cache."""
    file_size_gb = file_size_bytes / (1024 ** 3)
    kv_overhead_gb = max(0.5, round((context_length / 2048) * 0.4, 2))
    ram_gb = round(file_size_gb * 1.15 + kv_overhead_gb, 2)
    vram_gb = round(file_size_gb * 1.10 + kv_overhead_gb, 2)
    return ram_gb, vram_gb

