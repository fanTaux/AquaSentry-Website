#include <Arduino.h>
#include <Wire.h>
#include <LiquidCrystal_I2C.h>

/*
  =============================================================================
  AQUASENTRY - PERCOBAAN 3: FULL EDGE AI & BUTTON-TRIGGERED WATER CLASSIFIER
  =============================================================================
  Arsitektur & Prinsip Kerja:
  1. 100% Pemrosesan & Inferensi Lokal pada Mikrokontroler ESP32 (Random Forest).
  2. Kalibrasi Teknis TDS & Turbiditas Berdasarkan Nilai Referensi Standar.
  3. Pengukuran Berbasis Tombol Fisik (Button-Triggered) - Bukan Streaming Periodik.
  4. Penampil Visual LCD I2C (Status Standby, Progress Uji, Hasil Klasifikasi).
  5. Identitas Alat Unik & Persisten (Device ID eFuse MAC + Experiment ID).
  6. Kompatibilitas 100% dengan Kontrak Payload API & MQTT Website AquaSentry.
  =============================================================================
*/

#if defined(ESP32)
  #include <WiFi.h>
  #include <WiFiClientSecure.h>
  #include <PubSubClient.h>
  #include <WebServer.h>
  #include <DNSServer.h>
  #include <Preferences.h>
  #include "soc/soc.h"
  #include "soc/rtc_cntl_reg.h"
#elif defined(ESP8266)
  #include <ESP8266WiFi.h>
  #include <WiFiClientSecure.h>
  #include <PubSubClient.h>
  #include <ESP8266WebServer.h>
  #include <DNSServer.h>
#endif

#include "config.h"       // Pinout, Konfigurasi Kalibrasi, Broker MQTT, & Identitas
#include "calibration.h"  // Modul Konversi & Kalibrasi Sensor
#include "portal_html.h"  // Web Captive Portal Setup & Device ID
#include "rf_model.h"     // Model Random Forest Embedded 25 Trees

// =============================================================================
// GLOBAL OBJECTS & STATE
// =============================================================================
IPAddress apIP(192, 168, 4, 1);
DNSServer dnsServer;
WebServer webServer(80);
WiFiServer server(SERVER_PORT);
WiFiClient tcpClient;
Preferences preferences;

// Objek LCD I2C
LiquidCrystal_I2C lcd(LCD_I2C_ADDR, LCD_COLS, LCD_ROWS);
bool isLcdAvailable = false;

// Klien MQTT TLS HiveMQ Cloud
WiFiClientSecure tlsClient;
PubSubClient mqttClient(tlsClient);

// Status Jaringan & Identitas
bool isApModeActive           = false;
String savedSsid              = "";
String savedPassword          = "";
String savedDeviceId          = "";

// State Machine Pengukuran
enum SystemState {
  STATE_STANDBY,        // Kondisi diam menunggu penekanan tombol
  STATE_MEASURING,      // Sedang mengambil 50 sampel (5 detik @ 10 Hz)
  STATE_RESULT_DISPLAY  // Menampilkan hasil uji pada LCD & kirim ke website
};
SystemState currentState = STATE_STANDBY;

// Buffer Windowing 5 Detik (50 Sampel @ 10 Hz)
float tdsWindowBuffer[WINDOW_SIZE];
float turbWindowBuffer[WINDOW_SIZE];
int sampleIndex = 0;

// Pewaktu & Indikator
unsigned long lastSampleTime    = 0;
unsigned long lastBlinkTime     = 0;
bool statusLedBlinkState        = false;
unsigned long stateTimerEnd     = 0;

// Tombol Fisik Anti-Glitch (Debounced)
int lastButtonPhysicalState     = HIGH;
unsigned long lastDebounceTime  = 0;

// Flag Pengiriman Tunggal (Mencegah Duplikasi Data)
bool hasSentResultForCycle      = false;

