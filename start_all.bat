@echo off
title SkyGuard AI - 3-Node Architecture Launcher
echo =========================================================================
echo       SkyGuard AI -- 3-Node Weather Anomaly Detection System
echo       Central AWS Telemetry Network & Edge AI Hub
echo =========================================================================
echo.
echo [1/3] Starting Cloud Backend & IMD Retraining Portal (Port 8000)...
start "SkyGuard Cloud Portal (Port 8000)" cmd /k "python -m uvicorn cloud.cloud_main:app --host 127.0.0.1 --port 8000 --reload"

echo [2/3] Starting Static Web Server for Sender & Receiver Nodes (Port 5500)...
start "SkyGuard Sender/Receiver Web Server (Port 5500)" cmd /k "python -m http.server 5500"

echo.
echo Waiting 2 seconds for services to initialize...
timeout /t 2 /nobreak > nul

echo [3/3] Opening Browser Nodes:
echo   - Sender Node:   http://localhost:5500/sender/stations.html
echo   - Receiver Node: http://localhost:5500/receiver/dashboard.html
echo   - Cloud Portal:  http://localhost:8000/
echo.
start http://localhost:5500/sender/stations.html
start http://localhost:5500/receiver/dashboard.html
start http://localhost:8000/

echo =========================================================================
echo All 3 nodes launched! Press any key to close this launcher script.
echo (The two service console windows will remain running in the background.)
echo =========================================================================
pause > nul
