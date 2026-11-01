@echo off
title AquaSentry - Stop Servers
color 0E

echo ===============================================================================
echo                     AQUASENTRY - MENGHENTIKAN SERVER WEB
echo ===============================================================================
echo.
echo Menghentikan proses Backend (Port 8000) dan Frontend (Port 5173)...
echo.

REM Hentikan proses yang memakai port 8000 (Backend FastAPI)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :8000 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)

REM Hentikan proses yang memakai port 5173 (Frontend Vite)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :5173 ^| findstr LISTENING') do (
    taskkill /f /pid %%a >nul 2>nul
)

echo [OK] Port 8000 dan 5173 telah dibebaskan.
echo [OK] Server AquaSentry berhasil dihentikan.
echo.
pause
