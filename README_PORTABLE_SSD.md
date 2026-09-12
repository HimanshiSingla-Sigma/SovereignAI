# Sovereign AI Workbench - Portable SSD Plug & Play Guide

This guide enables running the entire **Sovereign Industrial AI Workbench** directly from an **External SSD or USB Flash Drive** on **ANY computer** without installing Python, Node.js, or any host dependencies.

---

## 1. Files in Root Directory

- **START_WINDOWS.bat** / **RUN_WORKBENCH_WINDOWS.bat**: Double-click on ANY Windows PC!
- **START_MAC.sh** / **RUN_WORKBENCH_MAC_LINUX.sh**: Run on Mac / Linux laptops (`./START_MAC.sh`)
- **PREPARE_PORTABLE_SSD.py**: One-time setup script to bundle portable Python

---

## 2. How to Run on Any Windows Computer (Zero Install)

1. Copy the `SovereignAIWorkbench` folder to your SSD.
2. Plug the SSD into ANY Windows PC.
3. Double-click `START_WINDOWS.bat`.
4. The application opens automatically in the browser at:
   http://localhost:8000

---

## 3. How It Works

- **No Node.js needed**: The React 18 + Three.js frontend is pre-compiled into `frontend/dist`.
- **No Python needed on host**: The SSD uses its own standalone Python in `runtime/python_win`.
- **No Internet needed**: 100% air-gapped, local database, local vector store, local documents.
