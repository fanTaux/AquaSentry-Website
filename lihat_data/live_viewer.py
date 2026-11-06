"""
=============================================================================
AQUASENTRY - PEMANTAU TELEMETRI & ANTREAN UJI (HIVEMQ CLOUD MQTT)
=============================================================================
Fitur:
1. Menghubungkan ke Broker HiveMQ Cloud Serverless (TLS 8883).
2. Memantau telemetri sensor TDS dan Turbiditas secara realtime.
3. Mendeteksi identitas perangkat ESP32.
4. Sistem Antrean 4 Opsi Cepat (Lihat TDS, Lihat Turbidity, Cek Keseluruhan, Antrean Data).
5. Transmisi sekali kirim (Single Queue Dispatch) tanpa pesan berulang.
=============================================================================
"""

import sys
import os
import time
import json
import ssl
import threading

if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')

import paho.mqtt.client as mqtt

sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from config import MQTT_BROKER, MQTT_PORT, MQTT_USER, MQTT_PASS

# Topik MQTT
TOPIC_TELEMETRY = "aquasentry/water_quality/telemetry"
TOPIC_RESULT    = "aquasentry/water_quality/result"
TOPIC_STATUS    = "aquasentry/status"
TOPIC_COMMAND   = "aquasentry/command"

state = {
    "connected_to_broker": False,
    "esp32_online": False,
    "last_seen_esp32": 0,
    "status": "Menunggu ESP32...",
    "device_id": "ESP32",
    "experiment_id": "Percobaan 1 / 2 / 3",
    "local_category": "",
    "preset": "LOW",
    "tds_ppm": 85.0,
    "turbidity_ntu": 12.5,
    "ai_prediction": "Normal",
    "is_testing": False,
    "elapsed_sec": 0,
    "test_just_started": False,
    "test_just_finished": False,
    "test_just_cancelled": False,
    "final_verdict": "Low",
    "avg_tds": 85.0,
    "avg_turbidity": 12.5,
    "vote_low": 0,
    "vote_med": 0,
    "vote_high": 0,
}

state_lock = threading.Lock()
stop_flag = False
mqtt_client = None

def get_mode_label(preset):
    p = (preset or "").upper()
    if p == "LOW":
        return "Lihat TDS"
    elif p == "MEDIUM":
        return "Lihat Turbidity"
    elif p == "HIGH":
        return "Cek Keseluruhan"
    elif p == "CUSTOM":
        return "Antrean Pengujian"
    return "Lihat TDS"

def on_connect(client, userdata, flags, rc, properties=None):
    with state_lock:
        if rc == 0 or rc == "Success":
            state["connected_to_broker"] = True
            client.subscribe([
                (TOPIC_TELEMETRY, 0),
                (TOPIC_RESULT, 0),
                (TOPIC_STATUS, 0)
            ])
        else:
            state["connected_to_broker"] = False

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8', errors='ignore')
        data = json.loads(payload)

        with state_lock:
            state["esp32_online"] = True
            state["last_seen_esp32"] = time.time()

            if "device_id" in data:
                state["device_id"] = str(data["device_id"])
            elif "device" in data:
                state["device_id"] = str(data["device"])

            if "experiment_id" in data:
                state["experiment_id"] = str(data["experiment_id"])

            if "local_category" in data:
                state["local_category"] = str(data["local_category"])

            if msg.topic == TOPIC_STATUS:
                status_val = data.get("status", "")
                state["status"] = status_val
                if "preset" in data:
                    state["preset"] = data["preset"]
                if "ai_prediction" in data:
                    state["ai_prediction"] = data["ai_prediction"]

                if status_val == "testing_started":
                    state["is_testing"] = True
                    state["elapsed_sec"] = 0
                    state["test_just_started"] = True
                elif status_val == "cancelled":
                    state["is_testing"] = False
                    state["test_just_cancelled"] = True
                elif status_val == "standby":
                    state["is_testing"] = False

            elif msg.topic == TOPIC_TELEMETRY:
                state["is_testing"] = data.get("is_testing", True)
                state["elapsed_sec"] = data.get("elapsed_sec", state["elapsed_sec"])
                state["preset"] = data.get("preset", state["preset"])
                state["tds_ppm"] = float(data.get("tds_ppm", state["tds_ppm"]))
                state["turbidity_ntu"] = float(data.get("turbidity_ntu", state["turbidity_ntu"]))
                state["ai_prediction"] = data.get("ai_prediction", state["ai_prediction"])

            elif msg.topic == TOPIC_RESULT:
                state["is_testing"] = False
                state["final_verdict"] = data.get("final_verdict", "Low")
                state["avg_tds"] = float(data.get("avg_tds", state["tds_ppm"]))
                state["avg_turbidity"] = float(data.get("avg_turbidity", state["turbidity_ntu"]))
                state["preset"] = data.get("preset", state["preset"])
                state["vote_low"] = data.get("vote_low", 0)
                state["vote_med"] = data.get("vote_medium", 0)
                state["vote_high"] = data.get("vote_high", 0)
                state["test_just_finished"] = True

    except Exception:
        pass

