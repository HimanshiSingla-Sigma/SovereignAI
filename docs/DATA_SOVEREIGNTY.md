# Data Sovereignty and Air-Gapped Industrial Policy

## 1. Principle of Total Sovereignty
The Sovereign Industrial AI Workbench is engineered from the ground up for strict on-premise, air-gapped industrial deployment.
**No operational telemetry, technical documents, conversational records, engineering audit traces, or AI inference requests ever leave the customer premises.**

---

## 2. Data Flow and Boundary Matrix

| Data Classification | Storage Location | Processing Location | Network Boundary | External Transmission | Retention Policy |
|---|---|---|---|---|---|
| **Industrial Telemetry** | Local PostgreSQL / SQLite | Local Digital Twin Simulator / Gateway | Internal LAN Only | **NONE (0%)** | Configurable (Default: 90 Days) |
| **Technical Manuals / SOPs** | Local Disk (`data/documents`) | Local Hybrid Chunker & OCR Engine | Host System Only | **NONE (0%)** | Permanent until deleted by Admin |
| **Vector Embeddings** | Local Vector Store (`data/vectordb` / Qdrant) | Local Embedding Model | Internal LAN Only | **NONE (0%)** | Synchronized with source documents |
| **Knowledge Graph (GraphRAG)** | Local Neo4j / In-Memory Graph | Local Cypher Traversal Engine | Internal LAN Only | **NONE (0%)** | Continuous entity-relationship history |
| **LLM Inference** | RAM / VRAM (Local GGUF / llama-cpp-python) | Local Hardware (Apple Silicon Metal / NVIDIA GPU / CPU) | Host Memory Only | **NONE (0%)** | Ephemeral per turn |
| **Conversations & Sessions** | Local Relational DB (`conversations`, `messages`) | Local FastAPI Backend | Internal LAN Only | **NONE (0%)** | User-isolated, persistent across restarts |
| **Hardware Control Commands** | Local Audit DB | Deterministic Safety Engine & Actuator Layer | Host System Only | **NONE (0%)** | Immutable audit log |

---

## 3. Air-Gapped Network Verification
When the deployment mode is set to `air_gapped`:
1. All external HTTP/HTTPS egress connections to third-party AI APIs (OpenAI, Anthropic, Gemini, Groq, Together, OpenRouter) are strictly prohibited and disabled.
2. In the event an external endpoint is configured, the Sovereign Model Gateway fails safely with an explicit error rather than leaking industrial data.
3. System functions with full fidelity with `Internet = OFF`.

---

## 4. Hardware Awareness and Single-Model Residency
To prevent GPU VRAM exhaustion on standard ~8 GB industrial servers:
- Model Gateway enforces resource-aware execution.
- High-priority reasoning models reside in memory while CPU handles lightweight embedding, OCR, and deterministic calculations.
- Safe model unloading and garbage collection are automatically invoked prior to model switching.