// Hasil Terakhir
String lastVerdictWebsite       = "Low";      // "Low", "Medium", "High" (Kontrak Website)
String lastVerdictLocal         = "Aman";     // "Aman", "Medium", "Berbahaya" (Tampilan LCD)
float lastAvgTds                = 0.0f;
float lastAvgTurb               = 0.0f;

// Flag Pemicu dari Background Command
volatile bool pendingTriggerTest = false;

// =============================================================================
// PROTOTIPE FUNGSI
// =============================================================================
void startCaptivePortal();
void connectToSavedWifi();
void initLcdDisplay();
void lcdShowStandby();
void lcdShowMeasuring(int currentSample, int totalSamples);
void lcdShowResult(const String &categoryLocal, float tds, float turb);
void setLedsByVerdict(int classIdx);
void clearAllLeds();
void checkPhysicalButton(unsigned long currentMillis);
void startMeasurementCycle();
void processSamplingCycle(unsigned long currentMillis);
void executeEdgeAiInference();
void transmitResultToWebsite();
void publishStatusMqtt(String statusVal);
String generateHardwareId();

// =============================================================================
// GENERATOR ID PERANGKAT HARDWARE PERSISTEN
// =============================================================================
String generateHardwareId() {
#if defined(ESP32)
  uint64_t chipId = ESP.getEfuseMac();
  char buf[24];
  snprintf(buf, sizeof(buf), "AquaSentry-%04X", (uint16_t)(chipId & 0xFFFF));
  return String(buf);
#else
  uint32_t chipId = ESP.getChipId();
  char buf[24];
  snprintf(buf, sizeof(buf), "AquaSentry-%04X", (uint16_t)(chipId & 0xFFFF));
  return String(buf);
#endif
}

// =============================================================================
// INISIALISASI & DETEKSI LCD I2C
// =============================================================================
void initLcdDisplay() {
  Wire.begin(PIN_LCD_SDA, PIN_LCD_SCL);
  Wire.beginTransmission(LCD_I2C_ADDR);
  byte error = Wire.endTransmission();

  if (error == 0) {
    isLcdAvailable = true;
    lcd.init();
    lcd.backlight();
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("AquaSentry Edge");
    lcd.setCursor(0, 1);
    lcd.print("Inisialisasi...");
    Serial.println("[LCD] I2C LCD 16x2 terdeteksi di alamat 0x" + String(LCD_I2C_ADDR, HEX));
  } else {
    isLcdAvailable = false;
    Serial.println("[LCD] LCD I2C tidak terpasang (Pengecekan Serial Aktif).");
  }
}

void lcdShowStandby() {
  if (!isLcdAvailable) return;
  lcd.clear();
  lcd.setCursor(0, 0);
  lcd.print("AquaSentry Standby");
  lcd.setCursor(0, 1);
  lcd.print("Tekan Tombol D32");
}

void lcdShowMeasuring(int currentSample, int totalSamples) {
  if (!isLcdAvailable) return;
  lcd.setCursor(0, 0);
  lcd.print("Mengukur Sensor ");
  lcd.setCursor(0, 1);
  int progressPercent = (currentSample * 100) / totalSamples;
  char buf[17];
  snprintf(buf, sizeof(buf), "Sampling: %3d%%", progressPercent);
  lcd.print(buf);
}

void lcdShowResult(const String &categoryLocal, float tds, float turb) {
  if (!isLcdAvailable) return;
  lcd.clear();
  lcd.setCursor(0, 0);
  char line1[17];
  snprintf(line1, sizeof(line1), "T:%3.0fppm N:%3.0f", tds, turb);
  lcd.print(line1);

  lcd.setCursor(0, 1);
  lcd.print("Kat: " + categoryLocal);
}

// =============================================================================
// KONTROL INDIKATOR LED FISIK
// =============================================================================
void clearAllLeds() {
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, LOW);
}

