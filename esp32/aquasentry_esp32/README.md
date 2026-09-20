# 📡 Firmware AquaSentry ESP32 (Edge AI / TinyML On-Chip Inference)

Firmware ini berisi kode program **Arduino/C++** untuk Mikrokontroler **ESP32 Dev Module** yang mengintegrasikan **Machine Learning Tertanam (Edge AI / TinyML)** langsung di dalam chip ESP32.

---

## 🤖 Mengapa Edge AI / Mode Offline Sangat Penting?

Di lapangan (hutan, area tambang, atau pegunungan), koneksi internet/Wi-Fi seringkali **tidak tersedia**. AquaSentry dirancang dengan arsitektur **Dual-Mode**:

1. **Mode Offline (Edge AI / Standalone)**:
   * Model Machine Learning hasil pelatihan **Data Alvin** diekspor secara otomatis menjadi kode C++ native di **[`aquasentry_model.h`](file:///c:/Users/alvin/Documents/vscode_apin/Lomba/Bali/esp32/aquasentry_model.h)**.
   * ESP32 mengeksekusi prediksi Machine Learning secara **lokal di dalam chip** (kecepatan eksekusi $\approx 0,001\text{ ms}$).
   * ESP32 langsung mengendalikan lampu **RGB LED Fisik** (`Hijau` / `Kuning` / `Oranye` / `Merah`) tanpa membutuhkan koneksi server maupun sinyal internet.

2. **Mode Online (Web Dashboard Sync)**:
   * Ketika ESP32 terhubung ke Wi-Fi, data telemetri real-time ($5\text{ Hz}$) disinkronkan ke **Web Dashboard React** sehingga pengguna mendapat tampilan grafik visual, histori, dan rekomendasi yang lebih detail.

---

## 🔌 Skema Pinout & Wiring Hardware

| Komponen | Pin ESP32 | Tipe Pin | Keterangan |
| :--- | :---: | :---: | :--- |
| **Sensor TDS (Analog)** | `GPIO 34` | ADC Input (A0) | Membaca konduktivitas/kandungan terlarut (mg/L) |
| **Sensor Turbidity (Analog)** | `GPIO 35` | ADC Input (A1) | Membaca tingkat kekeruhan air (NTU) |
| **LED Indikator Hijau** | `GPIO 25` | Digital Output | Status **Low Risk** (Skrining Aman) |
| **LED Indikator Kuning** | `GPIO 26` | Digital Output | Status **Moderate Risk** (Perlu Kewaspadaan) |
| **LED Indikator Merah** | `GPIO 27` | Digital Output | Status **High Risk** (Air Berisiko / Bahaya) |

---

## 🛠️ Berkas Firmware ESP32

1. **[`aquasentry_model.h`](file:///c:/Users/alvin/Documents/vscode_apin/Lomba/Bali/esp32/aquasentry_model.h)**:
   Engine inferensi Machine Learning C++ native (TinyML). Dihasilkan secara otomatis oleh skrip Python Exporter `training/src/export_model_to_cpp.py`.
2. **[`aquasentry_esp32.ino`](file:///c:/Users/alvin/Documents/vscode_apin/Lomba/Bali/esp32/aquasentry_esp32.ino)**:
   Program utama Arduino C++ yang menjalankan pembacaan sensor 5 Hz, inferensi Edge AI lokal, pengontrol LED fisik, dan sync ke Web Dashboard saat online.