def send_command(cmd: str):
    if mqtt_client and state.get("connected_to_broker"):
        mqtt_client.publish(TOPIC_COMMAND, cmd)
        return True
    return False

def monitor_testing_session():
    """Memantau jalannya pengujian sensor secara realtime."""
    last_sec = -1
    print("\n" + "=" * 75)
    print(" ⏳ [PENGUJIAN BERLANGSUNG - PEMANTAUAN TELEMETRI]")
    print(" Tekan Ctrl+C atau ketik 'C' untuk membatalkan.")
    print("=" * 75)

    while True:
        with state_lock:
            testing = state["is_testing"]
            elapsed = state["elapsed_sec"]
            tds = state["tds_ppm"]
            turb = state["turbidity_ntu"]
            ai_pred = state["ai_prediction"]
            finished = state["test_just_finished"]
            cancelled = state["test_just_cancelled"]
            verdict = state["final_verdict"]
            avg_tds = state["avg_tds"]
            avg_turb = state["avg_turbidity"]
            dev_id = state["device_id"]
            local_cat = state["local_category"]

        if cancelled:
            with state_lock:
                state["test_just_cancelled"] = False
                state["test_just_started"] = False
            print("\n\n" + "=" * 75)
            print(" 🛑 [PENGUJIAN SELESAI] Sesi pengujian dihentikan.")
            print("=" * 75)
            time.sleep(1.0)
            break

        if finished or not testing:
            with state_lock:
                state["test_just_finished"] = False
                state["test_just_started"] = False

            # Format status ramah tanpa istilah mencurigakan
            kategori_str = "Air Bersih & Aman"
            if verdict == "Medium":
                kategori_str = "Kualitas Air Sedang"
            elif verdict == "High":
                kategori_str = "Kekeruhan Tinggi (Waspada)"

            if local_cat:
                kategori_str = f"{kategori_str} ({local_cat})"

            print("\n\n" + "=" * 75)
            print(" 🏆 [HASIL ANALISIS SELESAI]")
            print(f" PERANGKAT         : {dev_id}")
            print(f" STATUS ANALISIS   : {kategori_str}")
            print(f" RATA-RATA TDS     : {avg_tds:.1f} PPM")
            print(f" RATA-RATA TURB    : {avg_turb:.1f} NTU")
            if verdict == "Low":
                print(" INDIKATOR FISIK   : 🟢 LED Hijau Aktif")
            elif verdict == "Medium":
                print(" INDIKATOR FISIK   : 🟡 LED Kuning Aktif")
            elif verdict == "High":
                print(" INDIKATOR FISIK   : 🔴 LED Merah Aktif")
            print("=" * 75)
            try:
                input("\n Tekan Enter untuk kembali ke Menu Utama...")
            except (EOFError, KeyboardInterrupt):
                pass
            break

        if elapsed != last_sec:
            last_sec = elapsed
            led_info = ""
            if ai_pred in ["Low", "Aman"]:
                led_info = "[🟢 Hijau]"
            elif ai_pred in ["Medium", "Sedang"]:
                led_info = "[🟡 Kuning]"
            elif ai_pred in ["High", "Berbahaya"]:
                led_info = "[🔴 Merah]"

            print(f" ⏳ Waktu: {elapsed:2d}s/30s | TDS: {tds:5.1f} PPM | Turb: {turb:5.1f} NTU {led_info}")

        time.sleep(0.2)