void setLedsByVerdict(int classIdx) {
  clearAllLeds();
  if (classIdx == 0) {
    digitalWrite(PIN_LED_GREEN, HIGH);  // Aman (Low)
  } else if (classIdx == 1) {
    digitalWrite(PIN_LED_YELLOW, HIGH); // Medium
  } else if (classIdx == 2) {
    digitalWrite(PIN_LED_RED, HIGH);    // Berbahaya (High)
  }
}

// =============================================================================
// MQTT CALLBACK (KONTROL JARAK JAUH / CLOUD TRIGGER)
// =============================================================================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  Serial.print("\n[MQTT RECV] Perintah diterima: "); Serial.println(message);

  if (message == "START_TEST" || message == "TRIGGER") {
    if (currentState == STATE_STANDBY) {
      pendingTriggerTest = true;
    }
  } else if (message == "OPEN_PORTAL") {
    startCaptivePortal();
  }
}

void ensureMqttConnected() {
  if (isApModeActive || WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  Serial.print("[MQTT] Menghubungkan ke Broker HiveMQ Cloud... ");
  String clientId = savedDeviceId + "-" + String(random(1000, 9999));
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println("TERHUBUNG!");

    // Subscribe ke topic global & topic spesifik alat
    mqttClient.subscribe(MQTT_TOPIC_COMMAND);
    String devCmdTopic = String("aquasentry/") + savedDeviceId + "/command";
    mqttClient.subscribe(devCmdTopic.c_str());

    publishStatusMqtt("online");
  } else {
    Serial.print("Gagal, rc="); Serial.println(mqttClient.state());
  }
}

void publishStatusMqtt(String statusVal) {
  if (!mqttClient.connected()) return;

  String payload = "{";
  payload += "\"device\":\"" + savedDeviceId + "\",";
  payload += "\"device_id\":\"" + savedDeviceId + "\",";
  payload += "\"experiment_id\":\"" + String(EXPERIMENT_ID) + "\",";
  payload += "\"status\":\"" + statusVal + "\",";
  payload += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  payload += "\"rssi\":" + String(WiFi.RSSI());
  payload += "}";

  mqttClient.publish(MQTT_TOPIC_STATUS, payload.c_str());
}

// =============================================================================
// TRANSMISI HASIL PENGUKURAN KE WEBSITE (TEPAT 1 KALI PER SIKLUS UJI)
// =============================================================================
void transmitResultToWebsite() {
  if (hasSentResultForCycle) return;

  String timestampStr = String(millis() / 1000) + "s-uptime";
  String testId = "TEST-" + savedDeviceId + "-" + String(millis());

  // Konstruksi Payload JSON Kompatibel Penuh dengan Website AquaSentry
  String payload = "{";
  payload += "\"device\":\"" + savedDeviceId + "\",";
  payload += "\"device_id\":\"" + savedDeviceId + "\",";
  payload += "\"experiment_id\":\"" + String(EXPERIMENT_ID) + "\",";
  payload += "\"test_id\":\"" + testId + "\",";
  payload += "\"timestamp_esp\":\"" + timestampStr + "\",";
  payload += "\"final_verdict\":\"" + lastVerdictWebsite + "\","; // "Low", "Medium", "High"
  payload += "\"local_category\":\"" + lastVerdictLocal + "\",";   // "Aman", "Medium", "Berbahaya"
  payload += "\"avg_tds\":" + String(lastAvgTds, 1) + ",";
  payload += "\"avg_turbidity\":" + String(lastAvgTurb, 1) + ",";
  payload += "\"preset\":\"HARDWARE\",";
  payload += "\"vote_low\":" + String(lastVerdictWebsite == "Low" ? 1 : 0) + ",";
  payload += "\"vote_medium\":" + String(lastVerdictWebsite == "Medium" ? 1 : 0) + ",";
  payload += "\"vote_high\":" + String(lastVerdictWebsite == "High" ? 1 : 0);
  payload += "}";

  // 1. Publikasi ke Topik Umum Website
  if (mqttClient.connected()) {
    mqttClient.publish(MQTT_TOPIC_RESULT, payload.c_str());
    String devTopic = String("aquasentry/") + savedDeviceId + "/result";
    mqttClient.publish(devTopic.c_str(), payload.c_str());
    Serial.println("\n[CLOUD MQTT] Hasil resmi pengujian berhasil dikirim ke Website!");
  } else {
    Serial.println("\n[CLOUD MQTT] Peringatan: MQTT tidak terhubung saat transmisi hasil.");
  }

  // 2. Kirim juga ke TCP Lokal jika Laptop terhubung
  if (tcpClient && tcpClient.connected()) {
    tcpClient.println(payload);
    Serial.println("[TCP LOCAL] Hasil resmi dikirim ke koneksi TCP lokal.");
  }

  hasSentResultForCycle = true;
}

