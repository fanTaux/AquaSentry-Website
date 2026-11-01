@echo off
title AquaSentry - Web Platform Launcher
color 0B

echo ===============================================================================
echo                    AQUASENTRY - WEB PLATFORM LAUNCHER
echo ===============================================================================
echo.
echo Menyiapkan lingkungan dan memeriksa dependensi...
echo.

REM Dapatkan path folder proyek tanpa trailing backslash
set "PROJECT_DIR=%~dp0"
if "%PROJECT_DIR:~-1%"=="\" set "PROJECT_DIR=%PROJECT_DIR:~0,-1%"

REM Cek Python
where python >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Python tidak ditemukan di PATH sistem!
    echo Silakan install Python atau tambahkan Python ke PATH Windows.
    echo.
    pause
    exit /b 1
)

REM Cek Node / NPM
where npm >nul 2>nul
if %errorlevel% neq 0 (
    color 0C
    echo [ERROR] Node.js / NPM tidak ditemukan di PATH sistem!
    echo Silakan install Node.js dari https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [OK] Python dan Node.js terdeteksi.
echo.

echo [1/3] Menjalankan Backend FastAPI (Port 8000)...
cd /d "%PROJECT_DIR%\backend"
start "AquaSentry Backend" cmd /k "title AquaSentry Backend && python app.py"

echo [2/3] Menjalankan Frontend React Vite (Port 5173)...
cd /d "%PROJECT_DIR%\my-react-app"
start "AquaSentry Frontend" cmd /k "title AquaSentry Frontend && npm run dev"

REM Kembali ke direktori proyek utama
cd /d "%PROJECT_DIR%"

echo.
echo [3/3] Menunggu 4 detik agar server siap sebelum membuka browser...
timeout /t 4 /nobreak >nul

echo [OK] Membuka Dashboard AquaSentry di browser...
start http://localhost:5173

echo.
echo ===============================================================================
echo   WEBSITE AQUASENTRY BERHASIL DIJALANKAN!
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
