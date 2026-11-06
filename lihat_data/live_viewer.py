"""
=============================================================================
AQUASENTRY - SISTEM ANTREAN & PEMANTAU TELEMETRI (HIVEMQ CLOUD MQTT)
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
    "active_ticket": None,        # None = Tidak ada tiket (Default Hijau terus), "MEDIUM" = Opsi 2, "HIGH" = Opsi 3
    "ticket_used": False,         # Menandai apakah tiket sebelumnya sudah selesai terpakai/hangus
    "preset": "LOW",
    "tds_ppm": 85.0,
    "turbidity_ntu": 12.5,
    "is_testing": False,
    "test_just_started": False,
    "test_just_finished": False,
    "test_just_cancelled": False,
    "final_verdict": "Low",
    "avg_tds": 85.0,
    "avg_turbidity": 12.5,
}

state_lock = threading.Lock()
mqtt_client = None

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

            if msg.topic == TOPIC_STATUS:
                status_val = data.get("status", "")
                if status_val == "testing_started":
                    state["is_testing"] = True
                    state["test_just_started"] = True
                elif status_val == "cancelled":
                    state["is_testing"] = False
                    state["test_just_cancelled"] = True
                elif status_val == "standby":
                    state["is_testing"] = False

            elif msg.topic == TOPIC_TELEMETRY:
                state["is_testing"] = data.get("is_testing", True)
                state["preset"] = data.get("preset", state["preset"])
                state["tds_ppm"] = float(data.get("tds_ppm", state["tds_ppm"]))
                state["turbidity_ntu"] = float(data.get("turbidity_ntu", state["turbidity_ntu"]))

            elif msg.topic == TOPIC_RESULT:
                state["is_testing"] = False
                state["final_verdict"] = data.get("final_verdict", "Low")
                state["avg_tds"] = float(data.get("avg_tds", state["tds_ppm"]))
                state["avg_turbidity"] = float(data.get("avg_turbidity", state["turbidity_ntu"]))
                state["test_just_finished"] = True

    except Exception:
        pass

def send_command(cmd: str):
    if mqtt_client and state.get("connected_to_broker"):
        mqtt_client.publish(TOPIC_COMMAND, cmd)
        return True
    return False

def monitor_testing_session():
    """
    Menunggu pengujian selesai dengan tenang tanpa baris countdown.
    """
    print("\n" + "=" * 65)
    print(" ⏳ Pengujian sedang berjalan...")
    print("=" * 65)

    while True:
        with state_lock:
            testing = state["is_testing"]
            finished = state["test_just_finished"]
            cancelled = state["test_just_cancelled"]
            verdict = state["final_verdict"]
            avg_tds = state["avg_tds"]
            avg_turb = state["avg_turbidity"]

        if cancelled:
            with state_lock:
                state["test_just_cancelled"] = False
                state["test_just_started"] = False
                state["active_ticket"] = None
                state["ticket_used"] = True
                state["preset"] = "LOW"
                state["tds_ppm"] = 85.0
                state["turbidity_ntu"] = 12.5

            send_command("SET_PRESET:LOW")
            print("\n" + "=" * 65)
            print(" [PENGUJIAN DIBATALKAN]")
            print(" Status kembali ke normal.")
            print("=" * 65 + "\n")
            time.sleep(1.0)
            break

        if finished or not testing:
            with state_lock:
                state["test_just_finished"] = False
                state["test_just_started"] = False
                state["active_ticket"] = None
                state["ticket_used"] = True
                state["preset"] = "LOW"
                state["tds_ppm"] = 85.0
                state["turbidity_ntu"] = 12.5

            # Konsumsi antrean: Otomatis kirim sinyal kembalikan ESP32 ke HIJAU (Normal)
            send_command("SET_PRESET:LOW")

            kategori_str = "Air Bersih & Aman"
            if verdict == "Medium":
                kategori_str = "Kualitas Air Sedang"
            elif verdict == "High":
                kategori_str = "Kekeruhan Tinggi"

            print("\n" + "=" * 65)
            print(" [HASIL PENGUJIAN SELESAI]")
            print(f" Status : {kategori_str}")
            print(f" TDS    : {avg_tds:.1f} PPM")
            print(f" Turb   : {avg_turb:.1f} NTU")
            print("=" * 65 + "\n")
            try:
                input(" Tekan Enter untuk kembali ke Menu...")
            except (EOFError, KeyboardInterrupt):
                pass
            break

        time.sleep(0.3)

def check_queue_status_action():
    """
    Opsi 4: Langsung cek apakah pilihan sebelumnya (1/2/3) masih berlaku atau sudah hangus.
    """
    with state_lock:
        ticket = state["active_ticket"]
        used = state["ticket_used"]

    print("\n" + "-" * 55)
    if ticket == "MEDIUM":
        print(" [STATUS] Pilihan [2] Lihat Turbidity MASIH BERLAKU.")
        print("          Menunggu 1x pengujian diproses.")
    elif ticket == "HIGH":
        print(" [STATUS] Pilihan [3] Cek Keseluruhan MASIH BERLAKU.")
        print("          Menunggu 1x pengujian diproses.")
    elif used:
        print(" [STATUS] Pilihan sebelumnya sudah selesai digunakan.")
        print("          Sistem berjalan normal (Lihat TDS) terus.")
    else:
        print(" [STATUS] Tidak ada antrean aktif.")
        print("          Sistem berjalan normal (Lihat TDS) terus.")
    print("-" * 55 + "\n")

def main():
    global mqtt_client

    print("=" * 65)
    print("                           AQUASENTRY")
    print("=" * 65)

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

    print("[+] Menghubungkan ke sistem...")
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as e:
        print(f"[!] Gagal terhubung: {e}")
        return

    # Tunggu koneksi awal
    for _ in range(30):
        if state["connected_to_broker"]:
            break
        time.sleep(0.1)

    if not state["connected_to_broker"]:
        print("[!] Gagal tersambung. Periksa koneksi internet.")
        return

    # Cek apakah ESP32 online (timeout 3 detik)
    for _ in range(15):
        if state["esp32_online"]:
            break
        time.sleep(0.2)

    try:
        while True:
            with state_lock:
                is_online = (time.time() - state["last_seen_esp32"] < 10) if state["last_seen_esp32"] > 0 else False
                is_testing = state["is_testing"]
                started = state["test_just_started"]

            # Jika pengujian sedang berjalan (misal dipicu tombol fisik ESP32)
            if is_testing or started:
                monitor_testing_session()
                continue

            status_str = "Terhubung" if is_online else "Tidak Terhubung"

            print("\n" + "=" * 65)
            print("                           AQUASENTRY")
            print("=" * 65)
            print(f" Status Perangkat: {status_str}")
            print("-" * 65)
            print(" [1] Lihat TDS")
            print(" [2] Lihat Turbidity")
            print(" [3] Cek Keseluruhan")
            print(" [4] Cek Status Antrean")
            print(" [Q] Keluar")
            print("=" * 65)

            try:
                pilihan = input(" Masukkan pilihan (1/2/3/4/Q): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("\n\n[✓] Program dihentikan.")
                break

            # Jika pengujian mendadak mulai tepat saat user menginput
            with state_lock:
                if state["is_testing"] or state["test_just_started"]:
                    monitor_testing_session()
                    continue

            if pilihan == "1":
                # Opsi 1: Mode Normal (Hijau terus)
                send_command("SET_PRESET:LOW")
                with state_lock:
                    state["active_ticket"] = None
                    state["ticket_used"] = False
                    state["preset"] = "LOW"
                    state["tds_ppm"] = 85.0
                    state["turbidity_ntu"] = 12.5
                print("\n>>> Pilihan [1] Lihat TDS aktif.\n")

            elif pilihan == "2":
                # Opsi 2: Antrekan 1x uji Sedang
                send_command("SET_PRESET:MEDIUM")
                with state_lock:
                    state["active_ticket"] = "MEDIUM"
                    state["ticket_used"] = False
                    state["preset"] = "MEDIUM"
                    state["tds_ppm"] = 245.0
                    state["turbidity_ntu"] = 215.0
                print("\n>>> Pilihan [2] Lihat Turbidity masuk antrean (berlaku untuk 1x pengujian).\n")

            elif pilihan == "3":
                # Opsi 3: Antrekan 1x uji Keruh
                send_command("SET_PRESET:HIGH")
                with state_lock:
                    state["active_ticket"] = "HIGH"
                    state["ticket_used"] = False
                    state["preset"] = "HIGH"
                    state["tds_ppm"] = 480.0
                    state["turbidity_ntu"] = 450.0
                print("\n>>> Pilihan [3] Cek Keseluruhan masuk antrean (berlaku untuk 1x pengujian).\n")

            elif pilihan == "4":
                # Opsi 4: Cek apakah pilihan 1/2/3 sebelumnya masih berlaku atau tidak
                check_queue_status_action()

            elif pilihan == "s":
                send_command("START_TEST")
                time.sleep(0.5)
                monitor_testing_session()

            elif pilihan == "c":
                send_command("CANCEL_TEST")
                send_command("SET_PRESET:LOW")
                with state_lock:
                    state["active_ticket"] = None
                    state["preset"] = "LOW"
                print("\n>>> Pengujian dibatalkan.\n")

            elif pilihan == "q":
                print("\n[✓] Keluar dari Menu.")
                break

            else:
                print(" [!] Pilihan tidak dikenali. Silakan pilih 1, 2, 3, 4, atau Q.")

            time.sleep(0.2)

    except KeyboardInterrupt:
        print("\n\n[✓] Program dihentikan.")
    finally:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

if __name__ == "__main__":
    main()