// =============================================================================
// SIKLUS PENGUKURAN SENSOR & INFERENSI EDGE AI
// =============================================================================
void startMeasurementCycle() {
  Serial.println("\n=================================================================");
  Serial.println(" [TRIGGER] MEMULAI SIKLUS PENGUKURAN SENSOR (BUTTON-TRIGGERED)");
  Serial.print(" >>> ID Perangkat   : "); Serial.println(savedDeviceId);
  Serial.print(" >>> ID Percobaan   : "); Serial.println(EXPERIMENT_ID);
  Serial.println("=================================================================");

  clearAllLeds();
  currentState = STATE_MEASURING;
  sampleIndex = 0;
  hasSentResultForCycle = false;
  lastSampleTime = millis();
  lastBlinkTime = millis();

  lcdShowMeasuring(0, WINDOW_SIZE);
  publishStatusMqtt("measuring");
}

void processSamplingCycle(unsigned long currentMillis) {
  if (currentMillis - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = currentMillis;

    // 1. Akuisisi & Kalibrasi TDS Terpadu
    float rawTdsAdc = SensorCalibration::readFilteredAdc(PIN_TDS, 10);
    float tdsPpm = SensorCalibration::calculateTdsPpm(rawTdsAdc, DEFAULT_TEMPERATURE_C);

    // 2. Akuisisi & Kalibrasi Turbiditas Terpadu
    float rawTurbAdc = SensorCalibration::readFilteredAdc(PIN_TURBIDITY, 10);
    float turbNtu = SensorCalibration::calculateTurbidityNtu(rawTurbAdc, tdsPpm);

    // Simpan ke buffer windowing
    tdsWindowBuffer[sampleIndex] = tdsPpm;
    turbWindowBuffer[sampleIndex] = turbNtu;
    sampleIndex++;

    lcdShowMeasuring(sampleIndex, WINDOW_SIZE);

    Serial.print(" Sampel ["); Serial.print(sampleIndex); Serial.print("/"); Serial.print(WINDOW_SIZE);
    Serial.print("] -> TDS: "); Serial.print(tdsPpm, 1);
    Serial.print(" PPM | Turb: "); Serial.print(turbNtu, 1); Serial.println(" NTU");

    // Jika 50 sampel telah terkumpul lengkap (5.0 detik)
    if (sampleIndex >= WINDOW_SIZE) {
      executeEdgeAiInference();
    }
  }
}

