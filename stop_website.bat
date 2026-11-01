@echo off
chcp 65001 >nul
title AquaSentry - Stop Servers
color 0E

echo ===============================================================================
echo                🛑 AQUASENTRY - MENGHENTIKAN SERVER WEB 🛑
echo ===============================================================================
echo.
echo Menghentikan proses Backend (Port 8000) dan Frontend (Port 5173)...
echo.

:: Hentikan proses yang memakai port 8000 (Backend FastAPI)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000') do (
    taskkill /f /pid %%a >nul 2>nul
)

:: Hentikan proses yang memakai port 5173 (Frontend Vite)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo [✓] Port 8000 & 5173 telah dibebaskan.
echo [✓] Server AquaSentry berhasil dihentikan.
echo.
pause
