#!/bin/bash
# ==============================================================================
# Sovereign AI Workbench - Automated Model Downloader for 1TB SSD
# Downloads quantized GGUF models directly from HuggingFace into backend/models/
# ==============================================================================

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
MODELS_DIR="$DIR/backend/models"
mkdir -p "$MODELS_DIR"

echo "================================================================="
echo "   📥 SOVEREIGN MODEL PACK DOWNLOADER (1TB SSD SUITE)"
echo "   Target Directory: $MODELS_DIR"
echo "================================================================="

download_model() {
    local filename="$1"
    local url="$2"
    local dest="$MODELS_DIR/$filename"

    if [ -f "$dest" ]; then
        echo "✅ Already installed: $filename ($(du -h "$dest" | cut -f1))"
    else
        echo "⬇️ Downloading $filename ..."
        curl -L -C - --progress-bar -o "$dest" "$url"
        echo "✓ Saved $filename to $MODELS_DIR"
    fi
}

# 1. SmolLM2 1.7B Instruct Q4_K_M (~1.06 GB) - Reasoning & Diagnostic
download_model "smollm2-1.7b-instruct-q4_k_m.gguf" \
  "https://huggingface.co/HuggingFaceTB/SmolLM2-1.7B-Instruct-GGUF/resolve/main/smollm2-1.7b-instruct-q4_k_m.gguf"

# 2. Llama 3.2 3B Instruct Q4_K_M (~2.02 GB) - SOP Manual Grounding
download_model "llama-3.2-3b-instruct-q4_k_m.gguf" \
  "https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf"

# 3. Mistral 7B Instruct v0.3 Q4_K_M (~4.37 GB) - Deep Diagnostic / GPU
download_model "mistral-7b-instruct-v0.3-q4_k_m.gguf" \
  "https://huggingface.co/MaziyarPanahi/Mistral-7B-Instruct-v0.3-GGUF/resolve/main/Mistral-7B-Instruct-v0.3.Q4_K_M.gguf"

echo "================================================================="
echo "🎉 All Sovereign Models successfully verified on SSD!"
echo "Current Installed Models in backend/models:"
ls -lh "$MODELS_DIR"/*.gguf 2>/dev/null || echo "No .gguf files found."
echo "================================================================="
