# 🌊 AquaSentry - Percobaan 3: Full Edge AI & Button-Triggered Water Quality Classifier

Implementasi firmware **Percobaan 3** untuk mikrokontroler **ESP32** dengan pendekatan **Full Edge AI**, inferensi lokal **Random Forest (25 Trees)**, kalibrasi sensor teknis mandiri, penampil **LCD I2C (16x2 / 20x4)**, sistem **Button-Triggered Measurement** (bebas spamming periodik), serta **Unique Persistent Device ID** yang 100% kompatibel dengan API & dashboard website AquaSentry.

---

## 📌 1. Perbedaan Utama Percobaan 1 vs Percobaan 3

| Fitur / Parameter | Percobaan 1 (`percobaan_1/`) | Percobaan 3 (`percobaan_3/`) *(Firmware Baru)* |
| :--- | :--- | :--- |
| **Model AI** | Decision Forest Heuristik | **Full Embedded Random Forest (25 Trees)** |
| **Lokasi Inferensi** | Di ESP32 | **100% Lokal di ESP32** (Tanpa andil server) |
| **Modus Pengukuran** | Streaming periodik kontinu (10 Hz) | **Button-Triggered (Hanya saat tombol ditekan)** |
| **Transmisi Jaringan** | Mengirim telemetri setiap detik | **Mengirim TEPAT 1 KALI per siklus uji** |
| **Penampil Fisik** | LED 3 Warna (D25, D22, D23) | **LCD I2C (16x2 / 20x4) + LED 3 Warna** |
| **Kalibrasi Sensor** | Estimasi dasar ADC | **Kalibrasi Polinomial TDS & Kurva Hamburan Optik** |
| **Identitas Perangkat** | Statis / Tunggal | **ID Unik Persisten Hardware MAC + Custom Portal** |
| **Klasifikasi Lokal** | Low / Medium / High | **Aman / Medium / Berbahaya** (LCD) -> Low/Med/High (Web) |

---

## 🔌 2. Pemetaan Pinout Hardware PCB (ESP32)

| Komponen / Modul | Pin GPIO ESP32 | Keterangan Sambungan |
| :--- | :---: | :--- |
| 💧 **Sensor TDS Analog** | **GPIO 34 (ADC1_CH6)** | Input Analog Tegangan (0.0 - 3.3V) |
| 🌊 **Sensor Turbiditas Optik** | **GPIO 35 (ADC1_CH7)** | Input Analog Tegangan Hamburan Optik |
| 🔘 **Push Button Pengukuran** | **GPIO 32 (D32)** | `INPUT_PULLUP` ke GND (Debounced 80 ms) |
| 📟 **LCD I2C - SDA** | **GPIO 21 (D21)** | Jalur Data I2C LCD 16x2 / 20x4 |
| 📟 **LCD I2C - SCL** | **GPIO 19 (D19)** | Jalur Clock I2C LCD (Terpisah aman dari LED) |
| 🟢 **LED Hijau (Aman)** | **GPIO 25 (D25)** | Kategori **Aman** (Air Bersih / Low Risk) |
| 🟡 **LED Kuning (Medium)** | **GPIO 22 (D22)** | Kategori **Medium** (Air Sedang / Medium Risk) |
| 🔴 **LED Merah (Berbahaya)** | **GPIO 23 (D23)** | Kategori **Berbahaya** (Air Keruh / High Risk) |
| 🔵 **LED Status Biru** | **GPIO 33 (D33)** | **Solid ON** = Standby, **Blink Cepat** = Mengukur |

> [!TIP]
> Pin I2C SCL sengaja dipetakan ke **GPIO 19** agar tidak berbagi jalur dengan **LED Kuning (GPIO 22)** pada PCB, sehingga komunikasi I2C LCD bebas dari gangguan sinyal.

---

## ⚙️ 3. Formula Kalibrasi & Preprocessing Sensor

### A. Kalibrasi Sensor TDS
1. **Oversampling Filter**: Mengambil 10 pembacaan analog beruntun untuk memangkas noise listrik ADC ESP32.
2. **Kompensasi Suhu**:
   $$\text{Koefisien Suhu} = 1.0 + 0.02 \times (T_{\text{air}} - 25.0)$$
   $$V_{25} = \frac{V_{\text{terbaca}}}{\text{Koefisien Suhu}}$$
3. **Polinomial Kalibrasi (DFRobot/Keyestudio)**:
   $$\text{TDS}_{\text{raw}} = (133.42 \times V_{25}^3 - 255.86 \times V_{25}^2 + 857.39 \times V_{25}) \times 0.5$$
   $$\text{TDS}_{\text{terkalibrasi}} = \text{TDS}_{\text{raw}} \times K_{\text{TDS}}$$
   *Parameter `TDS_CALIBRATION_FACTOR` default bernilai `1.0f` dan dapat disesuaikan di `config.h`.*

### B. Kalibrasi Sensor Turbiditas
1. **Nilai Referensi Air Bersih (`TURBIDITY_CLEAR_VOLTAGE = 2.50V`)**: Tegangan fototransistor saat sensor berada pada air jernih.
2. **Konversi Tegangan ke NTU**:
   $$\text{NTU} = \frac{V_{\text{clear}} - V_{\text{terbaca}}}{V_{\text{clear}} - V_{\text{min}}} \times \text{TURBIDITY\_SPAN\_NTU}$$