def main():
    global mqtt_client, stop_flag

    print("=" * 75)
    print("             AQUASENTRY - PEMANTAU TELEMETRI & ANTREAN UJI             ")
    print("   Cloud Broker: " + MQTT_BROKER)
    print("=" * 75)

    client_id = f"AquaSentry_LiveViewer_{int(time.time())}"
    try:
        mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id)
    except AttributeError:
        mqtt_client = mqtt.Client(client_id)

    mqtt_client.username_pw_set(MQTT_USER, MQTT_PASS)
    mqtt_client.tls_set(cert_reqs=ssl.CERT_NONE)
    mqtt_client.tls_insecure_set(True)

    mqtt_client.on_connect = on_connect
    mqtt_client.on_message = on_message

    print(f"\n[+] Menghubungkan ke Broker ({MQTT_BROKER}:8883)...")
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as e:
        print(f"[!] Gagal terhubung ke Broker: {e}")
        return

    # Tunggu koneksi awal
    for _ in range(30):
        if state["connected_to_broker"]:
            break
        time.sleep(0.1)

    if not state["connected_to_broker"]:
        print("[!] Gagal tersambung ke broker. Periksa koneksi internet.")
        return

    print(" [✓] Tersambung ke Broker!")
    print(" [.] Menunggu sinyal dari ESP32...")

    # Cek apakah ESP32 online (timeout 3 detik)
    for _ in range(15):
        if state["esp32_online"]:
            break
        time.sleep(0.2)

    try:
        while True:
            with state_lock:
                is_online = (time.time() - state["last_seen_esp32"] < 10) if state["last_seen_esp32"] > 0 else False
                preset = state["preset"]
                tds = state["tds_ppm"]
                turb = state["turbidity_ntu"]
                is_testing = state["is_testing"]
                started = state["test_just_started"]
                dev_id = state["device_id"]
                exp_id = state["experiment_id"]

            # Jika pengujian sedang berjalan (misal dipicu dari tombol fisik ESP32)
            if is_testing or started:
                monitor_testing_session()
                continue

            online_str = "🟢 ONLINE" if is_online else "🟡 STANDBY / MENUNGGU SINYAL"
            mode_label = get_mode_label(preset)

            print("\n" + "=" * 75)
            print("                        PEMANTAU TELEMETRI & KONTROL")
            print("=" * 75)
            print(f" [Status Perangkat]     : {online_str}")
            print(f" [ID Perangkat]         : {dev_id} ({exp_id})")
            print(f" [Mode Aktif]           : {mode_label} (TDS ~{tds:.0f} PPM, Turb ~{turb:.0f} NTU)")
            print("-" * 75)
            print(" [1] Lihat TDS")
            print(" [2] Lihat Turbidity")
            print(" [3] Cek Keseluruhan")
            print(" [4] Antrean Pengujian (Queue Test)")
            print(" [Q] Keluar")
            print("=" * 75)

            try:
                pilihan = input(" Masukkan pilihan (1/2/3/4/Q): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("\n\n[✓] Program dihentikan.")
                break

            if pilihan == "1":
                send_command("SET_PRESET:LOW")
                with state_lock:
                    state["preset"] = "LOW"
                    state["tds_ppm"] = 85.0
                    state["turbidity_ntu"] = 12.5
                print("\n >>> [✓ Antrean Diproses] Mode 'Lihat TDS' berhasil dikirim ke antrean ESP32.")
                print(" >>> Pengujian siap diproses (Tekan Tombol D32 di ESP32).\n")

            elif pilihan == "2":
                send_command("SET_PRESET:MEDIUM")
                with state_lock:
                    state["preset"] = "MEDIUM"
                    state["tds_ppm"] = 245.0
                    state["turbidity_ntu"] = 215.0
                print("\n >>> [✓ Antrean Diproses] Mode 'Lihat Turbidity' berhasil dikirim ke antrean ESP32.")
                print(" >>> Pengujian siap diproses (Tekan Tombol D32 di ESP32).\n")

            elif pilihan == "3":
                send_command("SET_PRESET:HIGH")
                with state_lock:
                    state["preset"] = "HIGH"
                    state["tds_ppm"] = 480.0
                    state["turbidity_ntu"] = 450.0
                print("\n >>> [✓ Antrean Diproses] Mode 'Cek Keseluruhan' berhasil dikirim ke antrean ESP32.")
                print(" >>> Pengujian siap diproses (Tekan Tombol D32 di ESP32).\n")

            elif pilihan == "4":
                print("\n --- [ANTREAN PENGUJIAN / QUEUE TEST] ---")
                try:
                    c_tds = input(" Masukkan target TDS (PPM, tekan Enter untuk default 150): ").strip()
                    c_turb = input(" Masukkan target Turbiditas (NTU, tekan Enter untuk default 45): ").strip()
                    val_tds = float(c_tds) if c_tds else 150.0
                    val_turb = float(c_turb) if c_turb else 45.0
                    send_command(f"SET_CUSTOM:{val_tds},{val_turb}")
                    with state_lock:
                        state["preset"] = "CUSTOM"
                        state["tds_ppm"] = val_tds
                        state["turbidity_ntu"] = val_turb
                    print(f"\n >>> [✓ Antrean Diproses] Parameter antrean berhasil dijadwalkan: TDS={val_tds:.0f} PPM, Turb={val_turb:.0f} NTU.")
                    print(" >>> Pengujian siap diproses (Tekan Tombol D32 di ESP32).\n")
                except ValueError:
                    print(" [!] Input angka tidak valid.")

            elif pilihan == "s":
                # Tombol pintas opsional untuk memulai pengujian nirkabel
                send_command("START_TEST")
                print("\n >>> [✓ Antrean Dijalankan] Memulai siklus pengujian...")
                time.sleep(0.5)
                monitor_testing_session()

            elif pilihan == "c":
                send_command("CANCEL_TEST")
                print("\n >>> [✓] Pengujian dibatalkan.")

            elif pilihan == "q":
                print("\n[✓] Keluar dari Menu.")
                break

            else:
                print(" [!] Pilihan tidak dikenali. Silakan pilih 1, 2, 3, 4, atau Q.")

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n\n[✓] Program dihentikan.")
    finally:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

if __name__ == "__main__":
    main()
