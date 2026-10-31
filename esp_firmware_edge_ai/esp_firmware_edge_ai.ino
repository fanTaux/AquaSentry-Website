#include <Arduino.h>

/*
  =============================================================================
  ESP32 FULL EDGE AI WATER CLASSIFIER (MODULAR CLEAN ARCHITECTURE)
  =============================================================================
  Modul Terpisah:
  1. config.h       : Konfigurasi Pinout PCB, konstanta ADC, timing pengujian
  2. portal_html.h  : Template antarmuka web modern Captive Portal Wi-Fi
  3. rf_model.h     : Model Random Forest Edge AI (5-Second Window)
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

// Flag aman pemicu pengujian dari background MQTT/TCP tanpa tabrakan callback
volatile bool pendingStartTest  = false;
volatile bool pendingCancelTest = false;

#include "config.h"      // Pinout, Hardware Parameters, & HiveMQ Cloud MQTT Config
#include "portal_html.h" // UI Captive Portal Modern
#include "rf_model.h"    // Embedded Edge AI Model

// =============================================================================
// GLOBAL OBJECTS & STATE
// =============================================================================
IPAddress apIP(192, 168, 4, 1);
DNSServer dnsServer;
WebServer webServer(80);
WiFiServer server(SERVER_PORT);
WiFiClient client;
Preferences preferences;

// Klien MQTT TLS HiveMQ Cloud
WiFiClientSecure tlsClient;
PubSubClient mqttClient(tlsClient);

bool isApModeActive           = false;
String savedSsid              = "";
String savedPassword          = "";

// Variabel Simulasi Data Sensor
bool overrideSensorActive     = true;   // Default aktif agar AI langsung jalan tanpa sensor fisik rusak
float simTdsPpm          = 85.0f;  // Nilai dasar TDS
float simTurbNtu         = 15.0f;  // Nilai dasar Turbidity
String currentPresetName      = "LOW";  // Preset aktif

// Buffer Jendela 5 Detik & Variabel Edge AI
float tdsBuffer[WINDOW_SIZE];
float turbBuffer[WINDOW_SIZE];
int bufferIndex               = 0;
int bufferCount               = 0;
String currentAiPrediction    = "Standby";

// Pengaturan Durasi Pengujian (30 Detik)
bool isTesting                = false;
unsigned long testStartTime   = 0;
unsigned long lastStatusBlink = 0;
bool statusLedState           = HIGH;

// Voting Keputusan 5-Detikan
int voteCountLow              = 0;
int voteCountMed              = 0;
int voteCountHigh             = 0;
int totalDecisions            = 0;

// Akumulator Rata-Rata Sensor untuk Hasil Akhir
double sumTdsTotal            = 0.0;
double sumTurbTotal           = 0.0;
unsigned long totalSamplesCollected = 0;

// Sampling Sensor
unsigned long lastSampleTime     = 0;
unsigned long sampleId           = 0;
float defaultTemperature         = 25.0f;
int buttonIdleState              = HIGH;
unsigned long buttonArmTime      = 0; // Waktu proteksi startup tombol
unsigned long resultLedTurnOffTime = 0; // Timer 10 detik mati otomatis LED hasil

// =============================================================================
// FORWARD DECLARATIONS (PROTOTIPE FUNGSI)
// =============================================================================
void startTestingSession(unsigned long currentMillis);
void cancelTestingSession();
void finishTestingSession();
void handleTcpCommunication();
void startCaptivePortal();
void mqttCallback(char* topic, byte* payload, unsigned int length);

// =============================================================================
// KENDALI LED HASIL KLASIFIKASI
// =============================================================================
void setClassificationLeds(String label) {
  if (label == "Low") {
    digitalWrite(PIN_LED_GREEN, HIGH);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);
  } else if (label == "Medium") {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, HIGH);
    digitalWrite(PIN_LED_RED, LOW);
  } else if (label == "High") {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, HIGH);
  } else {
    digitalWrite(PIN_LED_GREEN, LOW);
    digitalWrite(PIN_LED_YELLOW, LOW);
    digitalWrite(PIN_LED_RED, LOW);
  }
}

// =============================================================================
// DETEKSI PUSH BUTTON (UNIVERSAL: MOMENTARY & SAKLAR LATCHING / SELF-LOCK)
// =============================================================================
bool checkButtonPressed() {
  static int lastPhysicalReading = -1;
  static int stableReading = -1;
  static unsigned long lastDebounceMs = 0;

  // 1. Kunci pengaman startup: abaikan pembacaan selama 1.5 detik setelah boot
  if (millis() < buttonArmTime) {
    stableReading = digitalRead(PIN_BUTTON);
    lastPhysicalReading = stableReading;
    return false;
  }

  // 2. Baca nilai fisik pin tombol saat ini
  int currentReading = digitalRead(PIN_BUTTON);

  // Jika terdeteksi perubahan logika pin (bouncing)
  if (currentReading != lastPhysicalReading) {
    lastDebounceMs = millis();
    lastPhysicalReading = currentReading;
  }

  // Filter Debounce Stabil 50 ms
  if ((millis() - lastDebounceMs) >= 50) {
    if (currentReading != stableReading) {
      stableReading = currentReading;

      // HANYA PICU SAAT TOMBOL DITEKAN (Active LOW untuk INPUT_PULLUP):
      // Menghindari pembatalan instan saat jari dilepas dari tombol!
      if (stableReading == LOW) {
        Serial.println("[BUTTON EVENT] Push button D32 ditekan (Active LOW)!");
        return true;
      }
    }
  }

  return false;
}

// =============================================================================
// HANDLERS CAPTIVE PORTAL WEB SERVER
// =============================================================================
void handlePortalRoot() {
  webServer.send(200, "text/html", generatePortalRootHtml(savedSsid));
}

void handlePortalSave() {
  String reqSsid = webServer.arg("ssid");
  reqSsid.trim();
  String reqPass = webServer.arg("password");
  reqPass.trim();

  if (reqSsid == "") {
    webServer.send(200, "text/html", "<h3>Nama Wi-Fi tidak boleh kosong! <a href='/'>Kembali</a></h3>");
    return;
  }

  Serial.println("\n[SETUP WEB] Menerima konfigurasi Wi-Fi baru dari HP:");
  Serial.print("  SSID     : "); Serial.println(reqSsid);
  Serial.print("  Password : "); Serial.println(reqPass.length() > 0 ? "********" : "(Tanpa Password)");

  // Uji koneksi tanpa mematikan browser HP (Dual AP+STA)
  WiFi.mode(WIFI_AP_STA);
  WiFi.begin(reqSsid.c_str(), reqPass.c_str());

  Serial.print("[SETUP WEB] Menguji koneksi ke router");
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 25) { // 12.5 detik
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    savedSsid = reqSsid;
    savedPassword = reqPass;

    preferences.begin("wifi_cfg", false);
    preferences.putString("ssid", savedSsid);
    preferences.putString("pass", savedPassword);
    preferences.end();

    server.begin();
    isApModeActive = false;

    webServer.send(200, "text/html", generateSuccessHtml(savedSsid, WiFi.localIP().toString()));

    Serial.println("\n========================================================");
    Serial.println(" [OK] SUKSES TERSAMBUNG KE WI-FI BARU!");
    Serial.print(" >>> ALAMAT IP ESP32 : "); Serial.println(WiFi.localIP());
    Serial.println(" >>> PORT TCP        : 8080");
    Serial.println("========================================================\n");

    delay(3000);
    WiFi.mode(WIFI_STA);
  } else {
    webServer.send(200, "text/html", generateFailHtml(reqSsid));
    Serial.println("\n[!] Gagal menghubungkan ke Wi-Fi baru. Hotspot AP tetap aktif.");
  }
}

void handleCaptiveRedirect() {
  webServer.sendHeader("Location", String("http://192.168.4.1/"), true);
  webServer.send(302, "text/plain", "");
}

void startCaptivePortal() {
  isApModeActive = true;
  Serial.println("\n========================================================");
  Serial.println(" [!] MEMULAI CAPTIVE PORTAL SETUP (ACCESS POINT)");
  Serial.print(" >>> NAMA WI-FI (SSID) : "); Serial.println(AP_SSID);
  Serial.print(" >>> PASSWORD          : "); Serial.println(AP_PASSWORD);
  Serial.print(" >>> IP PORTAL SETUP   : "); Serial.println(apIP);
  Serial.println(" Sambungkan HP ke Wi-Fi tersebut untuk setup Wi-Fi baru!");
  Serial.println("========================================================\n");

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
}

// =============================================================================
// INFERENSI EDGE AI (SETIAP 5 DETIK / 50 SAMPEL)
// =============================================================================
void updateEdgeAiWindow(float tds, float turb, unsigned long currentTestElapsed) {
  tdsBuffer[bufferIndex] = tds;
  turbBuffer[bufferIndex] = turb;
  bufferIndex = (bufferIndex + 1) % WINDOW_SIZE;
  if (bufferCount < WINDOW_SIZE) bufferCount++;

  if (bufferCount == WINDOW_SIZE && (bufferIndex % WINDOW_SIZE == 0)) {
    float tdsMean = 0, tdsMin = 99999, tdsMax = -99999;
    float turbMean = 0, turbMin = 99999, turbMax = -99999;

    for (int i = 0; i < WINDOW_SIZE; i++) {
      tdsMean += tdsBuffer[i];
      if (tdsBuffer[i] < tdsMin) tdsMin = tdsBuffer[i];
      if (tdsBuffer[i] > tdsMax) tdsMax = tdsBuffer[i];

      turbMean += turbBuffer[i];
      if (turbBuffer[i] < turbMin) turbMin = turbBuffer[i];
      if (turbBuffer[i] > turbMax) turbMax = turbBuffer[i];
    }
    tdsMean /= WINDOW_SIZE;
    turbMean /= WINDOW_SIZE;

    float tdsVar = 0, turbVar = 0;
    for (int i = 0; i < WINDOW_SIZE; i++) {
      tdsVar += (tdsBuffer[i] - tdsMean) * (tdsBuffer[i] - tdsMean);
      turbVar += (turbBuffer[i] - turbMean) * (turbBuffer[i] - turbMean);
    }
    float tdsStd = sqrt(tdsVar / WINDOW_SIZE);
    float turbStd = sqrt(turbVar / WINDOW_SIZE);

    float features[8] = {
      tdsMean, tdsStd, tdsMin, tdsMax,
      turbMean, turbStd, turbMin, turbMax
    };

    currentAiPrediction = EdgeWaterClassifier::predictLabel(features);
    totalDecisions++;

    if (currentAiPrediction == "Low") voteCountLow++;
    else if (currentAiPrediction == "Medium") voteCountMed++;
    else if (currentAiPrediction == "High") voteCountHigh++;

    setClassificationLeds(currentAiPrediction);

    int elapsedSec = currentTestElapsed / 1000;
    int remainingSec = (int)((TEST_DURATION_MS - currentTestElapsed + 999) / 1000);
    if (remainingSec < 0) remainingSec = 0;

    Serial.println("\n-----------------------------------------------------------------");
    Serial.print(" [AI 5s] Waktu: "); Serial.print(elapsedSec);
    Serial.print("s / 30s (Sisa: "); Serial.print(remainingSec); Serial.println("s)");
    Serial.print(" => KELAS TERDETEKSI: "); Serial.println(currentAiPrediction);
    Serial.print("    TDS  : Mean="); Serial.print(tdsMean, 1);
    Serial.print(" | Min="); Serial.print(tdsMin, 1);
    Serial.print(" | Max="); Serial.print(tdsMax, 1);
    Serial.print(" | Std="); Serial.println(tdsStd, 1);
    Serial.print("    TURB : Mean="); Serial.print(turbMean, 1);
    Serial.print(" | Min="); Serial.print(turbMin, 1);
    Serial.print(" | Max="); Serial.print(turbMax, 1);
    Serial.print(" | Std="); Serial.println(turbStd, 1);
    Serial.println("-----------------------------------------------------------------");
  }
}

// =============================================================================
// MODUL PROTOKOL KOMUNIKASI TCP & LIVE VIEWER LAPTOP
// =============================================================================
void handleTcpCommunication() {
  if (server.hasClient()) {
    if (!client || !client.connected()) {
      client = server.available();
      Serial.println("\n[TCP] Client laptop (live_viewer.py) terhubung!");
    }
  }

  if (client && client.connected() && client.available()) {
    String cmd = client.readStringUntil('\n');
    cmd.trim();

    if (cmd == "SET_PRESET:LOW") {
      overrideSensorActive = true;
      simTdsPpm = 85.0f;
      simTurbNtu = 15.0f;
      currentPresetName = "LOW";
      Serial.println("\n[PRESET DIUBAH] -> LOW (TDS ~85 PPM, Turb ~15 NTU)");
    } 
    else if (cmd == "SET_PRESET:MEDIUM") {
      overrideSensorActive = true;
      simTdsPpm = 245.0f;
      simTurbNtu = 215.0f;
      currentPresetName = "MEDIUM";
      Serial.println("\n[PRESET DIUBAH] -> MEDIUM (TDS ~245 PPM, Turb ~215 NTU)");
    } 
    else if (cmd == "SET_PRESET:HIGH") {
      overrideSensorActive = true;
      simTdsPpm = 480.0f;
      simTurbNtu = 450.0f;
      currentPresetName = "HIGH";
      Serial.println("\n[PRESET DIUBAH] -> HIGH (TDS ~480 PPM, Turb ~450 NTU)");
    }
    else if (cmd.startsWith("SET_CUSTOM:")) {
      int commaIdx = cmd.indexOf(',');
      if (commaIdx > 11) {
        float cTds = cmd.substring(11, commaIdx).toFloat();
        float cTurb = cmd.substring(commaIdx + 1).toFloat();
        overrideSensorActive = true;
        simTdsPpm = cTds;
        simTurbNtu = cTurb;
        currentPresetName = "CUSTOM";
        Serial.print("\n[CUSTOM DIUBAH] -> TDS: "); Serial.print(simTdsPpm, 1);
        Serial.print(" | Turb: "); Serial.println(simTurbNtu, 1);
      }
    }
    else if (cmd == "OPEN_PORTAL") {
      startCaptivePortal();
    }
    else if (cmd == "START_TEST") {
      pendingStartTest = true;
    }
    else if (cmd == "CANCEL_TEST") {
      pendingCancelTest = true;
    }
    else if (cmd == "RESET_SENSOR") {
      overrideSensorActive = false;
      currentPresetName = "HARDWARE";
      Serial.println("\n[SENSOR ASLI] Kembali ke pembacaan pin fisik.");
    }
  }
}

// =============================================================================
// MODUL MQTT HIVEMQ CLOUD (TLS PORT 8883)
// =============================================================================
void mqttCallback(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  Serial.print("\n[MQTT INCOMING] Topik: ");
  Serial.print(topic);
  Serial.print(" | Pesan: ");
  Serial.println(message);

  if (message == "SET_PRESET:LOW") {
    overrideSensorActive = true;
    simTdsPpm = 85.0f;
    simTurbNtu = 15.0f;
    currentPresetName = "LOW";
    Serial.println("[MQTT] Preset diubah ke LOW");
  } 
  else if (message == "SET_PRESET:MEDIUM") {
    overrideSensorActive = true;
    simTdsPpm = 245.0f;
    simTurbNtu = 215.0f;
    currentPresetName = "MEDIUM";
    Serial.println("[MQTT] Preset diubah ke MEDIUM");
  } 
  else if (message == "SET_PRESET:HIGH") {
    overrideSensorActive = true;
    simTdsPpm = 480.0f;
    simTurbNtu = 450.0f;
    currentPresetName = "HIGH";
    Serial.println("[MQTT] Preset diubah ke HIGH");
  } 
  else if (message == "RESET_SENSOR") {
    overrideSensorActive = false;
    currentPresetName = "HARDWARE";
    Serial.println("[MQTT] Beralih ke sensor fisik.");
    if (!isApModeActive && mqttClient.connected()) {
      mqttClient.publish(MQTT_TOPIC_STATUS, "{\"device\":\"ESP32_AquaSentry\",\"status\":\"preset_changed\",\"preset\":\"HARDWARE\"}");
    }
  }
  else if (message.startsWith("SET_CUSTOM:")) {
    int commaIdx = message.indexOf(',');
    if (commaIdx > 11) {
      float cTds = message.substring(11, commaIdx).toFloat();
      float cTurb = message.substring(commaIdx + 1).toFloat();
      overrideSensorActive = true;
      simTdsPpm = cTds;
      simTurbNtu = cTurb;
      currentPresetName = "CUSTOM";
      Serial.println("[MQTT] Preset diubah ke CUSTOM");
    }
  }
  else if (message == "OPEN_PORTAL") {
    startCaptivePortal();
  }
  else if (message.startsWith("SET_WIFI:")) {
    int commaIdx = message.indexOf(',');
    if (commaIdx > 9) {
      String newSsid = message.substring(9, commaIdx);
      String newPass = message.substring(commaIdx + 1);
      newSsid.trim();
      newPass.trim();
      preferences.begin("wifi_cfg", false);
      preferences.putString("ssid", newSsid);
      preferences.putString("pass", newPass);
      preferences.end();
      Serial.println("[WIFI] Menerima Wi-Fi baru dari Web: " + newSsid + ". Merestart...");
      delay(500);
      ESP.restart();
    }
  }
  else if (message == "START_TEST") {
    pendingStartTest = true;
  } 
  else if (message == "CANCEL_TEST") {
    pendingCancelTest = true;
  }
}

void maintainMqtt() {
  if (isApModeActive) return;

  if (WiFi.status() != WL_CONNECTED) {
    static unsigned long lastWifiReconnect = 0;
    if (millis() - lastWifiReconnect > 5000) {
      lastWifiReconnect = millis();
      Serial.println("[WIFI] Terputus, mencoba reconnect Wi-Fi...");
      WiFi.reconnect();
    }
    return;
  }

  static unsigned long lastMqttAttempt = 0;
  if (!mqttClient.connected()) {
    unsigned long now = millis();
    if (lastMqttAttempt == 0 || (now - lastMqttAttempt > 4000)) { // Coba konek tiap 4 detik
      lastMqttAttempt = now;
      String clientId = "ESP32_AquaSentry_" + String((uint32_t)ESP.getEfuseMac(), HEX);
      Serial.print("\n[MQTT] Menghubungkan ke HiveMQ Cloud (TLS 8883)... ");
      
      tlsClient.stop(); // Bersihkan socket lama agar handshake TLS baru selalu bersih
      tlsClient.setInsecure();
      mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
      mqttClient.setCallback(mqttCallback);
      mqttClient.setBufferSize(512);

      if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
        Serial.println("[OK] TERHUBUNG KE HIVEMQ CLOUD!");
        mqttClient.subscribe(MQTT_TOPIC_COMMAND);
        
        // Kirim pengumuman status online beserta info Wi-Fi nyata
        String onlineMsg = "{\"device\":\"ESP32_AquaSentry\",\"status\":\"online\",\"ssid\":\"" + WiFi.SSID() + "\",\"ip\":\"" + WiFi.localIP().toString() + "\",\"rssi\":" + String(WiFi.RSSI()) + "}";
        mqttClient.publish(MQTT_TOPIC_STATUS, onlineMsg.c_str());
      } else {
        Serial.print("Gagal, rc=");
        Serial.print(mqttClient.state());
        Serial.println(" (Mencoba ulang dalam 4 detik...)");
      }
    }
  } else {
    mqttClient.loop();
  }
}

// =============================================================================
// MODUL SESI PENGUJIAN 30 DETIK (START, FINISH, CANCEL)
// =============================================================================
void startTestingSession(unsigned long currentMillis) {
  isTesting = true;
  testStartTime = currentMillis;
  resultLedTurnOffTime = 0; // Reset timer padam LED hasil
  bufferIndex = 0;
  bufferCount = 0;
  voteCountLow = 0;
  voteCountMed = 0;
  voteCountHigh = 0;
  totalDecisions = 0;
  sumTdsTotal = 0.0;
  sumTurbTotal = 0.0;
  totalSamplesCollected = 0;
  currentAiPrediction = "Testing...";

  // Indikasi LED Seketika: Langsung nyalakan LED preset aktif agar fisik alat tampak langsung responsif!
  setClassificationLeds(currentPresetName);

  Serial.println("\n========================================================");
  Serial.println(" [RUN] PENGUJIAN 30 DETIK DIMULAI!");
  Serial.print(" Preset Aktif: "); Serial.println(currentPresetName);
  Serial.println(" LED Fisik Menyala & LED Status Berkedip (Proses Edge AI)...");
  Serial.println(" (Tekan tombol fisik sekali lagi jika ingin membatalkan)");
  Serial.println("========================================================");

  // Publikasi status mulai ke MQTT secara aman (1 frame ringkas)
  if (!isApModeActive && mqttClient.connected()) {
    String startJson = "{\"device\":\"ESP32_AquaSentry\",\"status\":\"testing_started\",\"preset\":\"" + currentPresetName + "\"}";
    mqttClient.publish(MQTT_TOPIC_STATUS, startJson.c_str());
  }

  if (!isApModeActive && client && client.connected()) {
    String tcpStart = "{\"is_testing\":true,\"preset\":\"" + currentPresetName + "\"}\n";
    client.print(tcpStart);
  }
}

void cancelTestingSession() {
  isTesting = false;
  testStartTime = 0;
  digitalWrite(PIN_LED_STATUS, HIGH); // LED Status kembali Solid ON
  setClassificationLeds("");          // Padamkan LED hasil seketika
  resultLedTurnOffTime = 0;
  currentAiPrediction = "Cancelled";

  Serial.println("\n========================================================");
  Serial.println(" [CANCEL] PENGUJIAN 30 DETIK DIBATALKAN!");
  Serial.println(" LED Hasil Padam & LED Status (Biru D33) Kembali Solid ON.");
  Serial.println(" Sistem kembali ke mode Standby.");
  Serial.println("========================================================\n");

  if (!isApModeActive && client && client.connected()) {
    String cancelJson = "{\"is_testing\":false,\"cancelled\":true,\"edge_ai_class\":\"Cancelled\"}\n";
    client.print(cancelJson);
  }

  // Publikasi status cancel ke MQTT
  if (!isApModeActive && mqttClient.connected()) {
    mqttClient.publish(MQTT_TOPIC_STATUS, "{\"device\":\"ESP32_AquaSentry\",\"status\":\"cancelled\"}");
  }
}

void finishTestingSession() {
  isTesting = false;
  testStartTime = 0;
  digitalWrite(PIN_LED_STATUS, HIGH); // LED Status kembali Solid ON

  String finalVerdict = "Low";
  if (voteCountHigh >= voteCountMed && voteCountHigh >= voteCountLow && voteCountHigh > 0) {
    finalVerdict = "High";
  } else if (voteCountMed >= voteCountHigh && voteCountMed >= voteCountLow && voteCountMed > 0) {
    finalVerdict = "Medium";
  } else if (voteCountLow > 0) {
    finalVerdict = "Low";
  } else {
    finalVerdict = currentAiPrediction;
  }

  float avgTds = totalSamplesCollected > 0 ? (float)(sumTdsTotal / totalSamplesCollected) : 0.0f;
  float avgTurbidity = totalSamplesCollected > 0 ? (float)(sumTurbTotal / totalSamplesCollected) : 0.0f;

  currentAiPrediction = finalVerdict;
  setClassificationLeds(finalVerdict); // Nyalakan LED hasil
  resultLedTurnOffTime = millis() + 10000; // Pasang timer: Padam otomatis setelah 10 detik!

  time_t now = time(nullptr);
  struct tm timeinfo;
  char timeStr[40] = "Baru saja";
  char testIdStr[32] = "TEST-0";

  if (now > 100000000) { // Validasi NTP telah sinkron
    localtime_r(&now, &timeinfo);
    const char* months[] = {"Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"};
    snprintf(timeStr, sizeof(timeStr), "%02d %s %04d, %02d:%02d:%02d WIB",
             timeinfo.tm_mday, months[timeinfo.tm_mon], timeinfo.tm_year + 1900,
             timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
    snprintf(testIdStr, sizeof(testIdStr), "TEST-%04d%02d%02d-%02d%02d%02d",
             timeinfo.tm_year + 1900, timeinfo.tm_mon + 1, timeinfo.tm_mday,
             timeinfo.tm_hour, timeinfo.tm_min, timeinfo.tm_sec);
  } else {
    snprintf(testIdStr, sizeof(testIdStr), "TEST-%lu", millis());
  }

  Serial.println("\n========================================================");
  Serial.println(" [OK] PENGUJIAN 30 DETIK SELESAI!");
  Serial.print(" WAKTU SELESAI UJI (ESP32)             : "); Serial.println(timeStr);
  Serial.print(" ID PENGUJIAN (TEST ID)                : "); Serial.println(testIdStr);
  Serial.print(" HASIL AKHIR KONSENSUS (MAJORITY VOTE) : ");
  Serial.println(finalVerdict);
  Serial.print(" RATA-RATA TDS (30s)                   : "); Serial.print(avgTds, 1); Serial.println(" ppm");
  Serial.print(" RATA-RATA TURBIDITAS (30s)            : "); Serial.print(avgTurbidity, 1); Serial.println(" NTU");
  Serial.print(" Rincian Voting 5-Detikan              : Low="); Serial.print(voteCountLow);
  Serial.print(" | Medium="); Serial.print(voteCountMed);
  Serial.print(" | High="); Serial.println(voteCountHigh);
  Serial.println(" [TIMER] LED hasil menyala selama 10 detik, lalu padam otomatis.");
  Serial.println(" Tekan Push Button untuk memulai pengujian baru.");
  Serial.println("========================================================\n");

  // Publikasi Hasil Akhir & Rata-Rata Sensor ke HiveMQ Cloud
  if (!isApModeActive && mqttClient.connected()) {
    String resJson = "{";
    resJson += "\"device\":\"ESP32_AquaSentry\",";
    resJson += "\"test_id\":\"" + String(testIdStr) + "\",";
    resJson += "\"timestamp_esp\":\"" + String(timeStr) + "\",";
    resJson += "\"final_verdict\":\"" + finalVerdict + "\",";
    resJson += "\"avg_tds\":" + String(avgTds, 1) + ",";
    resJson += "\"avg_turbidity\":" + String(avgTurbidity, 1) + ",";
    resJson += "\"preset\":\"" + currentPresetName + "\",";
    resJson += "\"vote_low\":" + String(voteCountLow) + ",";
    resJson += "\"vote_medium\":" + String(voteCountMed) + ",";
    resJson += "\"vote_high\":" + String(voteCountHigh) + ",";
    resJson += "\"total_samples\":" + String(totalSamplesCollected);
    resJson += "}";
    mqttClient.publish(MQTT_TOPIC_RESULT, resJson.c_str());
  }

  // Kirim juga ringkasan ke TCP socket client jika terhubung
  if (!isApModeActive && client && client.connected()) {
    String tcpRes = "{\"is_testing\":false,\"completed\":true,\"test_id\":\"" + String(testIdStr) + "\",\"timestamp_esp\":\"" + String(timeStr) + "\",\"final_verdict\":\"" + finalVerdict + "\",\"avg_tds\":" + String(avgTds, 1) + ",\"avg_turbidity\":" + String(avgTurbidity, 1) + "}\n";
    client.print(tcpRes);
  }
}

// =============================================================================
// PROSES AKUISISI SENSOR & STREAMING SAAT PENGUJIAN AKTIF
// =============================================================================
void processTestingCycle(unsigned long currentMillis) {
  if (currentMillis - lastSampleTime >= SAMPLE_INTERVAL_MS) {
    lastSampleTime = currentMillis;
    sampleId++;

    int tdsRaw = 0;
    float tdsVoltage = 0.0f;
    float tdsPpm = 0.0f;
    int turbidityRaw = 0;
    float turbidityVoltage = 0.0f;
    float turbidityNtu = 0.0f;

    if (overrideSensorActive) {
      float jitterTds = (float)random(-15, 16) / 10.0f;
      float jitterTurb = (float)random(-20, 21) / 10.0f;
      tdsPpm = max(5.0f, simTdsPpm + jitterTds);
      turbidityNtu = max(0.0f, simTurbNtu + jitterTurb);
      tdsVoltage = (tdsPpm / 500.0f) * 1.5f;
      tdsRaw = (int)(tdsVoltage * (ADC_RESOLUTION / VREF));
      turbidityVoltage = max(0.2f, 2.4f - (turbidityNtu * 1.4f / 500.0f));
      turbidityRaw = (int)(turbidityVoltage * (ADC_RESOLUTION / VREF));
    } else {
      tdsRaw = analogRead(PIN_TDS);
      tdsVoltage = tdsRaw * (VREF / ADC_RESOLUTION);
      float compCoeff = 1.0f + 0.02f * (defaultTemperature - 25.0f);
      float compVolt = tdsVoltage / compCoeff;
      tdsPpm = (133.42f * compVolt * compVolt * compVolt 
                      - 255.86f * compVolt * compVolt 
                      + 857.39f * compVolt) * 0.5f;
      if (tdsPpm < 0) tdsPpm = 0;

      turbidityRaw = analogRead(PIN_TURBIDITY);
      turbidityVoltage = turbidityRaw * (VREF / ADC_RESOLUTION);
      if (turbidityVoltage >= 2.4f) {
        turbidityNtu = 0.0f;
      } else {
        turbidityNtu = (2.4f - turbidityVoltage) * (500.0f / 1.4f);
      }
      if (turbidityNtu < 0) turbidityNtu = 0;
    }

    // Akumulasi total untuk perhitungan rata-rata akhir
    sumTdsTotal += tdsPpm;
    sumTurbTotal += turbidityNtu;
    totalSamplesCollected++;

    unsigned long elapsedTestTime = 0;
    if (testStartTime > 0 && currentMillis >= testStartTime) {
      elapsedTestTime = currentMillis - testStartTime;
    }

    updateEdgeAiWindow(tdsPpm, turbidityNtu, elapsedTestTime);

    if (testStartTime > 0 && elapsedTestTime >= TEST_DURATION_MS) {
      finishTestingSession();
    }

    // Stream JSON telemetri penuh ke laptop (live_viewer.py)
    if (!isApModeActive && client && client.connected()) {
      int elapsedSec = (int)(elapsedTestTime / 1000);
      String jsonData = "{";
      jsonData += "\"sample_id\":" + String(sampleId) + ",";
      jsonData += "\"esp_timestamp_ms\":" + String(currentMillis) + ",";
      jsonData += "\"is_testing\":" + String(isTesting ? "true" : "false") + ",";
      jsonData += "\"test_elapsed_sec\":" + String(elapsedSec) + ",";
      jsonData += "\"preset\":\"" + currentPresetName + "\",";
      jsonData += "\"tds_raw\":" + String(tdsRaw) + ",";
      jsonData += "\"tds_voltage\":" + String(tdsVoltage, 3) + ",";
      jsonData += "\"tds_ppm\":" + String(tdsPpm, 1) + ",";
      jsonData += "\"turbidity_raw\":" + String(turbidityRaw) + ",";
      jsonData += "\"turbidity_voltage\":" + String(turbidityVoltage, 3) + ",";
      jsonData += "\"turbidity_ntu\":" + String(turbidityNtu, 1) + ",";
      jsonData += "\"edge_ai_class\":\"" + currentAiPrediction + "\"";
      jsonData += "}\n";
      client.print(jsonData);
    }

    // Stream telemetri ke HiveMQ Cloud (Setiap 1 detik / 10 sampel)
    if (!isApModeActive && mqttClient.connected() && (sampleId % 10 == 0)) {
      int elapsedSec = (int)(elapsedTestTime / 1000);
      String mqttJson = "{";
      mqttJson += "\"device\":\"ESP32_AquaSentry\",";
      mqttJson += "\"sample_id\":" + String(sampleId) + ",";
      mqttJson += "\"is_testing\":true,";
      mqttJson += "\"elapsed_sec\":" + String(elapsedSec) + ",";
      mqttJson += "\"preset\":\"" + currentPresetName + "\",";
      mqttJson += "\"tds_ppm\":" + String(tdsPpm, 1) + ",";
      mqttJson += "\"turbidity_ntu\":" + String(turbidityNtu, 1) + ",";
      mqttJson += "\"ai_prediction\":\"" + currentAiPrediction + "\"";
      mqttJson += "}";
      mqttClient.publish(MQTT_TOPIC_TELEMETRY, mqttJson.c_str());
    }
  }
}

// =============================================================================
// PROSES STANDBY (HEMAT DAYA & BANDWIDTH)
// =============================================================================
void processStandbyCycle(unsigned long currentMillis) {
  static unsigned long lastHeartbeatTime = 0;
  static unsigned long lastMqttHbTime = 0;

  if (currentMillis - lastHeartbeatTime >= 1000) { // 1 Hz
    lastHeartbeatTime = currentMillis;

    if (!isApModeActive && client && client.connected()) {
      String hb = "{\"is_testing\":false,\"preset\":\"" + currentPresetName + "\",\"edge_ai_class\":\"" + currentAiPrediction + "\"}\n";
      client.print(hb);
    }

    // Publikasi status standby berkala ke HiveMQ Cloud setiap 3 detik
    if (!isApModeActive && mqttClient.connected() && (currentMillis - lastMqttHbTime >= 3000)) {
      lastMqttHbTime = currentMillis;
      String currentSsid = WiFi.SSID();
      String currentIp = WiFi.localIP().toString();
      int currentRssi = WiFi.RSSI();
      String mqttHb = "{\"device\":\"ESP32_AquaSentry\",\"status\":\"standby\",\"is_testing\":false,\"preset\":\"" + currentPresetName + "\",\"ai_prediction\":\"" + currentAiPrediction + "\",\"ssid\":\"" + currentSsid + "\",\"ip\":\"" + currentIp + "\",\"rssi\":" + String(currentRssi) + "}";
      mqttClient.publish(MQTT_TOPIC_STATUS, mqttHb.c_str());
    }

    if (isApModeActive) {
      Serial.println("[HOTSPOT AP SETUP] Sambungkan HP ke 'ESP32_WaterAI' (PW: 12345678)!");
    } else {
      Serial.print("[STANDBY - "); Serial.print(currentPresetName);
      Serial.println("] Sensor OFF. Tekan Tombol (D32) untuk Mulai Uji 30s!");
    }
  }
}

// =============================================================================
// SETUP
// =============================================================================
void setup() {
  #if defined(ESP32)
    WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Nonaktifkan brownout detector agar ESP32 tidak mati mendadak saat tombol/WiFi/LED aktif
  #endif

  Serial.begin(115200);
  delay(1000);
  
  Serial.println("");
  Serial.println("========================================================");
  Serial.println("   ESP32 EDGE AI CLASSIFIER (CLEAN REFACTORED BUILD)");
  Serial.println("   HIVEMQ CLOUD MQTT ENABLED (PORT 8883 TLS)");
  Serial.println("========================================================");

  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  digitalWrite(PIN_LED_STATUS, HIGH); // Standby: Solid ON
  setClassificationLeds("");          // LED Hasil padam

  #if defined(ESP32)
    analogSetAttenuation(ADC_11db); // ADC Range penuh 0 - 3.3V
    pinMode(PIN_TDS, INPUT);
    pinMode(PIN_TURBIDITY, INPUT);
  #endif

  // 1. Baca Konfigurasi Wi-Fi Tersimpan di Flash NVS
  preferences.begin("wifi_cfg", false);
  savedSsid = preferences.getString("ssid", "");
  savedPassword = preferences.getString("pass", "");
  preferences.end();

  // 2. Logika Koneksi Wi-Fi
  if (savedSsid == "") {
    Serial.println("\n[WIFI] Belum ada Wi-Fi yang dikonfigurasi. Membuka Captive Portal AP!");
    startCaptivePortal();
  } else {
    Serial.print("[WIFI] Menghubungkan ke Wi-Fi tersimpan: '");
    Serial.print(savedSsid);
    Serial.print("'");

    WiFi.mode(WIFI_STA);
    WiFi.setSleep(true); // Low Power: Modem Sleep aktif selama standby
    WiFi.setAutoReconnect(true);
    WiFi.begin(savedSsid.c_str(), savedPassword.c_str());

    int retry = 0;
    while (WiFi.status() != WL_CONNECTED && retry < 25) { // 12.5 detik
      delay(500);
      Serial.print(".");
      retry++;
    }

    if (WiFi.status() == WL_CONNECTED) {
      Serial.println("\n========================================================");
      Serial.println(" [OK] BERHASIL TERHUBUNG KE WI-FI!");
      Serial.print(" >>> ALAMAT IP ESP32 : "); Serial.println(WiFi.localIP());
      Serial.println(" >>> PORT TCP        : 8080");
      Serial.println("========================================================\n");
      server.begin();
      #if defined(ESP32)
        WiFi.setSleep(false); // Pastikan Wi-Fi selalu bangun dan tidak terlambat menerima MQTT
      #endif
      configTime(0, 0, "pool.ntp.org", "time.nist.gov");
      Serial.println("[NTP] Menyelaraskan waktu RTC untuk enkripsi TLS HiveMQ Cloud...");
    } else {
      Serial.println("\n[!] Gagal terhubung ke Wi-Fi tersimpan. Meluncurkan Hotspot Setup...");
      startCaptivePortal();
    }
  }

  // 3. Konfigurasi HiveMQ Cloud MQTT (TLS 8883)
  tlsClient.setInsecure(); // Mengabaikan validasi root CA agar bebas masalah sertifikat
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(mqttCallback);
  mqttClient.setBufferSize(512);

  // 4. Kalibrasi Baseline Push Button & Pasang Kunci Pengaman Boot
  delay(100);
  buttonIdleState = digitalRead(PIN_BUTTON);
  buttonArmTime = millis() + 1500; // Tombol baru bisa ditekan 1.5 detik setelah siap

  Serial.println(">>> SISTEM SIAP! Preset: LOW. Tekan Push Button (D32) untuk Mulai Uji 30s! <<<\n");
}

// =============================================================================
// LOOP UTAMA
// =============================================================================
void loop() {
  unsigned long currentMillis = millis();

  // 1. Eksekusi trigger pengujian tertunda secara aman di thread utama (mencegah TLS stack corruption)
  if (pendingStartTest) {
    pendingStartTest = false;
    if (!isTesting) {
      startTestingSession(currentMillis);
    }
  }
  if (pendingCancelTest) {
    pendingCancelTest = false;
    if (isTesting) {
      cancelTestingSession();
    }
  }

  // 2. Layanan Wi-Fi / AP & Cloud MQTT
  if (isApModeActive) {
    dnsServer.processNextRequest();
    webServer.handleClient();
  } else {
    handleTcpCommunication();
    maintainMqtt();
  }

  // 2. Baca Push Button (Toggle: Mulai Uji atau Batalkan Uji)
  if (checkButtonPressed()) {
    if (!isTesting) {
      startTestingSession(currentMillis);
    } else {
      cancelTestingSession();
    }
  }

  // 3. Matikan LED Hasil Klasifikasi Otomatis Setelah 10 Detik
  if (!isTesting && (resultLedTurnOffTime > 0) && (currentMillis >= resultLedTurnOffTime)) {
    resultLedTurnOffTime = 0;
    setClassificationLeds("");
    Serial.println("[TIMER] 10 detik selesai. LED hasil klasifikasi dimatikan otomatis.");
  }

  // 4. Kontrol Indikator LED Status (Biru D33)
  if (isTesting) {
    if (currentMillis - lastStatusBlink >= BLINK_INTERVAL_MS) {
      lastStatusBlink = currentMillis;
      statusLedState = !statusLedState;
      digitalWrite(PIN_LED_STATUS, statusLedState ? HIGH : LOW);
    }
  } else {
    digitalWrite(PIN_LED_STATUS, HIGH); // Standby selalu Solid ON
  }

  // 5. Siklus Pengujian / Standby Hemat Daya
  if (isTesting) {
    processTestingCycle(currentMillis);
  } else {
    processStandbyCycle(currentMillis);
  }
}
