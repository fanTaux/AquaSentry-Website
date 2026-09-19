/*
 * ============================================================================
 * AquaSentry ESP32 Firmware (Captive Portal AP Mode + Dummy Sensors + Edge AI)
 * ITCC 2026 - Smart Health & Accessible Care
 * 
 * Features:
 * 1. Automatic Wi-Fi Provisioning & Captive Portal (Hotspot 'AquaSentry-Setup' at 192.168.4.1)
 * 2. NVS Non-Volatile Storage (Remembers Wi-Fi SSID & Password across reboots)
 * 3. Dummy Sensor Simulation Mode (Cycles through TDS & Turbidity test profiles)
 * 4. Embedded On-Chip Edge AI Inference (aquasentry_model.h - Random Forest)
 * 5. Physical RGB LED Control (GPIO25 Green, GPIO26 Yellow/Orange, GPIO27 Red)
 * 6. Dual-Mode Web Sync (Syncs telemetry & accepts Wi-Fi config updates from Web)
 * ============================================================================
 */

#include <WiFi.h>
#include <WebServer.h>
#include <DNSServer.h>
#include <Preferences.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

// Include Embedded Machine Learning Inference Engine (TinyML / Edge AI)
#include "aquasentry_model.h"

// --- SENSOR MODE TOGGLE ---
// Set to 'false' to read actual physical analog pins (GPIO34 TDS & GPIO35 Turbidity)
// Set to 'true' only if simulating dummy data without physical hardware connected
#define USE_SIMULATED_SENSORS false

// --- NVS Storage & Preferences ---
Preferences preferences;

// --- Wi-Fi Settings State ---
String wifiSsid = "wahh";
String wifiPassword = "tigakalidua";
bool isApMode = false;

// Captive Portal AP & DNS Server
const byte DNS_PORT = 53;
DNSServer dnsServer;
WebServer webServer(80);

// --- Backend API Server Endpoint (For Web Sync when Online) ---
// Ganti IP di bawah dengan IP Laptop yang menjalankan 'python backend/app.py'
const char* serverUrl = "http://192.168.1.100:8000/api/telemetry";
const char* wifiConfigUrl = "http://192.168.1.100:8000/api/wifi/config";

// --- Hardware Pin Definitions ---
const int TDS_PIN = 34;        // Analog Pin input TDS (ADC A0)
const int TURBIDITY_PIN = 35;  // Analog Pin input Turbidity (ADC A1)

const int LED_GREEN_PIN = 25;  // Low Risk (Hijau)
const int LED_YELLOW_PIN = 26; // Moderate Risk (Kuning)
const int LED_RED_PIN = 27;    // High Risk (Merah)

// --- Device Metadata ---
const char* deviceId = "aquasentry-esp32-01";
const char* sourceName = "Botol Sampel A";
const char* locationName = "Sumber Air A";

// --- Timing Variables (Sampling Rate 5 Hz -> dt = 200ms) ---
unsigned long lastSampleTime = 0;
const int sampleIntervalMs = 200; // 5 Hz sampling rate

const float VREF = 3.3;

// Global simulated values state
float simTds = 95.0;
float simTurb = 0.6;
int simCycleStage = 0;
unsigned long lastStageChange = 0;

// Function to generate realistic simulated sensor readings
void updateSimulatedSensors() {
  unsigned long now = millis();
  
  // Change simulation profile every 7 seconds
  if (now - lastStageChange > 7000) {
    lastStageChange = now;
    simCycleStage = (simCycleStage + 1) % 3;
    Serial.printf("\n[SIMULATOR] Switching Test Profile -> Stage %d\n", simCycleStage);
  }
  
  float tdsBase = 90.0;
  float turbBase = 0.6;
  
  switch (simCycleStage) {
    case 0: // Low Risk Stage (Clean Water)
      tdsBase = 110.0;
      turbBase = 0.7;
      break;
    case 1: // Moderate Risk Stage (Approaching threshold)
      tdsBase = 220.0;
      turbBase = 1.9;
      break;
    case 2: // High Risk Stage (Exceeds WHO/Permenkes)
      tdsBase = 450.0;
      turbBase = 5.2;
      break;
  }
  
  // Add small analog noise jitter
  simTds = tdsBase + (random(-30, 30) / 10.0f);
  simTurb = turbBase + (random(-10, 10) / 100.0f);
  if (simTurb < 0.1f) simTurb = 0.1f;
}

