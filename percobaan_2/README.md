# AquaSentry - Firmware Percobaan 2 (Dynamic Thresholding & Correlation)

Firmware ini merupakan implementasi pengujian mandiri berbasis ambang batas (*thresholding*) TDS dengan penyesuaian korelasi nilai kekeruhan (*turbidity*) yang realistis.

---

## Karakteristik Firmware

1. **Thresholding TDS & Turbiditas Masuk Akal**:
   - Menghitung kategori air secara cerdas berdasarkan ambang batas TDS dan korelasi optik kekeruhan tanpa memerlukan model ML eksternal yang besar.
2. **Kompatibilitas Penuh**:
   - Mengirimkan data telemetri dan hasil akhir konsensus 30 detik melalui HiveMQ Cloud MQTT ke website tanpa perubahan skema.
3. **Pusat Lihat Data Terpadu**:
   - Untuk memantau telemetri atau mengirimkan opsi data, gunakan skrip terpadu di:
     `AquaSentry_EdgeAI_and_Injectors/lihat_data/`

---

## Berkas Firmware

- `percobaan_2.ino`: Skrip firmware utama (dapat dibuka langsung di Arduino IDE).
- `config.h`: Konfigurasi pinout hardware, ambang batas ADC, dan kredensial HiveMQ Cloud.
- `portal_html.h`: Halaman web Captive Portal modern untuk konfigurasi Wi-Fi & Device ID.
- `rf_model.h`: Modul klasifikasi ambang batas terintegrasi.
