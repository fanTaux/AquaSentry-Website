# 💧 AquaSentry: End-to-End IoT & Edge AI Water Safety Screening System

**Alat skrining dini kualitas air portabel berbasis IoT & Edge AI**, dirancang untuk pekerja lapangan (hutan, tambang, bencana) dan petualang outdoor yang mengandalkan sumber air yang belum diketahui kualitasnya — mata air, sungai, atau penampungan air di lokasi transit.

Proyek ini mencakup seluruh ekosistem **AquaSentry**:
1. 🌐 **Frontend React Web App** (`my-react-app/`)
2. ⚡ **Backend FastAPI Service** (`backend/`)
3. 🤖 **Machine Learning Training & Visualizations** (`training/` & `data/`)
4. 📡 **Firmware Mikrokontroler ESP32 & TinyML Engine** (`esp32/`)
5. 🛠️ **Perekam Serial & Utility Tools** (`tools/`)

---

## 🌊 Arsitektur & Fitur Utama

- **Dual-Mode System**:
  - **Mode Offline (Standalone Edge AI)**: ESP32 melakukan klasifikasi inferensi lokal di dalam chip ($\approx 0{,}0001\text{ ms}$) menggunakan header `aquasentry_model.h` (Decision Tree Pruned) dan langsung mengendalikan lampu **RGB LED Fisik** (`Hijau` / `Kuning` / `Merah`).
  - **Mode Online (Web Dashboard Sync)**: Ketika terhubung Wi-Fi, data telemetri $5\text{ Hz}$ dikirim ke FastAPI Backend dan disajikan pada React Dashboard.
- **3 Kategori Risiko Air (3 Risk Labels)**:
  - 🟢 **Low Risk** (Hijau): Air relatif aman untuk kebutuhan dasar.
  - 🟡 **Moderate Risk** (Kuning): Air mendekati ambang batas, gunakan dengan hati-hati.
  - 🔴 **High Risk** (Merah): Air berisiko tinggi melebihi ambang batas baku mutu.

---

## 📁 Struktur Repository Modular

```
AquaSentry-Website/
├── my-react-app/            # 🌐 Dashboard Web App (React 19, Vite, Tailwind CSS)
├── backend/                 # ⚡ Backend API Engine (FastAPI, Python)
│   ├── app/
│   │   ├── routes/          # REST Endpoints (telemetry, wifi, locations, health)
│   │   ├── services/        # Logic (telemetry, location, wifi)
│   │   └── models/          # Pydantic Schemas
│   └── app.py
├── esp32/                   # 📡 Firmware C++ & TinyML Header (ESP32)
│   ├── aquasentry_model.h   # C++ Native Decision Tree Model (< 2 KB)
│   ├── Dummy_aquasentry_esp32/
│   └── aquasentry_esp32/
├── training/                # 🤖 Pipeline Benchmark 8 Model ML & Visualisasi
│   ├── model/               # Model Terlatih (.joblib & .pkl)
│   ├── results/             # Tabel Evaluasi & Confusion Matrix Grid
│   ├── Request_Gambar_Alvin/# Visualisasi Gambar High-Res 300 DPI
│   └── src/                 # Script Training, Evaluator, & C++ Exporter
├── data/                    # 📊 Master Dataset & Rekaman Sensor Serial
│   ├── data_alvin.csv       # Dataset Utama 7.520 Sampel (3 Label)
│   └── recordings/          # Berkas Rekaman CSV Real Sensor
├── tools/                   # 🛠️ Utility Scripts
│   ├── record_sensor_serial.py
│   └── generate_data_alvin.py
├── aquasentry_core.py       # Core Python Inference & Scoring Engine
├── model_aquasentry_alvin.joblib # Master Trained Model (Random Forest 95.21%)
└── README.md
```

---

## 🏆 ITCC 2026

Dikembangkan untuk **Information Technology Creative Competition (ITCC) 2026** — Fakultas Teknik, Universitas Udayana. Subtema: **Smart Health & Accessible Care**.

---

## 🚀 Cara Menjalankan

### 1. Frontend Dashboard (React)
```bash
cd my-react-app
npm install
npm run dev
```

### 2. Backend API (FastAPI)
```bash
pip install -r backend/requirements.txt
python backend/app.py
```

### 3. Perekam Data Serial ESP32 (Port COM20)
```bash
python tools/record_sensor_serial.py COM20
```

---

## 👥 Tim
Dikembangkan untuk ITCC 2026 — Universitas Udayana.