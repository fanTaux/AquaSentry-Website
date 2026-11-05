# AquaSentry - Pusat Lihat Data & Kontrol Telemetri (MQTT HiveMQ Cloud)

Modul ini adalah pusat kendali dan pemantau data (*Live Telemetry Viewer*) terpadu untuk seluruh varian firmware AquaSentry:
- **Percobaan 1**: Embedded Edge AI Standard (Konsensus 30 detik)
- **Percobaan 2**: Dynamic Thresholding TDS dengan korelasi kekeruhan (Turbidity)
- **Percobaan 3**: Full Edge AI (Inferensi lokal Random Forest 25 pohon, Button-Triggered, Display LCD, dan Identitas Unik Perangkat)

Semua eksperimen dipantau dan dikontrol melalui satu direktori terpusat ini tanpa perlu skrip terpisah di tiap folder.

---

## Fitur Utama

1. **Multi-Device & Multi-Experiment Tracking**:
   - Mendeteksi `device_id` unik perangkat ESP32 secara otomatis (misal `AQ-B4E62D`).
   - Mendeteksi `experiment_id` (`percobaan_1`, `percobaan_2`, `percobaan_3`).
2. **Kategori Lokal & Standar**:
   - Menampilkan kategori bahasa lokal (`Aman`, `Medium`, `Berbahaya`) serta status payload standar (`Low`, `Medium`, `High`).
3. **Kendali Jarak Jauh (Cloud MQTT)**:
   - Memilih Opsi 1 (Low), Opsi 2 (Medium), Opsi 3 (High), atau Opsi 4 (Kustom TDS & Turbiditas).
   - Memulai (`START_TEST`) atau membatalkan (`CANCEL_TEST`) sesi pengujian secara langsung dari laptop.
   - Mereset kembali ke pembacaan sensor fisik analog PCB (`RESET_SENSOR`).
4. **Bebas Batasan Jaringan**:
   - Menggunakan broker cloud publik terenkripsi (HiveMQ Cloud TLS 8883), sehingga laptop dan ESP32 tidak harus berada dalam jaringan Wi-Fi yang sama.

---

## Struktur Berkas

```
AquaSentry_EdgeAI_and_Injectors/lihat_data/
├── .env                  # Kredensial HiveMQ Cloud
├── .env.example          # Template konfigurasi broker
├── config.py             # Konfigurasi koneksi HiveMQ Cloud & parameter sampling
├── live_viewer.py        # Antarmuka CLI interaktif realtime (Menu Opsi, hitung mundur & status LED)
├── mqtt_viewer.py        # Dashboard CLI pemantau telemetri MQTT ringan
└── requirements.txt      # Dependensi Python (paho-mqtt, python-dotenv)
```

---

## Cara Menjalankan

### 1. Instalasi Dependensi
```bash
pip install -r requirements.txt
```

### 2. Menjalankan Live Viewer Interaktif (Rekomendasi)
```bash
python live_viewer.py
```

### 3. Menjalankan MQTT Viewer Ringan
```bash
python mqtt_viewer.py
```