// Convert/Read Real Physical TDS Sensor Value (GPIO34) with Multi-Sample ADC Filtering
float readTDS() {
#if USE_SIMULATED_SENSORS
  return simTds;
#else
  int analogBuffer[30];
  for (int i = 0; i < 30; i++) {
    analogBuffer[i] = analogRead(TDS_PIN);
    delayMicroseconds(200);
  }
  long sum = 0;
  for (int i = 0; i < 30; i++) sum += analogBuffer[i];
  float rawAdc = (float)sum / 30.0f;
  
  float voltage = (rawAdc / 4095.0f) * VREF;
  if (voltage < 0.05f) {
    // Sensor probe di udara (belum dicelupkan ke air)
    return 0.0f;
  }
  
  float temperature = 25.0f; // Temperature compensation coefficient
  float compensationCoefficient = 1.0f + 0.02f * (temperature - 25.0f);
  float compensationVoltage = voltage / compensationCoefficient;
  
  float tdsValue = (133.42f * compensationVoltage * compensationVoltage * compensationVoltage 
                   - 255.86f * compensationVoltage * compensationVoltage 
                   + 857.39f * compensationVoltage) * 0.5f;
  if (tdsValue < 0.0f) tdsValue = 0.0f;
  if (tdsValue > 1500.0f) tdsValue = 1500.0f;
  return tdsValue;
#endif
}

// Convert/Read Real Physical Turbidity Sensor Value (GPIO35) with Multi-Sample ADC Filtering
float readTurbidity() {
#if USE_SIMULATED_SENSORS
  return simTurb;
#else
  int analogBuffer[30];
  for (int i = 0; i < 30; i++) {
    analogBuffer[i] = analogRead(TURBIDITY_PIN);
    delayMicroseconds(200);
  }
  long sum = 0;
  for (int i = 0; i < 30; i++) sum += analogBuffer[i];
  float rawAdc = (float)sum / 30.0f;
  
  float voltage = (rawAdc / 4095.0f) * VREF;
  
  // High precision linear & piecewise calibration curve for DFRobot Turbidity Sensor (SEN0189)
  float turbidityNtu = 0.1f;
  if (voltage >= 3.2f) {
    // Air sangat jernih (Tegangan tinggi 3.2V - 4.2V -> 0.1 - 1.0 NTU)
    turbidityNtu = 0.1f + (4.2f - voltage) * 0.9f;
  } else if (voltage >= 2.5f) {
    // Air normal / jernih (2.5V - 3.2V -> 1.0 - 5.0 NTU)
    turbidityNtu = 1.0f + (3.2f - voltage) * 5.7f;
  } else if (voltage >= 1.5f) {
    // Air agak keruh / sedang (1.5V - 2.5V -> 5.0 - 25.0 NTU)
    turbidityNtu = 5.0f + (2.5f - voltage) * 20.0f;
  } else {
    // Air sangat keruh / probe di udara (< 1.5V -> 25.0 - 100.0 NTU)
    turbidityNtu = 25.0f + (1.5f - voltage) * 50.0f;
  }

  if (turbidityNtu < 0.1f) turbidityNtu = 0.1f;
  if (turbidityNtu > 100.0f) turbidityNtu = 100.0f; // Max boundary untuk skrining air
  return turbidityNtu;
#endif
}