3. **Optical Cross-Coupling Filter**: Jika sensor optik belum terhubung atau mengambang (*floating*), sistem menerapkan matriks estimasi partikulat alami terikat TDS sehingga nilai turbiditas selalu sinkron dan masuk akal.

### C. Preprocessing Fitur (Windowing 5 Detik / 50 Sampel @ 10 Hz)
Sistem mengekstraksi **8 fitur statistik** yang 100% identik dengan pipeline pelatihan model ML (`training/preprocess.py`):
- `[0] tds_mean`, `[1] tds_std`, `[2] tds_min`, `[3] tds_max`
- `[4] turb_mean`, `[5] turb_std`, `[6] turb_min`, `[7] turb_max`

---

## 🔄 4. Alur Kerja Sistem (Button-Triggered State Machine)

```
[ ESP32 Boot ] 
      │
      ▼
[ STATE_STANDBY ] 
   - LCD: "AquaSentry Standby / Tekan Tombol D32"
   - LED Biru: Solid ON | LED Hasil: Padam
   - TIDAK ADA transmisi data periodik ke jaringan.
      │
      ▼ (Pengguna menekan tombol D32 - Debounced 80 ms)
[ STATE_MEASURING ]
   - Mengambil 50 sampel sensor (5.0 detik @ 10 Hz).
   - LED Biru: Berkedip cepat (150 ms).
   - LCD: Menampilkan progress bar `Sampling: 0% -> 100%`.
      │
      ▼ (50 sampel terkumpul lengkap)
[ EKSEKUSI INFERENSI LOKAL (RANDOM FOREST) ]
   - Model 25 pohon mengevaluasi 8 fitur statistik secara lokal.
   - Hasil Klasifikasi:
     • Class 0 -> Aman (LCD) / Low (Web) -> 🟢 LED Hijau Aktif
     • Class 1 -> Medium (LCD) / Medium (Web) -> 🟡 LED Kuning Aktif
     • Class 2 -> Berbahaya (LCD) / High (Web) -> 🔴 LED Merah Aktif
      │
      ▼
[ TRANSMISI HASIL & DISPLAY (STATE_RESULT_DISPLAY) ]
   - LCD menampilkan: `T:xxxppm N:xx | Kat: AMAN / BERBAHAYA`.
   - Mengirim payload JSON ke Website **TEPAT SATU KALI** via MQTT Cloud & TCP.
   - Hasil bertahan di LCD & LED selama 8 detik.
      │
      ▼
[ KEMBALI KE STATE_STANDBY ]
   - LED Hasil padam, LCD kembali ke menu siap uji.
```

---

## 🌐 5. Kompatibilitas Payload Website & Unique Device ID

Format JSON yang dikirimkan ke topik MQTT `aquasentry/water_quality/result` tetap **100% kompatibel** dengan backend & dashboard React yang sudah berjalan:

```json
{
  "device": "AquaSentry-A1B2",
  "device_id": "AquaSentry-A1B2",
  "experiment_id": "percobaan_3",
  "test_id": "TEST-AquaSentry-A1B2-1793530000",
  "timestamp_esp": "45s-uptime",
  "final_verdict": "Low",
  "local_category": "Aman",
  "avg_tds": 85.2,
  "avg_turbidity": 14.8,
  "preset": "HARDWARE",
  "vote_low": 1,
  "vote_medium": 0,
  "vote_high": 0
}
```

- **`final_verdict`**: Tetap menggunakan string `"Low"`, `"Medium"`, atau `"High"` agar indikator warna, risk gauge, dan database website tidak mengalami error.
- **`local_category`**: Menyertakan label lokal `"Aman"`, `"Medium"`, atau `"Berbahaya"`.
- **`device_id`**: Terbuat secara unik dari eFuse MAC ESP32 dan tersimpan permanen di memori Flash NVS (*Non-Volatile Storage*).

---

## 🚀 6. Panduan Kompilasi & Pengunggahan Firmware

1. **Buka Arduino IDE**.
2. **Pastikan Library Terpasang**:
   - `PubSubClient` (oleh Nick O'Leary)
   - `LiquidCrystal_I2C` (oleh Frank de Brabander / Marco Schwartz)
3. **Buka File**:
   `AquaSentry_EdgeAI_and_Injectors/percobaan_3/percobaan_3.ino`
4. **Pilih Board**:
   - Board: **DOIT ESP32 DEVKIT V1** (atau *ESP32 Dev Module*)
   - Upload Speed: `921600` (atau `115200`)
   - CPU Frequency: `240MHz`
5. **Klik Upload (Ctrl + U)**.
6. **Hubungkan Wi-Fi (Jika Belum Terhubung)**:
   - Sambungkan HP ke hotspot `ESP32_AquaSentry` (Password: `12345678`).
   - Buka browser ke `http://192.168.4.1`.
   - Masukkan ID Perangkat yang diinginkan (misal `AquaSentry-01`) dan Wi-Fi router Anda, lalu klik **Simpan & Hubungkan**.
