# AquaSentry - Sistem Monitoring Kualitas Air & Edge AI (TDS & Turbidity)

Sistem pemantauan kualitas air terintegrasi mencakup akuisisi data nirkabel dari ESP32 (10 Hz), pengolahan Machine Learning (Windowing 5 detik), kompilasi Edge AI ke C++, dashboard backend FastAPI, antarmuka GUI Desktop Tester, serta antarmuka web interaktif React.

---

## 📂 Struktur Direktori Proyek

```text
Bali/
├── AquaSentry-Website/           # Aplikasi Web & Frontend React (Branch alvin)
│   ├── my-react-app/             # Kode antarmuka React + Vite
│   ├── backend/                  # Salinan backend terpadu
│   └── aquasentry_core.py        # Core skoring & inferensi
├── backend/                      # Backend API REST FastAPI modular
│   ├── app/                      # Routes, Models, Services
│   ├── app.py                    # Entrypoint server FastAPI
│   └── locations_saved.json      # Cache lokasi sensor
├── esp_firmware/                 # Firmware ESP32 Akuisisi Data Sensor
│   ├── esp_firmware.ino          # Firmware transmisi TCP Socket 10 Hz
│   └── tds_hardware_checker/     # Utilitas kalibrasi & cek ADC TDS
├── python_recorder/              # Utilitas Perekam Data & GUI Tester
│   ├── config.py                 # Konfigurasi IP & Port TCP ESP32
│   ├── data_client.py            # Socket client TCP
│   ├── data_saver.py             # Perekam otomatis ke CSV
│   ├── inference_viewer.py       # Desktop GUI Edge AI Water Tester (5s Test on Demand)
│   ├── main.py                   # Menu interaktif perekaman
│   └── dataset/                  # 37 file dataset CSV resmi (Low, Med, High)
├── training/                     # Pipeline ML Windowing & Edge AI Compiler
│   ├── config.yaml               # Konfigurasi segmentasi & hyperparameter
│   ├── preprocess.py             # Feature extraction (8 fitur statistik)
│   ├── train.py                  # Benchmarking 5 model ML & export C++
│   ├── plot_dataset.py           # Generator Scatter Plot 300 DPI (Dark & Light)
│   ├── export_cpp.py             # Transpiler scikit-learn ke kode C++ Arduino
│   ├── benchmark_summary.txt     # Ringkasan akurasi & ukuran memori model C++
│   ├── models/                   # Model terbobot (*.joblib)
│   └── esp/                      # Header C++ (rf_model.h) untuk ESP32
├── scatter_plot_3_kelas.png      # Visualisasi distribusi dataset (Dark)
├── scatter_plot_dark.png         # Scatter plot 300 DPI latar hitam
├── scatter_plot_light.png        # Scatter plot 300 DPI latar putih (Publikasi)
├── aquasentry_core.py            # Modul evaluasi skoring (ARI, ASS, ML)
└── README.md                     # Dokumentasi panduan proyek
```

---

## 📶 1. Opsi Koneksi Jaringan ESP32

### Opsi A: Gabung ke Wi-Fi Rumah / HP (Sangat Direkomendasikan 👍)
1. Buka `esp_firmware/esp_firmware.ino`.
2. Pastikan `#define USE_HOME_WIFI true`.
3. Masukkan SSID dan Password Wi-Fi Anda:
   ```cpp
   const char *wifi_ssid     = "NAMA_WIFI_RUMAH_ANDA";
   const char *wifi_password = "PASSWORD_WIFI_RUMAH";
   ```
4. Upload firmware ke ESP32. Catat IP ESP32 di Serial Monitor (`115200 baud`, contoh: `192.168.1.15`).
5. Jalankan `python python_recorder/main.py` dan pilih menu `2` untuk memasukkan IP ESP32 tersebut.

### Opsi B: Mode Access Point (AP) ESP32
1. Set `#define USE_HOME_WIFI false` di `esp_firmware/esp_firmware.ino`.
2. Hubungkan laptop ke WiFi `ESP_DA_Logger` (Password: `12345678`).
3. IP default: `192.168.4.1`.

---

## 📊 2. Perekaman Data & Desktop GUI Tester

### A. Perekaman Dataset Otomatis
```bash
cd python_recorder
python main.py
```
Pilih opsi `1` dan tentukan label data (`low`, `medium`, atau `high`). Format CSV yang disimpan ke `python_recorder/dataset/`:
`pc_timestamp`, `esp_timestamp_ms`, `label`, `sample_id`, `tds_raw`, `tds_voltage`, `tds_ppm`, `turbidity_raw`, `turbidity_voltage`, `turbidity_ntu`

### B. Menjalankan Desktop GUI Edge AI Water Tester (5s Test)
```bash
cd python_recorder
python inference_viewer.py
```
Aplikasi GUI interaktif dengan progress bar 5 detik, klasifikasi langsung, dan embedded scatter plot.

---

## 🚀 3. Pipeline Machine Learning & Edge AI

### A. Preprocessing & Ekstraksi Jendela (Windowing 5 Detik / 50 Sampel @ 10 Hz)
```bash
cd training
python preprocess.py
```
Mengekstraksi **8 fitur statistik**:
- `tds_mean`, `tds_std`, `tds_min`, `tds_max`
- `turb_mean`, `turb_std`, `turb_min`, `turb_max`

### B. Benchmarking Model & Ekspor Header C++ untuk ESP32
```bash
python train.py
```

**Tabel Hasil Benchmarking Model:**
| Model Algoritma | Unseen Test Accuracy | 5-Fold Group CV | Ukuran Header C++ |
|---|:---:|:---:|:---:|
| **Random Forest (Pilihan Utama)** | **100.00%** | **99.53% ± 0.44%** | **15.63 KB** |
| **Linear SVM** | 99.94% | 99.85% ± 0.26% | 1.49 KB |
| **KNN** | 100.00% | 99.95% ± 0.09% | 80.38 KB |
| **Naive Bayes** | 100.00% | 99.99% ± 0.02% | 1.00 KB |
| **Decision Tree** | 97.79% | 98.75% ± 1.18% | 1.16 KB |

*File C++ Random Forest otomatis dihasilkan di `training/esp/esp_firmware_edge_ai/rf_model.h`.*

### C. Pembuatan Scatter Plot Resmi (300 DPI)
```bash
python plot_dataset.py
```
Menghasilkan:
- `scatter_plot_dark.png` (Tema gelap untuk visualisasi dashboard)
- `scatter_plot_light.png` (Tema terang untuk dokumen paper / laporan lomba)

---

## 💻 4. Menjalankan Backend & Website

### A. Menjalankan Backend FastAPI:
```bash
cd backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
Akses dokumentasi Swagger API di: `http://127.0.0.1:8000/docs`

### B. Menjalankan Frontend React:
```bash
cd AquaSentry-Website/my-react-app
npm run dev
```
Akses web di: `http://localhost:5173`
