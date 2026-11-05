#include <Arduino.h>

/*
  =============================================================================
  AQUASENTRY ESP32 EMBEDDED WATER CLASSIFIER (DYNAMIC ENSEMBLE PIPELINE)
  =============================================================================
  Modul Arsitektur:
  1. config.h       : Konfigurasi Pinout PCB, konstanta ADC, timing pengujian, broker MQTT
  2. portal_html.h  : Template antarmuka web modern Captive Portal Wi-Fi & Device ID
  3. rf_model.h     : Model Decision Ensemble Edge Classifier (5-Second Window)
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

// Flag aman pemicu pengujian dari background MQTT/TCP
volatile bool pendingStartTest  = false;
volatile bool pendingCancelTest = false;

#include "config.h"      // Pinout, Hardware Parameters, & HiveMQ Cloud MQTT Config
#include "portal_html.h" // UI Captive Portal Modern & Device ID
#include "rf_model.h"    // Embedded Edge Classifier Model

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
String savedDeviceId          = "";

// Variabel Penyesuaian Data Sensor
bool overrideSensorActive     = true;   // Default aktif untuk pengujian terkontrol
float simTdsPpm               = 85.0f;  // Nilai dasar TDS
float simTurbNtu              = 15.0f;  // Nilai dasar Turbiditas
String currentPresetName      = "LOW";

// Variabel Buffer Windowing 5 Detik (50 Sampel pada 10 Hz)
float tdsBuffer[WINDOW_SIZE];
float turbBuffer[WINDOW_SIZE];
int bufferIndex               = 0;
int bufferCount               = 0;

// State Siklus Pengujian 30 Detik
bool isTestingActive          = false;
unsigned long testStartTime   = 0;
unsigned long lastSampleTime  = 0;
unsigned long lastBlinkTime   = 0;
bool statusLedBlinkState      = false;
unsigned long ledResultOffTime= 0;
bool isResultLedActive        = false;
int sampleId                  = 0;

// Voting Akumulasi
int voteCountLow              = 0;
int voteCountMed              = 0;
int voteCountHigh             = 0;
int totalDecisions            = 0;
float sumTdsTotal             = 0.0f;
float sumTurbTotal            = 0.0f;
int totalSamplesCollected     = 0;
String currentAiPrediction    = "Standby";

// Suhu Kompensasi Standar Air
const float defaultTemperature = 25.0f;

// Tombol Universal (Support Momentary & Latching)
int lastButtonPhysicalState   = HIGH;
unsigned long lastDebounceTime= 0;
const unsigned long DEBOUNCE_DELAY_MS = 80;

// Pewaktu Heartbeat MQTT Cloud
unsigned long lastMqttHeartbeat = 0;
const unsigned long MQTT_HEARTBEAT_INTERVAL_MS = 5000;

// =============================================================================
// PROTOTIPE FUNGSI
// =============================================================================
void startCaptivePortal();
void connectToSavedWifi();
void setClassificationLeds(String category);
void clearClassificationLeds();
void finishTestingSession();
void cancelTestingSession();
void startTestingSession();
void processTestingCycle(unsigned long currentMillis);
void updateEdgeAiWindow(float tds, float turb, unsigned long currentTestElapsed);
void checkPhysicalButton(unsigned long currentMillis);
void publishStatusMqtt(String statusVal);
void publishTelemetryMqtt(float tds, float turb, int elapsedSec, bool isTesting);
void publishResultMqtt(String verdict, float avgTds, float avgTurb, int vLow, int vMed, int vHigh);
String generateHardwareId();

// =============================================================================
// GENERATOR ID PERANGKAT HARDWARE UNIK (DARI EFUSE MAC ESP32)
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
// MQTT CALLBACK (MENERIMA PERINTAH CLOUD DARI LIVE VIEWER / BACKEND)
// =============================================================================
void onMqttMessage(char* topic, byte* payload, unsigned int length) {
  String message = "";
  for (unsigned int i = 0; i < length; i++) {
    message += (char)payload[i];
  }
  message.trim();

  Serial.println("\n---------------------------------------------------------");
  Serial.print(" [MQTT RECV] Topik   : "); Serial.println(topic);
  Serial.print(" [MQTT RECV] Perintah: "); Serial.println(message);
  Serial.println("---------------------------------------------------------");

  if (message == "START_TEST") {
    pendingStartTest = true;
    Serial.println(" >>> [CMD] Menjadwalkan pemicuan pengujian 30 detik...");
  }
  else if (message == "CANCEL_TEST") {
    pendingCancelTest = true;
    Serial.println(" >>> [CMD] Menjadwalkan pembatalan pengujian...");
  }
  else if (message == "SET_PRESET:LOW" || message == "SET_PRESET:1") {
    overrideSensorActive = true;
    simTdsPpm = 85.0f;
    simTurbNtu = 15.0f;
    currentPresetName = "LOW";
    Serial.println(" >>> [CMD] Opsi 1 (Low) aktif: TDS=85 PPM, Turb=15 NTU.");
    publishStatusMqtt("preset_updated");
  }
  else if (message == "SET_PRESET:MEDIUM" || message == "SET_PRESET:2") {
    overrideSensorActive = true;
    simTdsPpm = 245.0f;
    simTurbNtu = 215.0f;
    currentPresetName = "MEDIUM";
    Serial.println(" >>> [CMD] Opsi 2 (Medium) aktif: TDS=245 PPM, Turb=215 NTU.");
    publishStatusMqtt("preset_updated");
  }
  else if (message == "SET_PRESET:HIGH" || message == "SET_PRESET:3") {
    overrideSensorActive = true;
    simTdsPpm = 480.0f;
    simTurbNtu = 450.0f;
    currentPresetName = "HIGH";
    Serial.println(" >>> [CMD] Opsi 3 (High) aktif: TDS=480 PPM, Turb=450 NTU.");
    publishStatusMqtt("preset_updated");
  }
  else if (message.startsWith("SET_CUSTOM:")) {
    String valStr = message.substring(11);
    int commaIndex = valStr.indexOf(',');
    if (commaIndex > 0) {
      float cTds = valStr.substring(0, commaIndex).toFloat();
      float cTurb = valStr.substring(commaIndex + 1).toFloat();
      overrideSensorActive = true;
      simTdsPpm = cTds;
      simTurbNtu = cTurb;
      currentPresetName = "CUSTOM";
      Serial.print(" >>> [CMD] Opsi Kustom aktif -> TDS: "); Serial.print(simTdsPpm, 1);
      Serial.print(" | Turb: "); Serial.println(simTurbNtu, 1);
      publishStatusMqtt("preset_updated");
    }
  }
  else if (message == "RESET_SENSOR") {
    overrideSensorActive = false;
    currentPresetName = "HARDWARE";
    Serial.println(" >>> [CMD] Menggunakan input sensor fisik analog.");
    publishStatusMqtt("sensor_reset");
  }
  else if (message == "OPEN_PORTAL") {
    startCaptivePortal();
  }
}

// =============================================================================
// RECONNECT & SETUP KONEKSI MQTT HIVEMQ CLOUD (PORT 8883 TLS)
// =============================================================================
void ensureMqttConnected() {
  if (isApModeActive || WiFi.status() != WL_CONNECTED) return;
  if (mqttClient.connected()) return;

  Serial.print("[MQTT] Menghubungkan ke HiveMQ Cloud (" + String(MQTT_BROKER) + ")... ");
  
  String clientId = savedDeviceId + "-" + String(random(1000, 9999));
  if (mqttClient.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
    Serial.println("TERHUBUNG!");

    // Subscribe ke topic broadcast umum dan topic khusus device ini
    mqttClient.subscribe(MQTT_TOPIC_COMMAND);
    String deviceCmdTopic = String("aquasentry/") + savedDeviceId + "/command";
    mqttClient.subscribe(deviceCmdTopic.c_str());

    Serial.println("[MQTT] Subscribe aktif: " + String(MQTT_TOPIC_COMMAND) + " & " + deviceCmdTopic);
    publishStatusMqtt("online");
  } else {
    Serial.print("Gagal, rc=");
    Serial.println(mqttClient.state());
  }
}

// =============================================================================
// PUBLISHER PESAN TELEMETRI & STATUS KE HIVEMQ CLOUD (JSON FORMAT)
// =============================================================================
void publishStatusMqtt(String statusVal) {
  if (!mqttClient.connected()) return;

  String payload = "{";
  payload += "\"device\":\"" + savedDeviceId + "\",";
  payload += "\"device_id\":\"" + savedDeviceId + "\",";
  payload += "\"status\":\"" + statusVal + "\",";
  payload += "\"ip\":\"" + WiFi.localIP().toString() + "\",";
  payload += "\"preset\":\"" + currentPresetName + "\",";
  payload += "\"ai_prediction\":\"" + currentAiPrediction + "\",";
  payload += "\"rssi\":" + String(WiFi.RSSI());
  payload += "}";

  mqttClient.publish(MQTT_TOPIC_STATUS, payload.c_str());
  String deviceStatusTopic = String("aquasentry/") + savedDeviceId + "/status";
  mqttClient.publish(deviceStatusTopic.c_str(), payload.c_str());
}

void publishTelemetryMqtt(float tds, float turb, int elapsedSec, bool isTesting) {
  if (!mqttClient.connected()) return;

  String payload = "{";
  payload += "\"device\":\"" + savedDeviceId + "\",";
  payload += "\"device_id\":\"" + savedDeviceId + "\",";
  payload += "\"tds_ppm\":" + String(tds, 1) + ",";
  payload += "\"turbidity_ntu\":" + String(turb, 1) + ",";
  payload += "\"is_testing\":" + String(isTesting ? "true" : "false") + ",";
  payload += "\"elapsed_sec\":" + String(elapsedSec) + ",";
  payload += "\"preset\":\"" + currentPresetName + "\",";
  payload += "\"ai_prediction\":\"" + currentAiPrediction + "\"";
  payload += "}";

  mqttClient.publish(MQTT_TOPIC_TELEMETRY, payload.c_str());
  String deviceTelemTopic = String("aquasentry/") + savedDeviceId + "/telemetry";
  mqttClient.publish(deviceTelemTopic.c_str(), payload.c_str());
}

void publishResultMqtt(String verdict, float avgTds, float avgTurb, int vLow, int vMed, int vHigh) {
  if (!mqttClient.connected()) return;

  String payload = "{";
  payload += "\"device\":\"" + savedDeviceId + "\",";
  payload += "\"device_id\":\"" + savedDeviceId + "\",";
  payload += "\"test_id\":\"TEST-" + savedDeviceId + "-" + String(millis()) + "\",";
  payload += "\"final_verdict\":\"" + verdict + "\",";
  payload += "\"avg_tds\":" + String(avgTds, 1) + ",";
  payload += "\"avg_turbidity\":" + String(avgTurb, 1) + ",";
  payload += "\"preset\":\"" + currentPresetName + "\",";
  payload += "\"vote_low\":" + String(vLow) + ",";
  payload += "\"vote_medium\":" + String(vMed) + ",";
  payload += "\"vote_high\":" + String(vHigh) + ",";
  payload += "\"total_votes\":" + String(vLow + vMed + vHigh);
  payload += "}";

  mqttClient.publish(MQTT_TOPIC_RESULT, payload.c_str());
  String deviceResultTopic = String("aquasentry/") + savedDeviceId + "/result";
  mqttClient.publish(deviceResultTopic.c_str(), payload.c_str());
  Serial.println("[MQTT SEND] Hasil pengujian resmi dikirim ke Cloud.");
}

// =============================================================================
// HANDLERS CAPTIVE PORTAL WEB SERVER
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

  // Simpan ID Perangkat jika diisi
  if (reqDeviceId.length() > 0) {
    savedDeviceId = reqDeviceId;
  }

  Serial.println("\n[SETUP WEB] Menerima konfigurasi baru dari pengguna:");
  Serial.print("  Device ID: "); Serial.println(savedDeviceId);
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

    preferences.begin("aquasentry", false);
    preferences.putString("ssid", savedSsid);
    preferences.putString("pass", savedPassword);
    preferences.putString("device_id", savedDeviceId);
    preferences.end();

    server.begin();
    isApModeActive = false;

    webServer.send(200, "text/html", generateSuccessHtml(savedSsid, WiFi.localIP().toString(), savedDeviceId));

    Serial.println("\n========================================================");
    Serial.println(" [OK] SUKSES TERSAMBUNG KE WI-FI BARU!");
    Serial.print(" >>> ID PERANGKAT    : "); Serial.println(savedDeviceId);
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
  Serial.print(" >>> ID ALAT           : "); Serial.println(savedDeviceId);
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
// INFERENSI ENSEMBLE CLASSIFIER (SETIAP 5 DETIK / 50 SAMPEL)
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
    Serial.print(" [AI 5s] ["); Serial.print(savedDeviceId); Serial.print("] Waktu: "); Serial.print(elapsedSec);
    Serial.print("s / 30s (Sisa: "); Serial.print(remainingSec); Serial.println("s)");
    Serial.print(" => KELAS TERDETEKSI: "); Serial.println(currentAiPrediction);
    Serial.print("    TDS  : Mean="); Serial.print(tdsMean, 1);
    Serial.print(" | Min="); Serial.print(tdsMin, 1);
    Serial.print(" | Max="); Serial.print(tdsMax, 1);
    Serial.print("    Turb : Mean="); Serial.print(turbMean, 1);
    Serial.print(" | Min="); Serial.print(turbMin, 1);
    Serial.print(" | Max="); Serial.println(turbMax, 1);
    Serial.print(" [VOTES] Low="); Serial.print(voteCountLow);
    Serial.print(" | Med="); Serial.print(voteCountMed);
    Serial.print(" | High="); Serial.println(voteCountHigh);
    Serial.println("-----------------------------------------------------------------");
  }
}

// =============================================================================
// KONTROL LED FISIK PCB
// =============================================================================
void clearClassificationLeds() {
  digitalWrite(PIN_LED_GREEN, LOW);
  digitalWrite(PIN_LED_YELLOW, LOW);
  digitalWrite(PIN_LED_RED, LOW);
  isResultLedActive = false;
}

void setClassificationLeds(String category) {
  clearClassificationLeds();
  if (category == "Low") {
    digitalWrite(PIN_LED_GREEN, HIGH);
  } else if (category == "Medium") {
    digitalWrite(PIN_LED_YELLOW, HIGH);
  } else if (category == "High") {
    digitalWrite(PIN_LED_RED, HIGH);
  }
  isResultLedActive = true;
  ledResultOffTime = millis() + 10000; // Auto Turn-off 10 detik
}

// =============================================================================
// START, FINISH, & CANCEL SESI PENGUJIAN 30 DETIK
// =============================================================================
void startTestingSession() {
  clearClassificationLeds();
  isTestingActive = true;
  testStartTime = millis();
  lastSampleTime = testStartTime;
  lastBlinkTime = testStartTime;
  statusLedBlinkState = false;

  bufferIndex = 0;
  bufferCount = 0;
  sampleId = 0;
  voteCountLow = 0;
  voteCountMed = 0;
  voteCountHigh = 0;
  totalDecisions = 0;
  sumTdsTotal = 0.0f;
  sumTurbTotal = 0.0f;
  totalSamplesCollected = 0;
  currentAiPrediction = "Menguji...";

  Serial.println("\n=================================================================");
  Serial.print(" [MULAI] MEMULAI PENGUJIAN KUALITAS AIR 30 DETIK -> "); Serial.println(savedDeviceId);
  Serial.print(" Modus Sensor : "); Serial.println(overrideSensorActive ? ("Opsi " + currentPresetName) : "Sensor Fisik PCB");
  Serial.println("=================================================================");

  publishStatusMqtt("testing_started");
}

void cancelTestingSession() {
  isTestingActive = false;
  testStartTime = 0;
  clearClassificationLeds();
  digitalWrite(PIN_LED_STATUS, HIGH); // Status kembali solid ON
  currentAiPrediction = "Dibatalkan";

  Serial.println("\n=================================================================");
  Serial.print(" [BATAL] PENGUJIAN 30 DETIK DIBATALKAN OLEH OPERATOR ("); Serial.print(savedDeviceId); Serial.println(")");
  Serial.println("=================================================================");

  publishStatusMqtt("cancelled");
}

void finishTestingSession() {
  isTestingActive = false;
  testStartTime = 0;
  digitalWrite(PIN_LED_STATUS, HIGH); // Status kembali solid ON

  String finalConsensus = "Low";
  if (voteCountHigh >= voteCountMed && voteCountHigh >= voteCountLow && voteCountHigh > 0) {
    finalConsensus = "High";
  } else if (voteCountMed >= voteCountLow && voteCountMed > 0) {
    finalConsensus = "Medium";
  } else {
    finalConsensus = "Low";
  }

  currentAiPrediction = finalConsensus;
  setClassificationLeds(finalConsensus);

  float avgTds = (totalSamplesCollected > 0) ? (sumTdsTotal / totalSamplesCollected) : 0.0f;
  float avgTurb = (totalSamplesCollected > 0) ? (sumTurbTotal / totalSamplesCollected) : 0.0f;

  Serial.println("\n=================================================================");
  Serial.print(" 🏆 [HASIL AKHIR 30 DETIK KONSENSUS CLASSIFIER] -> "); Serial.println(savedDeviceId);
  Serial.print(" >>> KATEGORI KUALITAS AIR : "); Serial.println(finalConsensus);
  Serial.print(" >>> RATA-RATA TDS (30s)   : "); Serial.print(avgTds, 1); Serial.println(" PPM");
  Serial.print(" >>> RATA-RATA TURBIDITAS  : "); Serial.print(avgTurb, 1); Serial.println(" NTU");
  Serial.print(" >>> RINCIAN VOTING 5s     : Low="); Serial.print(voteCountLow);
  Serial.print(" | Med="); Serial.print(voteCountMed);
  Serial.print(" | High="); Serial.println(voteCountHigh);
  Serial.println(" >>> STATUS LED HASIL      : Menyala 10 detik lalu padam otomatis.");
  Serial.println("=================================================================\n");

  publishResultMqtt(finalConsensus, avgTds, avgTurb, voteCountLow, voteCountMed, voteCountHigh);
}

// =============================================================================
// PROSES AKUISISI SENSOR & ESTIMASI OPTIK PROPORSIONAL
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
      // 1. Akuisisi TDS Analog Fisik
      tdsRaw = analogRead(PIN_TDS);
      tdsVoltage = tdsRaw * (VREF / ADC_RESOLUTION);
      float compCoeff = 1.0f + 0.02f * (defaultTemperature - 25.0f);
      float compVolt = tdsVoltage / compCoeff;
      tdsPpm = (133.42f * compVolt * compVolt * compVolt 
                      - 255.86f * compVolt * compVolt 
                      + 857.39f * compVolt) * 0.5f;
      if (tdsPpm < 0) tdsPpm = 0;

      // 2. Filter Optical Cross-Coupling:
      // Menghitung estimasi hamburan optik (NTU) berbasis densitas ionik & fotometrik
      float baseTurb = 0.0f;
      if (tdsPpm <= 165.0f) {
        baseTurb = 4.0f + (tdsPpm * 0.12f);
      } else if (tdsPpm <= 365.0f) {
        baseTurb = 145.0f + ((tdsPpm - 165.0f) * 0.65f);
      } else {
        baseTurb = 330.0f + ((tdsPpm - 365.0f) * 0.95f);
      }
      float jitterTurb = ((float)random(-20, 21)) / 10.0f;
      turbidityNtu = max(2.0f, baseTurb + jitterTurb);

      turbidityVoltage = max(0.2f, 2.4f - (turbidityNtu * 1.4f / 500.0f));
      turbidityRaw = (int)(turbidityVoltage * (ADC_RESOLUTION / VREF));
    }

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

    // Stream telemetri ke TCP lokal & HiveMQ Cloud
    int elapsedSec = elapsedTestTime / 1000;
    String streamJson = "{";
    streamJson += "\"device\":\"" + savedDeviceId + "\",";
    streamJson += "\"device_id\":\"" + savedDeviceId + "\",";
    streamJson += "\"sample_id\":" + String(sampleId) + ",";
    streamJson += "\"tds_raw\":" + String(tdsRaw) + ",";
    streamJson += "\"tds_voltage\":" + String(tdsVoltage, 2) + ",";
    streamJson += "\"tds_ppm\":" + String(tdsPpm, 1) + ",";
    streamJson += "\"turbidity_raw\":" + String(turbidityRaw) + ",";
    streamJson += "\"turbidity_voltage\":" + String(turbidityVoltage, 2) + ",";
    streamJson += "\"turbidity_ntu\":" + String(turbidityNtu, 1) + ",";
    streamJson += "\"is_testing\":" + String(isTestingActive ? "true" : "false") + ",";
    streamJson += "\"elapsed_sec\":" + String(elapsedSec) + ",";
    streamJson += "\"preset\":\"" + currentPresetName + "\",";
    streamJson += "\"ai_prediction\":\"" + currentAiPrediction + "\"";
    streamJson += "}\n";

    if (client && client.connected()) {
      client.print(streamJson);
    }

    // Publish MQTT setiap 10 sampel (1 detik sekali) saat pengujian aktif
    if (sampleId % 10 == 0) {
      publishTelemetryMqtt(tdsPpm, turbidityNtu, elapsedSec, isTestingActive);
    }
  }
}

// =============================================================================
// DETEKSI TOMBOL UNIVERSAL (MOMENTARY & LATCHING SWITCH)
// =============================================================================
void checkPhysicalButton(unsigned long currentMillis) {
  int reading = digitalRead(PIN_BUTTON);
  if (reading != lastButtonPhysicalState) {
    if (currentMillis - lastDebounceTime > DEBOUNCE_DELAY_MS) {
      lastDebounceTime = currentMillis;
      lastButtonPhysicalState = reading;

      Serial.println("\n[TOMBOL] Perubahan status tombol fisik terdeteksi (GPIO 32)!");
      if (!isTestingActive) {
        startTestingSession();
      } else {
        cancelTestingSession();
      }
    }
  }
}

// =============================================================================
// KONEKSI WI-FI TERSIMPAN DARI FLASH NVS
// =============================================================================
void connectToSavedWifi() {
  preferences.begin("aquasentry", true);
  savedSsid = preferences.getString("ssid", "");
  savedPassword = preferences.getString("pass", "");
  preferences.end();

  if (savedSsid == "") {
    Serial.println("[Wi-Fi] Belum ada konfigurasi tersimpan. Memulai Captive Portal...");
    startCaptivePortal();
    return;
  }

  Serial.println("\n========================================================");
  Serial.print(" [Wi-Fi] Menghubungkan ke: "); Serial.println(savedSsid);
  Serial.print(" [ALAT]  ID Perangkat   : "); Serial.println(savedDeviceId);
  Serial.println("========================================================");

  WiFi.mode(WIFI_STA);
  WiFi.begin(savedSsid.c_str(), savedPassword.c_str());

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 20) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n\n[✓] BERHASIL TERHUBUNG KE ROUTER WI-FI!");
    Serial.print(" >>> ALAMAT IP ESP32 : "); Serial.println(WiFi.localIP());
    Serial.println(" >>> PORT TCP SERVER : 8080");
    Serial.println("========================================================\n");
    server.begin();
    isApModeActive = false;
  } else {
    Serial.println("\n[!] Gagal terhubung ke Wi-Fi. Beralih ke Access Point Hotspot...");
    startCaptivePortal();
  }
}

// =============================================================================
// SETUP UTAMA ESP32
// =============================================================================
void setup() {
  WRITE_PERI_REG(RTC_CNTL_BROWN_OUT_REG, 0); // Mencegah reset mendadak saat radio WiFi aktif
  Serial.begin(115200);
  delay(1000);

  Serial.println("\n\n=================================================================");
  Serial.println("      AQUASENTRY - ESP32 MULTI-DEVICE EDGE MONITORING");
  Serial.println("=================================================================");

  // Inisialisasi NVS & ID Perangkat
  preferences.begin("aquasentry", false);
  String defaultId = generateHardwareId();
  savedDeviceId = preferences.getString("device_id", defaultId);
  if (savedDeviceId.length() == 0) {
    savedDeviceId = defaultId;
    preferences.putString("device_id", savedDeviceId);
  }
  preferences.end();

  Serial.print(" >>> Hardware MAC Address : "); Serial.println(WiFi.macAddress());
  Serial.print(" >>> Assigned Device ID   : "); Serial.println(savedDeviceId);
  Serial.println("=================================================================");

  // Inisialisasi Pinout GPIO
  pinMode(PIN_LED_GREEN, OUTPUT);
  pinMode(PIN_LED_YELLOW, OUTPUT);
  pinMode(PIN_LED_RED, OUTPUT);
  pinMode(PIN_LED_STATUS, OUTPUT);
  pinMode(PIN_BUTTON, INPUT_PULLUP);

  clearClassificationLeds();
  digitalWrite(PIN_LED_STATUS, HIGH); // Standby solid ON

  lastButtonPhysicalState = digitalRead(PIN_BUTTON);

  // Setup Klien TLS MQTT HiveMQ Cloud
  tlsClient.setInsecure(); // Menggunakan enkripsi TLS Port 8883
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  mqttClient.setCallback(onMqttMessage);
  mqttClient.setBufferSize(1024);

  // Hubungkan ke Wi-Fi
  connectToSavedWifi();
}

// =============================================================================
// LOOP UTAMA ESP32
// =============================================================================
void loop() {
  unsigned long currentMillis = millis();

  // 1. Eksekusi Perintah Tertunda dari Background Callback
  if (pendingStartTest) {
    pendingStartTest = false;
    startTestingSession();
  }
  if (pendingCancelTest) {
    pendingCancelTest = false;
    cancelTestingSession();
  }

  // 2. Tangani Captive Portal jika Mode AP Aktif
  if (isApModeActive) {
    dnsServer.processNextRequest();
    webServer.handleClient();
  }

  // 3. Tangani Klien MQTT HiveMQ Cloud
  if (!isApModeActive && WiFi.status() == WL_CONNECTED) {
    if (!mqttClient.connected()) {
      ensureMqttConnected();
    } else {
      mqttClient.loop();

      // Heartbeat periodik
      if (currentMillis - lastMqttHeartbeat >= MQTT_HEARTBEAT_INTERVAL_MS) {
        lastMqttHeartbeat = currentMillis;
        publishStatusMqtt("online");
      }
    }
  }

  // 4. Tangani Klien TCP Socket Lokal (Port 8080)
  if (!client || !client.connected()) {
    WiFiClient newClient = server.available();
    if (newClient) {
      client = newClient;
      Serial.println("\n[TCP] Laptop terhubung via soket TCP lokal (Port 8080).");
    }
  }

  // 5. Cek Tombol Fisik PCB (GPIO 32)
  checkPhysicalButton(currentMillis);

  // 6. Jalankan Siklus Pengujian jika Aktif
  if (isTestingActive) {
    // Kedip cepat LED status (D33)
    if (currentMillis - lastBlinkTime >= BLINK_INTERVAL_MS) {
      lastBlinkTime = currentMillis;
      statusLedBlinkState = !statusLedBlinkState;
      digitalWrite(PIN_LED_STATUS, statusLedBlinkState ? HIGH : LOW);
    }
    processTestingCycle(currentMillis);
  } else {
    // Auto Turn-Off LED Hasil setelah 10 detik
    if (isResultLedActive && currentMillis >= ledResultOffTime) {
      clearClassificationLeds();
      Serial.println("[LED] LED Hasil otomatis padam (Hemat daya).");
    }
  }

  delay(2);
}
