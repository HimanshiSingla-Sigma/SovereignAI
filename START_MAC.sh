#!/bin/bash
# ==============================================================================
# Sovereign AI Workbench - 1-Click Portable SSD Launcher (Mac / Linux)
# 100% Air-Gapped Local Edge Execution - Zero Host Dependencies - Plug & Play
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "================================================================="
echo "   🛡️ SOVEREIGN AI WORKBENCH - PORTABLE AIR-GAP APPLIANCE"
echo "   Running directly from SSD: $DIR"
echo "================================================================="

if [ -f "$DIR/backend/venv/bin/python" ]; then
    PY_EXEC="$DIR/backend/venv/bin/python"
elif command -v python3 &> /dev/null; then
    PY_EXEC="python3"
else
    echo "❌ Error: Python 3 is not found on this host system."
    echo "Please install Python 3.10+ or run on Windows with the bundled runtime."
    exit 1
fi

export PYTHONPATH="$DIR/backend:$PYTHONPATH"
export HF_HUB_OFFLINE=1
export TRANSFORMERS_OFFLINE=1
export HF_HUB_DISABLE_TELEMETRY=1
export TOKENIZERS_PARALLELISM=false

mkdir -p "$DIR/backend/models"
mkdir -p "$DIR/backend/data/vectordb"
mkdir -p "$DIR/backend/data/audit"
mkdir -p "$DIR/backend/data/documents"

echo "🚀 Launching Sovereign AI Engine on http://localhost:8000 ..."
echo "   - 3D Digital Twin UI: http://localhost:8000"
echo "   - API Gateway & Swagger Docs: http://localhost:8000/docs"
echo "   - Air-Gap Policy: 100% OFFLINE (Zero Outbound Egress)"
echo "-----------------------------------------------------------------"

(sleep 2 && (open "http://localhost:8000" 2>/dev/null || xdg-open "http://localhost:8000" 2>/dev/null || true)) &

cd "$DIR/backend"
exec "$PY_EXEC" -m uvicorn app.main:app --host 0.0.0.0 --port 8000
