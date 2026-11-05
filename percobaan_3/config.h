#ifndef CONFIG_H
#define CONFIG_H

#include <Arduino.h>

// =============================================================================
// IDENTITAS PERCOBAAN & PERANGKAT
// =============================================================================
#define EXPERIMENT_ID "percobaan_3"
#define FIRMWARE_VERSION "3.0.0-FullEdgeAI"

// =============================================================================
// KONFIGURASI PIN HARDWARE (ESP32)
// =============================================================================
#if defined(ESP32)
  // Input Sensor Analog (ADC1 - Aman saat Wi-Fi Aktif)
  const int PIN_TDS               = 34; // Sinyal Analog TDS (GPIO 34 / ADC1_CH6)
  const int PIN_TURBIDITY         = 35; // Sinyal Analog Turbidity (GPIO 35 / ADC1_CH7)

  // Indikator LED Fisik Hasil Klasifikasi
  const int PIN_LED_RED           = 23; // LED Merah  -> Berbahaya / High (GPIO 23)
  const int PIN_LED_YELLOW        = 22; // LED Kuning -> Medium / Sedang  (GPIO 22)
  const int PIN_LED_GREEN         = 25; // LED Hijau  -> Aman / Low       (GPIO 25)

  // Indikator Status & Tombol Trigger
  const int PIN_LED_STATUS        = 33; // LED Biru Status (Solid=Standby, Blink=Uji)
  const int PIN_BUTTON            = 32; // Push Button Mulai Uji (INPUT_PULLUP ke GND)

  // Pin I2C LCD Display (16x2 atau 20x4)
  // Gunakan SDA=21 dan SCL=19 agar tidak bertabrakan dengan LED Kuning (GPIO 22)
  const int PIN_LCD_SDA           = 21; // GPIO 21 (I2C SDA)
  const int PIN_LCD_SCL           = 19; // GPIO 19 (I2C SCL Terpisah)
  const uint8_t LCD_I2C_ADDR      = 0x27; // Alamat umum I2C: 0x27 atau 0x3F
  const int LCD_COLS              = 16;
  const int LCD_ROWS              = 2;

  // Parameter ADC ESP32
  const float VREF                = 3.3f;       // Tegangan referensi ADC ESP32 (Volt)
  const float ADC_RESOLUTION      = 4095.0f;    // 12-bit ADC ESP32 (0 - 4095)
#else
  const int PIN_TDS               = A0;
  const int PIN_TURBIDITY         = A0;
  const int PIN_LED_GREEN         = D1;
  const int PIN_LED_YELLOW        = D2;
  const int PIN_LED_RED           = D3;
  const int PIN_LED_STATUS        = D4;
  const int PIN_BUTTON            = D5;
  const int PIN_LCD_SDA           = D2;
  const int PIN_LCD_SCL           = D1;
  const uint8_t LCD_I2C_ADDR      = 0x27;
  const int LCD_COLS              = 16;
  const int LCD_ROWS              = 2;
  const float VREF                = 3.3f;
  const float ADC_RESOLUTION      = 1023.0f;
#endif

// =============================================================================
// PARAMETER KALIBRASI SENSOR (TEKNIS & EMPIRIS)
// =============================================================================
// 1. Kalibrasi TDS (Total Dissolved Solids)
// Faktor pengali kalibrasi K_TDS = (TDS_larutan_standar / TDS_terbaca). Default: 1.0
const float TDS_CALIBRATION_FACTOR   = 1.0f;
const float DEFAULT_TEMPERATURE_C    = 25.0f; // Suhu standar referensi kalibrasi (°C)

// 2. Kalibrasi Turbiditas (Kekeruhan Optik)
// Tegangan output fototransistor saat sensor berada di air jernih/distilasi (NTU ~ 0)
const float TURBIDITY_CLEAR_VOLTAGE  = 2.50f; // Volt (sesuaikan potensiometer modul)
const float TURBIDITY_SPAN_NTU       = 500.0f; // Rentang NTU skala penuh
const float TURBIDITY_MIN_VOLTAGE    = 0.20f; // Batas bawah tegangan air sangat keruh

// =============================================================================
// PARAMETER EDGE AI, WINDOWING, & TIMING
// =============================================================================
const int WINDOW_SIZE                  = 50;    // Jendela 5 Detik = 50 Sampel pada 10 Hz
const unsigned long SAMPLE_INTERVAL_MS = 100;   // Frekuensi sampling: 10 Hz (100 ms)
const unsigned long BLINK_INTERVAL_MS  = 150;   // Kedip cepat LED status saat uji
const unsigned long RESULT_DISPLAY_MS  = 8000;  // Tampilan hasil di LCD sebelum standby (8s)
const unsigned long DEBOUNCE_DELAY_MS  = 80;    // Anti-glitch debounce tombol fisik (ms)

// =============================================================================
// KONFIGURASI WI-FI & CAPTIVE PORTAL PROVISIONING
// =============================================================================
const char *AP_SSID                    = "ESP32_AquaSentry";
const char *AP_PASSWORD                = "12345678"; // Password hotspot setup ESP32
const byte DNS_PORT                    = 53;
const int SERVER_PORT                  = 8080;

// =============================================================================
// KONFIGURASI MQTT HIVEMQ CLOUD (TLS PORT 8883)
// =============================================================================
const char *MQTT_BROKER                = "4ecff5933a704e218192a9a9390c3580.s1.eu.hivemq.cloud";
const int   MQTT_PORT                  = 8883;
const char *MQTT_USER                  = "Aquasentry";
const char *MQTT_PASS                  = "admin123";

// Topik Standar Website (Kompatibel 100%)
const char *MQTT_TOPIC_TELEMETRY       = "aquasentry/water_quality/telemetry";
const char *MQTT_TOPIC_RESULT          = "aquasentry/water_quality/result";
const char *MQTT_TOPIC_STATUS          = "aquasentry/status";
const char *MQTT_TOPIC_COMMAND         = "aquasentry/command";

#endif // CONFIG_H