// Control Physical RGB LEDs locally on ESP32
void setPhysicalLed(const char* ledColor) {
  digitalWrite(LED_GREEN_PIN, LOW);
  digitalWrite(LED_YELLOW_PIN, LOW);
  digitalWrite(LED_RED_PIN, LOW);
  
  if (strcmp(ledColor, "GREEN") == 0 || strcmp(ledColor, "Hijau") == 0) {
    digitalWrite(LED_GREEN_PIN, HIGH);
  } else if (strcmp(ledColor, "YELLOW") == 0 || strcmp(ledColor, "ORANGE") == 0 || strcmp(ledColor, "Kuning") == 0 || strcmp(ledColor, "Oranye") == 0) {
    digitalWrite(LED_YELLOW_PIN, HIGH);
  } else if (strcmp(ledColor, "RED") == 0 || strcmp(ledColor, "Merah") == 0) {
    digitalWrite(LED_RED_PIN, HIGH);
  }
}

// --- Captive Portal HTML Web Page Generator ---
String getCaptivePortalHtml() {
  String html = "<!DOCTYPE html><html><head>";
  html += "<meta name='viewport' content='width=device-width, initial-scale=1.0'>";
  html += "<title>AquaSentry Wi-Fi Setup</title>";
  html += "<style>";
  html += "body { font-family: 'Segoe UI', Arial, sans-serif; background: #0f172a; color: #f8fafc; margin: 0; padding: 20px; display: flex; justify-content: center; }";
  html += ".card { background: #1e293b; border: 1px solid #334155; border-radius: 20px; padding: 25px; max-width: 400px; width: 100%; box-shadow: 0 10px 25px rgba(0,0,0,0.5); text-align: center; }";
  html += "h2 { color: #38bdf8; margin-bottom: 5px; font-size: 22px; }";
  html += "p { font-size: 13px; color: #94a3b8; margin-bottom: 20px; }";
  html += "input[type='text'], input[type='password'] { width: 100%; padding: 12px; margin: 8px 0 16px 0; border: 1px solid #475569; background: #0f172a; color: white; border-radius: 12px; box-sizing: border-box; font-size: 14px; }";
  html += "input[type='submit'] { width: 100%; padding: 14px; background: #0284c7; color: white; border: none; border-radius: 12px; font-weight: bold; font-size: 15px; cursor: pointer; transition: 0.2s; }";
  html += "input[type='submit']:hover { background: #0369a1; }";
  html += ".scan-item { background: #334155; padding: 10px; margin: 5px 0; border-radius: 10px; text-align: left; font-size: 13px; cursor: pointer; }";
  html += "</style></style></head><body>";
  html += "<div class='card'>";
  html += "<h2>💧 AquaSentry Wi-Fi Setup</h2>";
  html += "<p>Konfigurasi Koneksi Wi-Fi Perangkat ESP32</p>";
  
  html += "<form action='/save' method='POST'>";
  html += "<div style='text-align:left; font-size:12px; font-weight:bold; color:#cbd5e1; margin-bottom:4px;'>Nama Wi-Fi (SSID):</div>";
  html += "<input type='text' id='ssid' name='ssid' value='" + wifiSsid + "' placeholder='Masukkan SSID Wi-Fi' required>";
  
  html += "<div style='text-align:left; font-size:12px; font-weight:bold; color:#cbd5e1; margin-bottom:4px;'>Password Wi-Fi:</div>";
  html += "<input type='password' name='password' value='" + wifiPassword + "' placeholder='Masukkan Password Wi-Fi'>";
  
  html += "<input type='submit' value='Simpan & Hubungkan'>";
  html += "</form>";
  
  html += "<p style='margin-top:20px; font-size:11px; color:#64748b;'>AquaSentry Edge AI System - ITCC 2026</p>";
  html += "</div>";
  html += "<script>function setSsid(name){ document.getElementById('ssid').value = name; }</script>";
  html += "body></html>";
  return html;
}

