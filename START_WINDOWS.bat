@echo off
REM ==============================================================================
REM Sovereign AI Workbench - 1-Click Portable SSD Launcher (Windows)
REM 100% Air-Gapped Local Edge Execution - Zero Host Dependencies - Plug & Play
REM ==============================================================================

title Sovereign AI Workbench - Tactical Air-Gap Appliance
cd /d "%~dp0"

echo =================================================================
echo    [SHIELD] SOVEREIGN AI WORKBENCH - PORTABLE AIR-GAP APPLIANCE
echo    Drive Root: %~dp0
echo =================================================================

REM Enforce 100% Offline Air-Gap Model Execution
set "HF_HUB_OFFLINE=1"
set "TRANSFORMERS_OFFLINE=1"
set "HF_HUB_DISABLE_TELEMETRY=1"
set "TOKENIZERS_PARALLELISM=false"

REM 1. Check for Portable Embedded Python Runtime on the SSD
set "PORTABLE_PY=%~dp0runtime\python_win\python.exe"
set "VENV_PY=%~dp0backend\venv\Scripts\python.exe"

if exist "%PORTABLE_PY%" (
    echo [OK] Found Standalone Portable Python Runtime on SSD:
    echo      %PORTABLE_PY%
    echo [INFO] Zero host dependencies needed. Running in 100%% isolated mode.
    set "PY_EXEC=%PORTABLE_PY%"
    set "PYTHONPATH=%~dp0backend;%~dp0runtime\python_win\Lib\site-packages;%PYTHONPATH%"
) else if exist "%VENV_PY%" (
    echo [OK] Found Local Venv on SSD: %VENV_PY%
    set "PY_EXEC=%VENV_PY%"
    set "PYTHONPATH=%~dp0backend;%PYTHONPATH%"
) else (
    echo [CHECK] Portable Python not bundled in runtime\python_win. Checking host system...
    where python >nul 2>nul
    if %errorlevel% equ 0 (
        echo [OK] Using Host Python from PATH.
        set "PY_EXEC=python"
        set "PYTHONPATH=%~dp0backend;%PYTHONPATH%"
    ) else (
        echo.
        echo =================================================================
        echo [ERROR] No Python runtime found!
        echo To run on ANY PC without installing Python:
        echo Run 'python PREPARE_PORTABLE_SSD.py' once to bundle portable Python.
        echo =================================================================
        pause
        exit /b 1
    )
)

REM 2. Ensure Required Data Directories Exist on SSD
if not exist "%~dp0backend\models" mkdir "%~dp0backend\models"
if not exist "%~dp0backend\data\vectordb" mkdir "%~dp0backend\data\vectordb"
if not exist "%~dp0backend\data\audit" mkdir "%~dp0backend\data\audit"
if not exist "%~dp0backend\data\documents" mkdir "%~dp0backend\data\documents"

REM 3. Verify Compiled Frontend UI Exists
if not exist "%~dp0frontend\dist\index.html" (
    echo [WARNING] frontend\dist not found! The UI might not load.
    echo Please make sure frontend\dist was copied to the SSD.
)

echo.
echo [LAUNCH] Starting Sovereign AI Engine on http://localhost:8000 ...
echo    - 3D Digital Twin UI: http://localhost:8000
echo    - API Gateway & Swagger Docs: http://localhost:8000/docs
echo    - Sovereign Air-Gap: 100%% OFFLINE (Zero Outbound Egress)
echo =================================================================

REM 4. Launch Browser in Background
start "" http://localhost:8000

REM 5. Start FastAPI / Uvicorn Server (Serves both API and 3D UI on Port 8000)
cd /d "%~dp0backend"
"%PY_EXEC%" -m uvicorn app.main:app --host 0.0.0.0 --port 8000

pause
