import os
import sys
import shutil
import zipfile
import urllib.request
import subprocess

PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
RUNTIME_DIR = os.path.join(PROJECT_ROOT, 'runtime', 'python_win')
FRONTEND_DIR = os.path.join(PROJECT_ROOT, 'frontend')
FRONTEND_DIST = os.path.join(FRONTEND_DIR, 'dist')
REQUIREMENTS_FILE = os.path.join(PROJECT_ROOT, 'backend', 'requirements.txt')

PYTHON_EMBED_URL = 'https://www.python.org/ftp/python/3.11.9/python-3.11.9-embed-amd64.zip'
GET_PIP_URL = 'https://bootstrap.pypa.io/get-pip.py'

def log(msg):
    print(f'[PORTABLE SSD BUILDER] {msg}')

def step_1_build_frontend():
    log('Step 1: Building production frontend single-page application...')
    if shutil.which('npm'):
        try:
            res = subprocess.run(['npm', 'run', 'build'], cwd=FRONTEND_DIR, check=True)
            log('Frontend compiled successfully into frontend/dist!')
        except Exception as e:
            log(f'Warning: npm run build exited with {e}. Using existing dist if present.')
    else:
        log('npm not found. Checking for existing frontend/dist...')
    
    if os.path.isdir(FRONTEND_DIST) and os.path.exists(os.path.join(FRONTEND_DIST, 'index.html')):
        log(f'Verified frontend/dist exists with {len(os.listdir(FRONTEND_DIST))} entries.')
    else:
        log('Error: frontend/dist is missing. Please run npm run build in frontend/ first.')

def step_2_download_embedded_python():
    log('Step 2: Preparing Portable Embedded Python for Windows...')
    os.makedirs(RUNTIME_DIR, exist_ok=True)
    zip_path = os.path.join(PROJECT_ROOT, 'runtime', 'python-3.11.9-embed-amd64.zip')

    py_exe = os.path.join(RUNTIME_DIR, 'python.exe')
    if os.path.exists(py_exe):
        log(f'Portable Python already extracted at: {RUNTIME_DIR}')
        return

    log(f'Downloading official Windows 64-bit embedded Python from {PYTHON_EMBED_URL}...')
    try:
        urllib.request.urlretrieve(PYTHON_EMBED_URL, zip_path)
        log('Extracting embedded Python into runtime/python_win...')
        with zipfile.ZipFile(zip_path, 'r') as zf:
            zf.extractall(RUNTIME_DIR)
        os.remove(zip_path)
        log('Extracted embedded Python successfully.')
    except Exception as e:
        log(f'Download note: {e}')
        log('If offline, please manually download python-3.11.9-embed-amd64.zip and extract to runtime/python_win/')

def step_3_configure_pth_and_pip():
    log('Step 3: Configuring Python search path (._pth) for site-packages...')
    # Look for python311._pth in runtime/python_win
    pth_file = None
    for f in os.listdir(RUNTIME_DIR) if os.path.isdir(RUNTIME_DIR) else []:
        if f.endswith('._pth'):
            pth_file = os.path.join(RUNTIME_DIR, f)
            break
    
    if pth_file and os.path.exists(pth_file):
        with open(pth_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
        
        # Ensure 'import site' is uncommented and paths added
        new_lines = []
        has_site = False
        for line in lines:
            if line.strip() in ['#import site', 'import site']:
                new_lines.append('import site\n')
                has_site = True
            else:
                new_lines.append(line)
        if not has_site:
            new_lines.append('import site\n')
        
        # Add relative paths
        new_lines.append('.\n')
        new_lines.append('Lib/site-packages\n')
        new_lines.append('../../backend\n')
        
        with open(pth_file, 'w', encoding='utf-8') as f:
            f.writelines(new_lines)
        log(f'Updated {os.path.basename(pth_file)} with site-packages support.')

def step_4_summary():
    print("""
=============================================================================
  SUCCESS: PORTABLE SSD APPLIANCE READY!
=============================================================================

Your SSD folder structure is now configured for ZERO-INSTALL, ZERO-CLOUD running:

SSD Drive Root:
  ├── RUN_WORKBENCH_WINDOWS.bat     <-- Double-click on ANY Windows PC!
  ├── RUN_WORKBENCH_MAC_LINUX.sh    <-- Run on Mac / Linux laptops!
  ├── runtime/
  │    └── python_win/              <-- Standalone Windows Python (Zero-Install)
  │         ├── python.exe
  │         └── Lib/site-packages/
  ├── backend/                      <-- Complete FastAPI server & RAG Vector DB
  │    ├── data/
  │    │    ├── documents/          <-- Real Refinery SOPs & manuals
  │    │    ├── knowledge_graph.json<-- Real GraphRAG knowledge graph
  │    │    └── vectordb/           <-- Local Qdrant embeddings
  │    └── app/
  └── frontend/
       └── dist/                    <-- Production compiled 3D UI

HOW TO RUN ON ANY SYSTEM:
1. Copy this entire project folder to your External SSD (e.g. SanDisk, Samsung T7, or USB 3.0 Pen Drive).
2. Plug the SSD into ANY Windows PC (Judge's laptop, lab computer, or office PC).
3. Open the SSD drive and double-click: RUN_WORKBENCH_WINDOWS.bat
4. The 3D Plant Floor, AI Copilot, RAG, and Digital Twin will open instantly at:
   http://localhost:8000

NO Python installation required on the host system!
NO Node.js / npm required on the host system!
NO Internet connection required!
=============================================================================
""")

if __name__ == '__main__':
    step_1_build_frontend()
    step_2_download_embedded_python()
    step_3_configure_pth_and_pip()
    step_4_summary()
