"""
=============================================================================
AQUASENTRY - HIVEMQ CLOUD MQTT LIVE DATA VIEWER
=============================================================================
Fitur:
1. Menghubungkan ke Broker HiveMQ Cloud Serverless (Port 8883 TLS).
2. Memantau telemetri real-time multi-device (TDS, Turbidity, Prediksi Model).
3. Menampilkan hasil klasifikasi 30 detik (LOW, MEDIUM, HIGH) per ID alat.
4. Mengirim perintah jarak jauh (Pilih Opsi Data, Start Uji, Cancel Uji).
=============================================================================
"""

import sys
import os
import time
import json
import ssl

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import paho.mqtt.client as mqtt

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASS

TOPIC_TELEMETRY = "aquasentry/water_quality/telemetry"
TOPIC_RESULT    = "aquasentry/water_quality/result"
TOPIC_STATUS    = "aquasentry/status"
TOPIC_COMMAND   = "aquasentry/command"

latest_data = {
    "device_id": "Unknown",
    "status": "Menunggu ESP32...",
    "preset": "LOW",
    "tds_ppm": 0.0,
    "turbidity_ntu": 0.0,
    "ai_prediction": "Standby",
    "is_testing": False,
    "elapsed_sec": 0
}

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("\n" + "=" * 70)
        print(" [✓] BERHASIL TERHUBUNG KE HIVEMQ CLOUD (TLS 8883)!")
        print(" Broker: " + MQTT_BROKER)
        print(" Akun  : " + MQTT_USER)
        print("=" * 70)
        client.subscribe("aquasentry/#")
    else:
        print(f"[!] Gagal terhubung ke HiveMQ Cloud, kode: {rc}")

def on_message(client, userdata, msg):
    try:
        payload_str = msg.payload.decode('utf-8')
        data = json.loads(payload_str)
        dev_id = data.get("device", data.get("device_id", "AquaSentry"))
        latest_data["device_id"] = dev_id

        if msg.topic.endswith("/status"):
            status_val = data.get("status", "")
            latest_data["status"] = status_val
            if status_val == "online":
                print(f"\n [📢 NOTIF] Alat [{dev_id}] ONLINE di HiveMQ Cloud!")
            elif status_val == "testing_started":
                preset_used = data.get("preset", "LOW")
                print(f"\n [🚀 NOTIF] PENGUJIAN 30s DIMULAI DI ALAT [{dev_id}]! Opsi: [{preset_used}]")
            elif status_val == "cancelled":
                print(f"\n [🛑 NOTIF] Pengujian dibatalkan pada [{dev_id}]!")

        elif msg.topic.endswith("/telemetry"):
            latest_data["is_testing"] = data.get("is_testing", False)
            latest_data["elapsed_sec"] = data.get("elapsed_sec", 0)
            latest_data["preset"] = data.get("preset", "LOW")
            latest_data["tds_ppm"] = data.get("tds_ppm", 0.0)
            latest_data["turbidity_ntu"] = data.get("turbidity_ntu", 0.0)
            latest_data["ai_prediction"] = data.get("ai_prediction", "Standby")

            elapsed = latest_data["elapsed_sec"]
            sisa = max(0, 30 - elapsed)
            tds = latest_data["tds_ppm"]
            turb = latest_data["turbidity_ntu"]
            pred = latest_data["ai_prediction"]

            if latest_data["is_testing"]:
                print(f" >>> [{dev_id}] WAKTU: {elapsed:02d}/30s (Sisa {sisa:02d}s) | TDS: {tds:5.1f} PPM | Turb: {turb:5.1f} NTU | Prediksi: [{pred}]")

        elif msg.topic.endswith("/result"):
            verdict = data.get("final_verdict", "Low")
            avg_tds = data.get("avg_tds", 0.0)
            avg_turb = data.get("avg_turbidity", 0.0)
            v_low = data.get("vote_low", 0)
            v_med = data.get("vote_medium", 0)
            v_high = data.get("vote_high", 0)

            print("\n" + "=" * 70)
            print(f" 🏆 [HASIL RESMI CLOUD] ALAT: [{dev_id}] -> HASIL: [{verdict.upper()}]")
            print(f" Rata-rata TDS (30s)  : {avg_tds:.1f} PPM")
            print(f" Rata-rata Turbiditas : {avg_turb:.1f} NTU")
            print(f" Rincian Voting 5-Detik: Low={v_low} | Med={v_med} | High={v_high}")
            print("=" * 70 + "\n")

    except Exception:
        pass

def main():
    print("=" * 70)
    print("      AQUASENTRY - MQTT REAL-TIME MONITOR (MULTI-DEVICE)       ")
    print("=" * 70)

    client_id = f"AquaSentry_MqttMonitor_{int(time.time())}"
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id)
    except AttributeError:
        client = mqtt.Client(client_id)

    client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)

    client.on_connect = on_connect
    client.on_message = on_message

    print(f"\n[+] Menghubungkan ke {MQTT_BROKER}:8883...")
    client.connect(MQTT_BROKER, MQTT_PORT, 60)

    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("\n[✓] Monitor dihentikan.")
        client.disconnect()

if __name__ == "__main__":
    main()