void executeEdgeAiInference() {
  Serial.println("\n-----------------------------------------------------------------");
  Serial.println(" [EDGE AI] MENJALANKAN EKSTRAKSI 8 FITUR & INFERENSI RANDOM FOREST...");

  // 1. Ekstraksi 8 Fitur Statistik Persis Sesuai Preprocessing Model Training
  float tdsMean = 0, tdsMin = 99999, tdsMax = -99999;
  float turbMean = 0, turbMin = 99999, turbMax = -99999;

  for (int i = 0; i < WINDOW_SIZE; i++) {
    tdsMean += tdsWindowBuffer[i];
    if (tdsWindowBuffer[i] < tdsMin) tdsMin = tdsWindowBuffer[i];
    if (tdsWindowBuffer[i] > tdsMax) tdsMax = tdsWindowBuffer[i];

    turbMean += turbWindowBuffer[i];
    if (turbWindowBuffer[i] < turbMin) turbMin = turbWindowBuffer[i];
    if (turbWindowBuffer[i] > turbMax) turbMax = turbWindowBuffer[i];
  }
  tdsMean /= (float)WINDOW_SIZE;
  turbMean /= (float)WINDOW_SIZE;

  float tdsVar = 0, turbVar = 0;
  for (int i = 0; i < WINDOW_SIZE; i++) {
    tdsVar += (tdsWindowBuffer[i] - tdsMean) * (tdsWindowBuffer[i] - tdsMean);
    turbVar += (turbWindowBuffer[i] - turbMean) * (turbWindowBuffer[i] - turbMean);
  }
  float tdsStd = sqrt(tdsVar / (float)WINDOW_SIZE);
  float turbStd = sqrt(turbVar / (float)WINDOW_SIZE);

  float features[8] = {
    tdsMean, tdsStd, tdsMin, tdsMax,
    turbMean, turbStd, turbMin, turbMax
  };

  // 2. Inferensi Machine Learning Lokal (100% Offline di ESP32)
  int classResult = EdgeWaterClassifier::predict(features);
  lastVerdictWebsite = EdgeWaterClassifier::predictLabel(features);         // "Low", "Medium", "High"
  lastVerdictLocal = EdgeWaterClassifier::predictLocalCategory(features);   // "Aman", "Medium", "Berbahaya"
  lastAvgTds = tdsMean;
  lastAvgTurb = turbMean;

  Serial.println(" >>> HASIL INFERENSI EDGE AI:");
  Serial.print("     Kategori Lokal (LCD) : [ "); Serial.print(lastVerdictLocal); Serial.println(" ]");
  Serial.print("     Verdict Website      : [ "); Serial.print(lastVerdictWebsite); Serial.println(" ]");
  Serial.print("     Rata-Rata TDS (ppm)  : "); Serial.println(lastAvgTds, 1);
  Serial.print("     Rata-Rata Turb (NTU) : "); Serial.println(lastAvgTurb, 1);
  Serial.println("-----------------------------------------------------------------");

  // 3. Tampilkan Hasil pada LCD & Indikator LED Fisik
  setLedsByVerdict(classResult);
  digitalWrite(PIN_LED_STATUS, HIGH); // Status kembali solid ON
  lcdShowResult(lastVerdictLocal, lastAvgTds, lastAvgTurb);

  // 4. Kirim Hasil Tepat Satu Kali ke Website
  transmitResultToWebsite();

  // 5. Berpindah ke Mode Menampilkan Hasil Sebelum Kembali ke Standby
  currentState = STATE_RESULT_DISPLAY;
  stateTimerEnd = millis() + RESULT_DISPLAY_MS;
}

// =============================================================================
// DETEKSI TOMBOL FISIK DEBOUNCED (MOMENTARY TRIGGER)
// =============================================================================
void checkPhysicalButton(unsigned long currentMillis) {
  int reading = digitalRead(PIN_BUTTON);

  if (reading != lastButtonPhysicalState) {
    if (currentMillis - lastDebounceTime > DEBOUNCE_DELAY_MS) {
      lastDebounceTime = currentMillis;
      lastButtonPhysicalState = reading;

      // Pemicu saat tombol ditekan (transisi ke LOW karena INPUT_PULLUP)
      if (reading == LOW) {
        Serial.println("\n[TOMBOL] Penekanan tombol fisik terdeteksi (GPIO 32)!");
        if (currentState == STATE_STANDBY) {
          startMeasurementCycle();
        } else if (currentState == STATE_MEASURING) {
          // Pembatalan pengujian jika tombol ditekan kembali saat mengukur
          Serial.println("[TOMBOL] Pengukuran dibatalkan oleh pengguna.");
          clearAllLeds();
          currentState = STATE_STANDBY;
          lcdShowStandby();
          publishStatusMqtt("cancelled");
        }
      }
    }
  }
}

