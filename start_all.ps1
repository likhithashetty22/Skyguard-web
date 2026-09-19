# start_all.ps1
# SkyGuard AI - 3-Node Weather Anomaly Detection System (SIH26073)
# Stakeholder: India Meteorological Department (IMD) | Team SKYE

Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "      SkyGuard AI -- 3-Node Architecture Launcher (SIH26073)" -ForegroundColor Yellow
Write-Host "      Stakeholder: India Meteorological Department (IMD) | Team SKYE" -ForegroundColor White
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host ""

$workspace = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/3] Starting Cloud Backend & IMD Retraining Portal (Port 8000)..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$workspace`" && python -m uvicorn cloud.cloud_main:app --host 127.0.0.1 --port 8000 --reload" -WindowStyle Normal

Write-Host "[2/3] Starting Web Server for Sender & Receiver (Port 5500)..." -ForegroundColor Green
Start-Process -FilePath "cmd.exe" -ArgumentList "/k cd /d `"$workspace`" && python -m http.server 5500" -WindowStyle Normal

Start-Sleep -Seconds 2

Write-Host "[3/3] Opening Web Portals..." -ForegroundColor Green
Start-Process "http://localhost:5500/sender/stations.html"
Start-Process "http://localhost:5500/receiver/dashboard.html"
Start-Process "https://skyguard-web.onrender.com/"

Write-Host ""
Write-Host "=========================================================================" -ForegroundColor Cyan
Write-Host "  All 3 nodes are active and running:" -ForegroundColor Yellow
Write-Host "    • Sender Node:   http://localhost:5500/sender/stations.html" -ForegroundColor White
Write-Host "    • Receiver Node: http://localhost:5500/receiver/dashboard.html" -ForegroundColor White
Write-Host "    • Cloud Central: https://skyguard-web.onrender.com/" -ForegroundColor White
Write-Host "    • OpenAPI Docs:  https://skyguard-web.onrender.com/docs" -ForegroundColor White
Write-Host "=========================================================================" -ForegroundColor Cyan
