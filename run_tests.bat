@echo off
echo ===================================================
echo Running Sovereign Industrial AI Workbench Test Suite
echo ===================================================
cd backend
python -m pytest tests -v
pause
