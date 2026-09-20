# 🔌 AquaSentry Backend API

Backend API berbasis **FastAPI** yang menghubungkan perangkat keras IoT (ESP32) dengan antarmuka web (React Frontend) dan melayani evaluasi kualitas air real-time menggunakan model **Machine Learning Random Forest** (Data Alvin).

## 🚀 Fitur Backend

- **CORS Enabled**: Mendukung komunikasi seamless dengan React Vite Frontend (`http://localhost:5173`).
- **Skrining Real-time AI**: Mengirimkan data sensor TDS & Turbidity, secara otomatis mengevaluasi $r_{\text{TDS}}$, $r_{\text{Turb}}$, ARI, ASS, serta prediksi risiko Random Forest.
- **REST Endpoints**:
  - `GET /api/health` -> Status kesehatan server & status pemuatan model ML
  - `POST /api/auth/login` -> Autentikasi demo pengguna
  - `GET /api/telemetry/latest` -> Pembacaan sensor & evaluasi risiko terbaru
  - `GET /api/telemetry/history` -> Riwayat 50 data poin terakhir untuk grafik dashboard
  - `POST /api/telemetry` -> Endpoint penerima data dari perangkat ESP32

## 🛠️ Cara Menjalankan Server

1. Pastikan dependen terpasang:
   ```bash
   pip install -r backend/requirements.txt
   ```

2. Jalankan server FastAPI:
   ```bash
   python backend/app.py
   ```
   Atau menggunakan uvicorn langsung:
   ```bash
   uvicorn backend.app:app --host 0.0.0.0 --port 8000 --reload
   ```

3. Dokumentasi Swagger UI interaktif dapat diakses di:
   - `http://localhost:8000/docs`