// =============================================================================
// CAPTIVE PORTAL HANDLERS
// =============================================================================
void handlePortalRoot() {
  webServer.send(200, "text/html", generatePortalRootHtml(savedSsid, savedDeviceId));
}

void handlePortalSave() {
  String reqSsid = webServer.arg("ssid");
  reqSsid.trim();
  String reqPass = webServer.arg("password");
  reqPass.trim();
  String reqDeviceId = webServer.arg("device_id");
  reqDeviceId.trim();

  if (reqSsid == "") {
    webServer.send(200, "text/html", "<h3>Nama Wi-Fi tidak boleh kosong! <a href='/'>Kembali</a></h3>");
    return;
  }

  if (reqDeviceId.length() > 0) {
    savedDeviceId = reqDeviceId;
  }

  Serial.println("\n[SETUP WEB] Menyimpan konfigurasi baru:");
  Serial.print("  Device ID : "); Serial.println(savedDeviceId);
  Serial.print("  SSID      : "); Serial.println(reqSsid);

  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(reqSsid.c_str(), reqPass.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    savedSsid = reqSsid;
    savedPassword = reqPass;

    preferences.begin("aquasentry", false);
    preferences.putString("ssid", savedSsid);
    preferences.putString("pass", savedPassword);
    preferences.putString("device_id", savedDeviceId);
    preferences.end();

    server.begin();
    isApModeActive = false;

    webServer.send(200, "text/html", generateSuccessHtml(savedSsid, WiFi.localIP().toString(), savedDeviceId));
    delay(3000);
    WiFi.mode(WIFI_STA);
  } else {
    webServer.send(200, "text/html", generateFailHtml(reqSsid));
  }
}

void handleCaptiveRedirect() {
  webServer.sendHeader("Location", String("http://192.168.4.1/"), true);
  webServer.send(302, "text/plain", "");
}

void startCaptivePortal() {
  isApModeActive = true;
  Serial.println("\n[HOTSPOT] Memulai Access Point Captive Portal...");
  WiFi.mode(WIFI_AP);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  WiFi.softAP(AP_SSID, AP_PASSWORD);

  dnsServer.start(DNS_PORT, "*", apIP);
  webServer.on("/", handlePortalRoot);
  webServer.on("/save", HTTP_POST, handlePortalSave);
  webServer.on("/generate_204", handlePortalRoot);
  webServer.on("/gen_204", handlePortalRoot);
  webServer.on("/hotspot-detect.html", handlePortalRoot);
  webServer.on("/ncsi.txt", handlePortalRoot);
  webServer.onNotFound(handleCaptiveRedirect);
  webServer.begin();

  if (isLcdAvailable) {
    lcd.clear();
    lcd.setCursor(0, 0);
    lcd.print("Setup Wi-Fi AP:");
    lcd.setCursor(0, 1);
    lcd.print("192.168.4.1");
  }
}

void connectToSavedWifi() {
  preferences.begin("aquasentry", true);
  savedSsid = preferences.getString("ssid", "");
  savedPassword = preferences.getString("pass", "");
  preferences.end();

  if (savedSsid == "") {
    startCaptivePortal();
    return;
  }

  Serial.println("\n[Wi-Fi] Menghubungkan ke router: " + savedSsid);
  WiFi.mode(WIFI_STA);
  WiFi.begin(savedSsid.c_str(), savedPassword.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[Wi-Fi] Terhubung! IP: " + WiFi.localIP().toString());
    server.begin();
    isApModeActive = false;
  } else {
    Serial.println("\n[Wi-Fi] Gagal terhubung ke router. Mengaktifkan Access Point...");
    startCaptivePortal();
  }
}

