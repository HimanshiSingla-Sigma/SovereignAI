# Sovereign Industrial AI Workbench

An enterprise-grade, fully sovereign, air-gapped industrial AI application engineered for local hardware execution with zero cloud dependencies.

Built for **Intel Core i3-6006U (2 cores, 4 threads, 2.00 GHz), 12GB RAM, Intel HD Graphics 520**, with an architecture designed to seamlessly scale to dedicated enterprise GPU servers (A100/H100).

---

## Key Capabilities

1. **Hardware-Aware Model Gateway & Local Inference Engine**:
   - Accurately scans CPU, RAM, GPU, VRAM, and OS capabilities.
   - Dynamic memory budgeting: assigns models safely under 3.0 GB allocation limit.
   - Dual execution paths: Native Sovereign CPU Inference Reasoner or quantized GGUF models.
   - Graceful degradation: never crashes due to memory overcommit.

2. **Deterministic Safety Engine & Human-in-the-Loop (HITL)**:
   - Strict separation between AI reasoning and physical actuators. LLM can NEVER trigger actuators directly.
   - Deterministic rule engine evaluating parameter thresholds (Temperature, Vibration, Current, Gas, Multi-Sensor Anomaly).
   - Approval Queue: Emergency Shutdown and setpoint modifications require verified Human-in-the-Loop approval from the Safety Officer.
   - Simulated Actuator Layer: Modifies machine state only after deterministic safety or cryptographic human authorization.

3. **Multi-Machine Digital Twin & Telemetry Simulation**:
   - Pre-configured with 6 industrial assets: `Machine-001`, `Machine-002`, `Machine-003`, `Pump-001`, `Motor-001`, `Compressor-001`, with support for dynamic asset creation.
   - Physics-based telemetry generation for Temperature, Vibration, Current, Gas, Machine Status, and Sensor Health.
   - Simulation profiles: `NORMAL`, `WARNING`, `CRITICAL`, `FAILURE`, `SENSOR_ANOMALY`, `STRESS`.
   - Real-time time series canvas visualization.

4. **Multi-Sensor Correlation Engine & Health/Risk Analytics**:
   - Multivariate covariance and cross-sensor inconsistency detection (e.g. bearing race wear, thermal runaway).
   - Computes normalized Anomaly Score (0-100), Health Score (0-100), Risk Score (0-100), Failure Probability, and Remaining Useful Life (RUL hours).

5. **What-If Virtual Simulation Engine**:
   - Deep-copies live Digital Twin state into an isolated virtual sandbox.
   - Injects hypothetical operational stress variables (temperature delta, vibration delta, load, gas).
   - Evaluates virtual safety state and predicts risk trajectories without modifying live assets.

6. **Private RAG & Local OCR & GraphRAG**:
   - Offline document ingestion for PDFs, scanned inspection drawings, and technical SOPs.
   - Local CPU dense semantic vector embeddings with hybrid BM25 retrieval and exact source citations.
   - Industrial Knowledge Graph linking Machines, Components, Failure Modes, Incidents, and SOPs with multi-hop root-cause path tracing.

7. **Security, RBAC & TOTP MFA**:
   - Multi-Factor Authentication (RFC 6238 TOTP with QR Code enrollment and rate-limiting lockout).
   - Granular RBAC with roles: `OPERATOR`, `ENGINEER`, `SAFETY_OFFICER`, `ADMINISTRATOR`.
   - Admin-only account creation and role assignment.
   - Prompt Guard: blocks prompt injection and adversarial jailbreaks.
   - Output Guard: redacts credentials and confidential tokens.
   - Data Classification: enforces `PUBLIC`, `INTERNAL`, `CONFIDENTIAL`, `RESTRICTED` access clearances.
   - AST-isolated Python Sandbox for safe mathematical evaluation.
   - Immutable Audit Trail with cryptographic SHA-256 tamper verification.

---

## Quick Start (Local Windows)

### 1. Start Backend
Run the backend server on `http://localhost:8000`:
```cmd
start_backend.bat
```
Or manually:
```powershell
cd backend
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 2. Start Frontend
Run the Vite development dashboard on `http://localhost:5173`:
```cmd
start_frontend.bat
```
Or manually:
```powershell
cd frontend
npm run dev
```

### 3. Run Automated Tests
Execute the complete pytest suite (22 tests including Section 48 E2E verification):
```cmd
run_tests.bat
```
Or manually:
```powershell
cd backend
python -m pytest tests -v
```

---

## Default Test Accounts

All default accounts have TOTP MFA enabled. The test secret is `JBSWY3DPEHPK3PXP`.

| Role | Username | Password |
|---|---|---|
| **Administrator** | `admin` | `Admin@Sovereign2026!` |
| **Engineer** | `engineer1` | `Engineer@2026!` |
| **Safety Officer** | `safety1` | `Safety@2026!` |
| **Operator** | `operator1` | `Operator@2026!` |

---

## Docker Deployment

Deploy the entire stack with PostgreSQL, Redis, FastAPI backend, and Nginx frontend:
```bash
docker compose up --build -d
```
The dashboard will be available at `http://localhost:3000`.