// Start Captive Portal Hotspot Mode (AP Mode)
void startCaptivePortalAP() {
  isApMode = true;
  WiFi.mode(WIFI_AP);
  WiFi.softAP("AquaSentry-Setup", "");
  
  IPAddress apIP(192, 168, 4, 1);
  WiFi.softAPConfig(apIP, apIP, IPAddress(255, 255, 255, 0));
  
  dnsServer.start(DNS_PORT, "*", apIP);
  
  webServer.on("/", []() {
    webServer.send(200, "text/html", getCaptivePortalHtml());
  });
  
  webServer.on("/save", []() {
    if (webServer.hasArg("ssid")) {
      String newSsid = webServer.arg("ssid");
      String newPass = webServer.arg("password");
      
      preferences.begin("aquasentry", false);
      preferences.putString("ssid", newSsid);
      preferences.putString("password", newPass);
      preferences.end();
      
      String resHtml = "<!DOCTYPE html><html><body style='font-family:sans-serif; background:#0f172a; color:white; text-align:center; padding:40px;'>";
      resHtml += "<h2 style='color:#38bdf8;'>✅ Konfigurasi Wi-Fi Disimpan!</h2>";
      resHtml += "<p>Perangkat ESP32 sedang melakukan restart untuk terhubung ke Wi-Fi: <b>" + newSsid + "</b></p>";
      resHtml += "</body></html>";
      
      webServer.send(200, "text/html", resHtml);
      delay(2000);
      ESP.restart();
    } else {
      webServer.send(400, "text/plain", "Bad Request");
    }
  });
  
  webServer.onNotFound([]() {
    webServer.send(200, "text/html", getCaptivePortalHtml());
  });
  
  webServer.begin();
  Serial.println("\n[AP MODE ACTIVE] Hotspot 'AquaSentry-Setup' launched!");
  Serial.println("  Connect smartphone to 'AquaSentry-Setup' and navigate to http://192.168.4.1");
}

// Send telemetry & local Edge AI results to Backend API when Online
void syncWithWebDashboard(float tds, float turbidity, const char* localMlPrediction, float ari, float ass) {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(serverUrl);
  http.addHeader("Content-Type", "application/json");
  
  StaticJsonDocument<256> doc;
  doc["device_id"] = deviceId;
  doc["tds_mg_l"] = tds;
  doc["turbidity_ntu"] = turbidity;
  doc["edge_ai_prediction"] = localMlPrediction;
  doc["ari"] = ari;
  doc["ass_score"] = ass;
  doc["source"] = sourceName;
  doc["location"] = locationName;
  
  String jsonPayload;
  serializeJson(doc, jsonPayload);
  
  int httpCode = http.POST(jsonPayload);
  if (httpCode > 0) {
    Serial.printf("  [WEB SYNC] Post Telemetry Success (%d)\n", httpCode);
  } else {
    Serial.printf("  [WEB SYNC] Post Telemetry Failed (%s)\n", http.errorToString(httpCode).c_str());
  }
  
  http.end();
}

// Fetch active Wi-Fi config updates pushed from Web Dashboard
void checkWebWifiConfigUpdates() {
  if (WiFi.status() != WL_CONNECTED) return;
  
  HTTPClient http;
  http.begin(wifiConfigUrl);
  int httpCode = http.GET();
  
  if (httpCode == 200) {
    String payload = http.getString();
    StaticJsonDocument<256> doc;
    DeserializationError err = deserializeJson(doc, payload);
    
    if (!err && doc["ok"].as<bool>()) {
      String webSsid = doc["data"]["ssid"].as<String>();
      if (webSsid.length() > 0 && webSsid != wifiSsid) {
        Serial.printf("\n[WEB CONFIG UPDATE] Received new Wi-Fi credentials from Web Dashboard: '%s'\n", webSsid.c_str());
        
        preferences.begin("aquasentry", false);
        preferences.putString("ssid", webSsid);
        preferences.end();
        
        wifiSsid = webSsid;
        Serial.println("Restarting ESP32 to connect to new Wi-Fi...");
        delay(1000);
        ESP.restart();
      }
    }
  }
  http.end();
}

