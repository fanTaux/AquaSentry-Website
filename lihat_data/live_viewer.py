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
    # DAFTAR ANTREAN PENGUJIAN (FIFO QUEUE)
    "queue": [],                  # List of {"id": "1", "name": "Lihat TDS", "preset": "LOW"}
    "history_completed": [],      # List pengujian yang sudah selesai
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
                state["is_testing"] = data.get("is_testing", state["is_testing"])
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
    Menunggu pengujian 30 detik selesai dengan tenang tanpa baris countdown.
    """
    # Ambil tiket terdepan dari antrean (jika ada)
    active_item = None
    with state_lock:
        if state["queue"]:
            active_item = state["queue"].pop(0)
            state["history_completed"].append(active_item)
            state["preset"] = active_item["preset"]

    # Pastikan parameter preset terkirim ke ESP32
    if active_item:
        send_command(f"SET_PRESET:{active_item['preset']}")

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
            remaining_q = len(state["queue"])

        if cancelled:
            with state_lock:
                state["test_just_cancelled"] = False
                state["test_just_started"] = False
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

                # Jika antrean sudah habis, otomatis kembali ke LOW (Hijau)
                if not state["queue"]:
                    state["preset"] = "LOW"
                    state["tds_ppm"] = 85.0
                    state["turbidity_ntu"] = 12.5
                    send_command("SET_PRESET:LOW")
                else:
                    # Siapkan item berikutnya
                    next_item = state["queue"][0]
                    state["preset"] = next_item["preset"]
                    send_command(f"SET_PRESET:{next_item['preset']}")

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
            print("=" * 65)

            if remaining_q == 0:
                print(" >>> Antrean telah habis digunakan. Sistem kembali ke kondisi normal (Hijau terus).\n")
            else:
                print(f" >>> 1 Pengujian selesai. Sisa antrean berikutnya: {remaining_q} pengujian.\n")

            try:
                input(" Tekan Enter untuk kembali ke Menu...")
            except (EOFError, KeyboardInterrupt):
                pass
            break

        time.sleep(0.3)

def check_queue_status_action():
    """
    Opsi 4: Langsung menampilkan daftar pilihan sebelumnya (1, 2, 3) yang masih berlaku.
    """
    with state_lock:
        q_list = list(state["queue"])
        history = list(state["history_completed"])

    print("\n" + "=" * 65)
    print("                 📋 STATUS ANTREAN SAAT INI")
    print("=" * 65)

    if q_list:
        print(f" Status: Ada {len(q_list)} pengujian dalam antrean (MASIH BERLAKU):\n")
        for idx, item in enumerate(q_list, start=1):
            tag = "  --> [AKAN DIUJI BERIKUTNYA]" if idx == 1 else ""
            print(f"   {idx}. Pilihan [{item['id']}] {item['name']}{tag}")
        print("\n Keterangan : Tekan tombol fisik D32 di ESP32 untuk memproses.")
        print("              Pengujian akan mengeksekusi antrean di atas secara berurutan.")
        print("              Setelah antrean habis, otomatis kembali ke Hijau terus.")
    else:
        print(" Status: Antrean saat ini KOSONG.")
        if history:
            last = history[-1]
            print(f" Catatan: Pengujian terakhir [{last['id']}] {last['name']} sudah selesai diproses.")
        print(" Keterangan: Sistem berjalan normal (Lihat TDS / Hijau terus).")

    print("=" * 65 + "\n")

def add_to_queue(choice_id):
    """Menambahkan pilihan 1, 2, atau 3 ke antrean."""
    if choice_id == "1":
        item = {"id": "1", "name": "Lihat TDS", "preset": "LOW"}
        with state_lock:
            state["queue"].append(item)
            state["preset"] = "LOW"
            state["tds_ppm"] = 85.0
            state["turbidity_ntu"] = 12.5
        send_command("SET_PRESET:LOW")
        print("\n >>> [✓ MASUK ANTREAN] Pilihan [1] Lihat TDS berhasil ditambahkan ke antrean.")

    elif choice_id == "2":
        item = {"id": "2", "name": "Lihat Turbidity", "preset": "MEDIUM"}
        with state_lock:
            state["queue"].append(item)
            state["preset"] = "MEDIUM"
            state["tds_ppm"] = 245.0
            state["turbidity_ntu"] = 215.0
        send_command("SET_PRESET:MEDIUM")
        print("\n >>> [✓ MASUK ANTREAN] Pilihan [2] Lihat Turbidity berhasil ditambahkan ke antrean.")

    elif choice_id == "3":
        item = {"id": "3", "name": "Cek Keseluruhan", "preset": "HIGH"}
        with state_lock:
            state["queue"].append(item)
            state["preset"] = "HIGH"
            state["tds_ppm"] = 480.0
            state["turbidity_ntu"] = 450.0
        send_command("SET_PRESET:HIGH")
        print("\n >>> [✓ MASUK ANTREAN] Pilihan [3] Cek Keseluruhan berhasil ditambahkan ke antrean.")

    with state_lock:
        total = len(state["queue"])
    print(f" >>> Total dalam antrean sekarang: {total} pengujian (Ketik [4] untuk cek detail antrean).\n")

def clear_queue_action():
    """Mengosongkan antrean seketika."""
    with state_lock:
        state["queue"].clear()
        state["preset"] = "LOW"
        state["tds_ppm"] = 85.0
        state["turbidity_ntu"] = 12.5
    send_command("SET_PRESET:LOW")
    print("\n >>> [✓ ANTREAN DIKOSONGKAN] Semua antrean dibersihkan.")
    print(" >>> Sistem kembali ke kondisi normal (Lihat TDS / Hijau terus).\n")

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
    for attempt in range(1, 6):
        try:
            mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
            mqtt_client.loop_start()
            break
        except Exception as e:
            if attempt < 5:
                print(f" [.] Menunggu koneksi internet/DNS (percobaan {attempt}/5)...")
                time.sleep(2)
            else:
                print(f"\n[!] Gagal terhubung: {e}")
                print(" [!] Pastikan laptop terhubung ke Wi-Fi dengan koneksi internet aktif.")
                return

    # Tunggu koneksi broker awal
    for _ in range(30):
        if state["connected_to_broker"]:
            break
        time.sleep(0.1)

    if not state["connected_to_broker"]:
        print("[!] Gagal tersambung ke broker. Periksa koneksi internet.")
        return

    # Cek sinyal ESP32
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
            print(" [C] Kosongkan Antrean")
            print(" [Q] Keluar")
            print("=" * 65)

            try:
                pilihan_raw = input(" Masukkan pilihan (1/2/3/4/C/Q): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("\n\n[✓] Program dihentikan.")
                break

            # Jika pengujian mendadak mulai tepat saat user menginput
            with state_lock:
                if state["is_testing"] or state["test_just_started"]:
                    monitor_testing_session()
                    continue

            # Pisahkan input jika user mengetik kombinasi (misal: "1 2" atau "2 3")
            tokens = pilihan_raw.replace(",", " ").split()
            if not tokens:
                continue

            # Jika input berisi perintah kontrol khusus
            if len(tokens) == 1:
                cmd = tokens[0]
                if cmd == "4":
                    check_queue_status_action()
                    continue
                elif cmd == "c":
                    clear_queue_action()
                    continue
                elif cmd == "s":
                    send_command("START_TEST")
                    time.sleep(0.5)
                    monitor_testing_session()
                    continue
                elif cmd == "q":
                    print("\n[✓] Keluar dari Menu.")
                    break

            # Proses setiap angka pilihan (1, 2, atau 3) yang dimasukkan user
            valid_found = False
            for token in tokens:
                if token in ["1", "2", "3"]:
                    add_to_queue(token)
                    valid_found = True

            if not valid_found and len(tokens) == 1 and tokens[0] not in ["4", "c", "s", "q"]:
                print(" [!] Pilihan tidak dikenali. Silakan pilih 1, 2, 3, 4, C, atau Q.")

            time.sleep(0.2)

    except KeyboardInterrupt:
        print("\n\n[✓] Program dihentikan.")
    finally:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

if __name__ == "__main__":
    main()
