"""
=============================================================================
AQUASENTRY - DASHBOARD TELEMETRI & KONTROL (HIVEMQ CLOUD MQTT)
=============================================================================
Fitur:
1. Menghubungkan ke Broker HiveMQ Cloud Serverless (Port 8883 TLS).
2. Memantau telemetri real-time (TDS, Turbidity, Hasil Analisis).
3. Mendeteksi identitas perangkat ESP32.
4. Pilihan Menu Ringkas 4 Opsi (Lihat TDS, Lihat Turbidity, Cek Keseluruhan, Antrean Data).
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

# Topik
TOPIC_TELEMETRY = "aquasentry/water_quality/telemetry"
TOPIC_RESULT    = "aquasentry/water_quality/result"
TOPIC_STATUS    = "aquasentry/status"
TOPIC_COMMAND   = "aquasentry/command"

latest_data = {
    "status": "Menunggu ESP32...",
    "device_id": "ESP32",
    "experiment_id": "Percobaan 1 / 2 / 3",
    "preset": "LOW",
    "tds_ppm": 85.0,
    "turbidity_ntu": 12.5,
    "ai_prediction": "Normal",
    "is_testing": False,
    "elapsed_sec": 0
}

def on_connect(client, userdata, flags, rc, properties=None):
    if rc == 0:
        print("\n" + "=" * 75)
        print(" [✓] TERHUBUNG KE BROKER CLOUD (TLS 8883)!")
        print(" Broker: " + MQTT_BROKER)
        print("=" * 75)
        client.subscribe([(TOPIC_TELEMETRY, 0), (TOPIC_RESULT, 0), (TOPIC_STATUS, 0)])
    else:
        print(f"[!] Gagal terhubung ke Broker, kode: {rc}")

def on_message(client, userdata, msg):
    try:
        payload_str = msg.payload.decode('utf-8')
        data = json.loads(payload_str)

        dev = data.get("device_id", data.get("device", latest_data["device_id"]))
        exp = data.get("experiment_id", latest_data["experiment_id"])
        latest_data["device_id"] = dev
        latest_data["experiment_id"] = exp
        
        if msg.topic == TOPIC_STATUS:
            status_val = data.get("status", "")
            latest_data["status"] = status_val
            if status_val == "online":
                print(f"\n [📢 NOTIF] Perangkat [{dev}] ONLINE di Cloud Broker!")
            elif status_val == "testing_started":
                print(f"\n [🚀 NOTIF] Pengujian dimulai pada [{dev}]!")
            elif status_val == "cancelled":
                print(f"\n [🛑 NOTIF] Pengujian dihentikan pada [{dev}]!")

        elif msg.topic == TOPIC_TELEMETRY:
            latest_data["is_testing"] = data.get("is_testing", False)
            latest_data["elapsed_sec"] = data.get("elapsed_sec", 0)
            latest_data["preset"] = data.get("preset", "LOW")
            latest_data["tds_ppm"] = data.get("tds_ppm", 85.0)
            latest_data["turbidity_ntu"] = data.get("turbidity_ntu", 12.5)
            latest_data["ai_prediction"] = data.get("ai_prediction", "Normal")

            elapsed = latest_data["elapsed_sec"]
            tds = latest_data["tds_ppm"]
            turb = latest_data["turbidity_ntu"]
            pred = latest_data["ai_prediction"]

            led_tag = ""
            if pred in ["Low", "Aman"]: led_tag = "[🟢 Hijau]"
            elif pred in ["Medium", "Sedang"]: led_tag = "[🟡 Kuning]"
            elif pred in ["High", "Berbahaya"]: led_tag = "[🔴 Merah]"

            print(f" 📡 [DATA LIVE - {dev}] Waktu: {elapsed:2d}s | TDS: {tds:5.1f} PPM | Turb: {turb:5.1f} NTU {led_tag}")

        elif msg.topic == TOPIC_RESULT:
            verdict = data.get("final_verdict", "Unknown")
            local_cat = data.get("local_category", "")
            avg_tds = data.get("avg_tds", latest_data["tds_ppm"])
            avg_turb = data.get("avg_turbidity", latest_data["turbidity_ntu"])

            kategori_str = "Air Bersih & Aman"
            if verdict == "Medium":
                kategori_str = "Kualitas Air Sedang"
            elif verdict == "High":
                kategori_str = "Kekeruhan Tinggi (Waspada)"

            if local_cat:
                kategori_str = f"{kategori_str} ({local_cat})"

            print("\n" + "#" * 75)
            print(f" 🏆 [HASIL ANALISIS AKHIR]: {kategori_str}")
            print(f" Perangkat : {dev}")
            print(f" Rata-rata : TDS={avg_tds:.1f} PPM | Turbiditas={avg_turb:.1f} NTU")
            if verdict == "Low":
                print(" Indikator : 🟢 LED Hijau")
            elif verdict == "Medium":
                print(" Indikator : 🟡 LED Kuning")
            elif verdict == "High":
                print(" Indikator : 🔴 LED Merah")
            print("#" * 75 + "\n")

    except Exception:
        pass

def main():
    print("=" * 75)
    print("      AQUASENTRY - DASHBOARD TELEMETRI & ANTREAN UJI")
    print("   Cloud Broker: " + MQTT_BROKER)
    print("=" * 75)

    client_id = f"AquaSentry_Laptop_{int(time.time())}"
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id)
    except AttributeError:
        client = mqtt.Client(client_id)

    client.username_pw_set(MQTT_USER, MQTT_PASS)
    client.tls_set(cert_reqs=ssl.CERT_NONE)
    client.tls_insecure_set(True)

    client.on_connect = on_connect
    client.on_message = on_message

    print(f"[+] Menghubungkan ke Broker ({MQTT_BROKER}:8883)...")
    try:
        client.connect(MQTT_BROKER, MQTT_PORT, 60)
        client.loop_start()
    except Exception as e:
        print(f"[!] Gagal menghubungkan ke Broker: {e}")
        return

    time.sleep(1.5)

    try:
        while True:
            print("\n" + "-" * 75)
            print(" ANTREAN PENGUJIAN SENSOR:")
            print(" [1] Lihat TDS")
            print(" [2] Lihat Turbidity")
            print(" [3] Cek Keseluruhan")
            print(" [4] Antrean Pengujian (Queue Test)")
            print(" [Q] Keluar")
            print("-" * 75)

            try:
                pilihan = input(" Masukkan pilihan (1/2/3/4/Q): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                break

            if pilihan == "1":
                client.publish(TOPIC_COMMAND, "SET_PRESET:LOW")
                print(" [✓] Parameter 'Lihat TDS' berhasil dimasukkan ke antrean ESP32.")
            elif pilihan == "2":
                client.publish(TOPIC_COMMAND, "SET_PRESET:MEDIUM")
                print(" [✓] Parameter 'Lihat Turbidity' berhasil dimasukkan ke antrean ESP32.")
            elif pilihan == "3":
                client.publish(TOPIC_COMMAND, "SET_PRESET:HIGH")
                print(" [✓] Parameter 'Cek Keseluruhan' berhasil dimasukkan ke antrean ESP32.")
            elif pilihan == "4":
                try:
                    c_tds = input(" Masukkan target TDS (PPM, Enter=150): ").strip()
                    c_turb = input(" Masukkan target Turbiditas (NTU, Enter=45): ").strip()
                    val_tds = float(c_tds) if c_tds else 150.0
                    val_turb = float(c_turb) if c_turb else 45.0
                    client.publish(TOPIC_COMMAND, f"SET_CUSTOM:{val_tds},{val_turb}")
                    print(f" [✓] Antrean pengujian berhasil dikirim: TDS={val_tds:.0f} PPM, Turb={val_turb:.0f} NTU.")
                except ValueError:
                    print(" [!] Input angka tidak valid.")
            elif pilihan == "q":
                print("\n[✓] Keluar dari Dashboard.")
                break
            else:
                print("[!] Pilihan tidak dikenali. Pilih 1, 2, 3, 4, atau Q.")

    except KeyboardInterrupt:
        print("\n\n[✓] Program dihentikan.")
    finally:
        client.loop_stop()
        client.disconnect()

if __name__ == "__main__":
    main()