void setup() {
  Serial.begin(115200);
  delay(1000);
  
  Serial.println("\n========================================================");
  Serial.println("  AquaSentry ESP32 (Captive Portal + Edge AI)");
  Serial.println("========================================================");

  pinMode(TDS_PIN, INPUT);
  pinMode(TURBIDITY_PIN, INPUT);
  
  pinMode(LED_GREEN_PIN, OUTPUT);
  pinMode(LED_YELLOW_PIN, OUTPUT);
  pinMode(LED_RED_PIN, OUTPUT);
  
  // LED Self-Test
  setPhysicalLed("YELLOW");
  delay(500);
  setPhysicalLed("GREEN");
  
  // Load saved Wi-Fi credentials from Preferences NVS storage
  preferences.begin("aquasentry", true);
  wifiSsid = preferences.getString("ssid", "wahh");
  wifiPassword = preferences.getString("password", "tigakalidua");
  preferences.end();
  
  Serial.printf("Attempting Wi-Fi Connection to saved SSID: '%s'...\n", wifiSsid.c_str());
  
  WiFi.mode(WIFI_STA);
  WiFi.begin(wifiSsid.c_str(), wifiPassword.c_str());
  
  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 15) {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  
  if (WiFi.status() == WL_CONNECTED) {
    Serial.println("\n[ONLINE MODE] WiFi Connected Successfully!");
    Serial.print("  IP Address: ");
    Serial.println(WiFi.localIP());
  } else {
    Serial.println("\n[CONNECT FAILED] Unable to connect to saved Wi-Fi.");
    Serial.println("Launching Captive Portal AP Mode for initial setup...");
    startCaptivePortalAP();
  }
}

void loop() {
  // Process Captive Portal DNS & Web Server requests if in AP mode
  if (isApMode) {
    dnsServer.processNextRequest();
    webServer.handleClient();
  }

  unsigned long currentMillis = millis();
  
  // Sampling rate 5 Hz (Every 200ms)
  if (currentMillis - lastSampleTime >= sampleIntervalMs) {
    lastSampleTime = currentMillis;
    
#if USE_SIMULATED_SENSORS
    updateSimulatedSensors();
#endif
    
    // 1. Read Simulated or Physical Sensors
    float tds = readTDS();
    float turb = readTurbidity();
    
    // 2. RUN ON-CHIP EMBEDDED MACHINE LEARNING INFERENCE (EDGE AI / TINYML)
    // Executed locally on ESP32 in ~0.0001 ms
    const char* riskCategory = AquaSentryEdgeAI::predictRisk(tds, turb);
    float ari = AquaSentryEdgeAI::calculateARI(tds, turb);
    float ass = AquaSentryEdgeAI::calculateASS(ari);
    const char* ledColor = AquaSentryEdgeAI::getLedColor(riskCategory);
    
    // 3. CONTROL PHYSICAL RGB LED IMMEDIATELY ON ESP32
    setPhysicalLed(ledColor);
    
    Serial.printf("[5Hz EDGE AI] TDS: %.2f | Turb: %.2f | ARI: %.2f | ASS: %.1f | Risk: %s | LED: %s\n",
                  tds, turb, ari, ass, riskCategory, ledColor);
                  
    // 4. Sync with Web Dashboard if online in STA mode (every 1 second / 5 samples)
    static int syncCounter = 0;
    syncCounter++;
    if (syncCounter >= 5) {
      syncCounter = 0;
      if (!isApMode && WiFi.status() == WL_CONNECTED) {
        syncWithWebDashboard(tds, turb, riskCategory, ari, ass);
        checkWebWifiConfigUpdates();
      }
    }
  }
}