// =============================================================================
// SETUP UTAMA ESP32
// =============================================================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Proteksi brown-out
  Serial.begin(115200);
  delay(500);

  Serial.println("\n=================================================================");
  Serial.println("  AQUASENTRY PERCOBAAN 3: FULL EDGE AI & BUTTON MEASUREMENT");
  Serial.println("=================================================================");

  // Inisialisasi NVS & ID Perangkat Persisten
  preferences.begin("aquasentry", false);
  String defaultId = generateHardwareId();
  savedDeviceId = preferences.getString("device_id", defaultId);
  if (savedDeviceId.length() == 0) {
    savedDeviceId = defaultId;
    preferences.putString("device_id", savedDeviceId);
  }
  preferences.end();

  Serial.print(" >>> Unique Device ID : "); Serial.println(savedDeviceId);
  Serial.print(" >>> Experiment ID    : "); Serial.println(EXPERIMENT_ID);
  Serial.println("=================================================================");

  // Inisialisasi Pinout
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  clearAllLeds();
  digitalWrite(PIN_LED_STATUS, HIGH); // Standby solid ON

  // Inisialisasi LCD
  initLcdDisplay();
  delay(1000);
  lcdShowStandby();

  // Setup Klien TLS MQTT HiveMQ Cloud
  tlsClient.setInsecure();
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(1024);

  // Sambungkan ke Wi-Fi
  connectToSavedWifi();
}

// =============================================================================
// LOOP UTAMA ESP32
// =============================================================================
void loop() {
  unsigned long currentMillis = millis();

  // 1. Eksekusi Pemicu Pengujian Tertunda (dari Cloud atau Tombol)
  if (pendingTriggerTest) {
    pendingTriggerTest = false;
    startMeasurementCycle();
  }

  // 2. Layanan Captive Portal jika Mode AP Aktif
  if (isApModeActive) {
    dnsServer.processNextRequest();
    webServer.handleClient();
  }

  // 3. Layanan MQTT HiveMQ Cloud (Tetap terhubung dalam mode Standby)
  if (!isApModeActive && WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      ensureMqttConnected();
    } else {
      mqttClient.loop();
    }
  }

  // 4. Layanan TCP Socket Lokal
  if (!tcpClient || !tcpClient.connected()) {
    WiFiClient newClient = server.available();
    if (newClient) {
      tcpClient = newClient;
      Serial.println("[TCP] Client lokal terhubung via port 8080.");
    }
  }

  // 5. Cek Tombol Fisik (GPIO 32)
  checkPhysicalButton(currentMillis);

  // 6. State Machine Pengukuran
  switch (currentState) {
    case STATE_STANDBY:
      // Status diam: LED status menyala solid, tidak ada transmisi data periodik
      digitalWrite(PIN_LED_STATUS, HIGH);
      break;

    case STATE_MEASURING:
      // Kedip cepat LED status (D33) sebagai indikator proses aktif
      if (currentMillis - lastBlinkTime >= BLINK_INTERVAL_MS) {
        lastBlinkTime = currentMillis;
        statusLedBlinkState = !statusLedBlinkState;
        digitalWrite(PIN_LED_STATUS, statusLedBlinkState ? HIGH : LOW);
      }
      processSamplingCycle(currentMillis);
      break;

    case STATE_RESULT_DISPLAY:
      // Menampilkan hasil pada LCD & LED selama durasi RESULT_DISPLAY_MS (8 detik)
      if (currentMillis >= stateTimerEnd) {
        clearAllLeds();
        currentState = STATE_STANDBY;
        lcdShowStandby();
        Serial.println("[STANDBY] Kembali ke mode standby. Menunggu penekanan tombol berikutnya...");
      }
      break;
  }

  delay(2);
}
