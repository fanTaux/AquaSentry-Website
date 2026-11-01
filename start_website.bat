@echo off
chcp 65001 >nul
title AquaSentry - Web Platform Launcher
color 0B

echo ===============================================================================
echo                🌊 AQUASENTRY - WEB PLATFORM LAUNCHER 🌊
echo ===============================================================================
echo.
echo Menyiapkan lingkungan dan memeriksa dependensi...
echo.

:: Pindah ke folder script saat ini
cd /d "%~dp0"

:: Cek Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Python tidak ditemukan di PATH sistem!
    echo Silakan install Python atau tambahkan Python ke PATH Windows.
    echo.
    pause
    exit /b 1
)

:: Cek Node / NPM
where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js / NPM tidak ditemukan di PATH sistem!
    echo Silakan install Node.js dari https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [✓] Python & Node.js terdeteksi.
echo.
echo [1/3] Menjalankan Backend FastAPI (Port 8000)...
start "AquaSentry - Backend (FastAPI)" cmd /k "cd /d "%~dp0backend" && title AquaSentry Backend && python app.py"

echo [2/3] Menjalankan Frontend React Vite (Port 5173)...
start "AquaSentry - Frontend (React)" cmd /k "cd /d "%~dp0my-react-app" && title AquaSentry Frontend && npm run dev"

echo.
echo [3/3] Menunggu 4 detik agar server siap sebelum membuka browser...
timeout /t 4 /nobreak >nul

echo [✓] Membuka Dashboard AquaSentry di browser...
start http://localhost:5173

echo.
echo ===============================================================================
echo   🎉 WEBSITE AQUASENTRY BERHASIL DIJALANKAN!
echo ===============================================================================
echo   - Frontend Web  : http://localhost:5173
echo   - Backend Docs  : http://127.0.0.1:8000/docs
echo.
echo   [CATATAN PENTING]
echo   Biarkan 2 jendela command prompt (Backend & Frontend) tetap terbuka
echo   selama Anda menggunakan website. Untuk mematikan, cukup tutup kedua
echo   jendela tersebut atau jalankan stop_website.bat.
echo ===============================================================================
echo.
pause
