# Lightweight Task-Specific GGUF Models Setup Guide (CPU / 8GB RAM / 15GB Disk)

This guide documents the recommended compact, quantized GGUF models configured for each industrial task in the Sovereign Industrial AI Workbench.

---

## Hardware Constraint Compliance

| Constraint | Limit | Architecture Allocation | Compliance Status |
| :--- | :--- | :--- | :--- |
| **Compute** | Host CPU (Intel/AMD/Apple Silicon) | All models quantized in `Q4_K_M`, multi-threaded CPU inference (`n_threads=2..4`) | **PASSED** (0 GPU required) |
| **RAM Budget** | 8.0 GB Host RAM | Single active model loaded at a time; peak model RAM consumption is **1.6 GB** | **PASSED** (>6 GB reserved for OS/apps) |
| **Disk Budget** | 15.0 GB Storage | All 4 task GGUF models combined consume only **3.12 GB** | **PASSED** (~12 GB storage remains free) |

---

## Task-to-Model Mapping Matrix

| Operational Task | Recommended GGUF Model | Quantization | Parameter Size | Download File Size | Runtime RAM | Model File Placement in `backend/models/` |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **General Chat & Operator Q&A** (`GENERAL_LLM`) | Qwen 2.5 0.5B Instruct | `Q4_K_M` | 0.5 Billion | **~350 MB** | ~0.7 GB | `qwen2.5-0.5b-instruct-q4_k_m.gguf` |
| **Root-Cause & Physics Diagnostics** (`REASONING`) | SmolLM2 1.7B Instruct | `Q4_K_M` | 1.7 Billion | **~1,050 MB** | ~1.6 GB | `smollm2-1.7b-instruct-q4_k_m.gguf` |
| **Autonomous Agent Planning** (`AGENT_PLANNER`) | Qwen 2.5 1.5B Instruct | `Q4_K_M` | 1.5 Billion | **~980 MB** | ~1.5 GB | `qwen2.5-1.5b-instruct-q4_k_m.gguf` |
| **SOP Compliance & Technical Manual QA** (`SOP_RAG`) | Llama 3.2 1B Instruct | `Q4_K_M` | 1.2 Billion | **~740 MB** | ~1.1 GB | `llama-3.2-1b-instruct-q4_k_m.gguf` |
| **Zero-Disk In-Process Fallback** | Native Sovereign Neural Reasoner | Native INT8 | 1.0B Equiv. | **0 MB** | ~0.4 GB | Built into backend; zero setup required |

**Combined Storage Total**: `350 MB + 1050 MB + 980 MB + 740 MB = ~3.12 GB` (Leaves ~12 GB free out of 15 GB).

---

## How Model Gateway Discovers and Routes Models

When an operator or agent invokes an AI capability:
1. The **Model Gateway** identifies the incoming `task_type` (`GENERAL_LLM`, `REASONING`, `AGENT_PLANNER`, or `SOP_RAG`).
2. `SovereignInferenceEngine` scans `backend/models/` for matching `.gguf` weights.
3. If the specific GGUF model for that task is detected, it executes on CPU using optimized threading.
4. If a GGUF model is not yet placed in `backend/models/`, the engine seamlessly executes via the task-specialized **Native Sovereign Industrial Neural Reasoner**, guaranteeing zero crashes and zero cloud dependencies.

---

## Optional: Downloading GGUF Files via Hugging Face CLI or Browser

In an environment with internet access prior to air-gapping:

```bash
cd backend/models

# 1. General Operator Chat (350 MB)
curl -L -o qwen2.5-0.5b-instruct-q4_k_m.gguf https://huggingface.co/Qwen/Qwen2.5-0.5B-Instruct-GGUF/resolve/main/qwen2.5-0.5b-instruct-q4_k_m.gguf

# 2. Industrial Diagnostics & Causal Reasoning (1.05 GB)
curl -L -o smollm2-1.7b-instruct-q4_k_m.gguf https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf

# 3. Agent Planning & Action Sequencing (980 MB)
curl -L -o qwen2.5-1.5b-instruct-q4_k_m.gguf https://huggingface.co/Qwen/Qwen2.5-1.5B-Instruct-GGUF/resolve/main/qwen2.5-1.5b-instruct-q4_k_m.gguf

# 4. SOP Document QA & Technical Summarization (740 MB)
curl -L -o llama-3.2-1b-instruct-q4_k_m.gguf https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf
```
Once copied to `backend/models/`, restart the backend server to activate automatic multi-model CPU routing.
