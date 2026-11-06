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

# Mendukung deteksi tombol seketika tanpa perlu Enter di Windows
try:
    import msvcrt
    HAS_MSVCRT = True
except ImportError:
    HAS_MSVCRT = False

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

state_lock = threading.RLock()
mqtt_client = None

def on_connect(client, userdata, flags, rc, properties=None):
    with state_lock:
        rc_code = getattr(rc, "value", rc)
        if rc_code == 0 or str(rc) == "Success":
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
    try:
        if mqtt_client and state.get("connected_to_broker"):
            mqtt_client.publish(TOPIC_COMMAND, cmd, qos=0)
            return True
    except Exception:
        pass
    return False

def monitor_testing_session():
    """
    Menunggu pengujian 30 detik selesai dengan tenang tanpa spam baris.
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

    print("\n" + "=" * 65, flush=True)
    print(" ⏳ Pengujian sedang berjalan...", flush=True)
    print("=" * 65, flush=True)

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
            print("\n" + "=" * 65, flush=True)
            print(" [PENGUJIAN DIBATALKAN]", flush=True)
            print(" Status kembali ke normal.", flush=True)
            print("=" * 65 + "\n", flush=True)
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
                kategori_str = "Kekeruhan Tinggi / Bahaya"

            print("\n" + "=" * 65, flush=True)
            print(" [HASIL PENGUJIAN SELESAI]", flush=True)
            print(f" Status : {kategori_str}", flush=True)
            print(f" TDS    : {avg_tds:.1f} PPM", flush=True)
            print(f" Turb   : {avg_turb:.1f} NTU", flush=True)
            print("=" * 65, flush=True)

            if remaining_q == 0:
                print(" >>> Antrean telah habis digunakan. Sistem kembali ke kondisi normal (Hijau terus).\n", flush=True)
            else:
                print(f" >>> 1 Pengujian selesai. Sisa antrean berikutnya: {remaining_q} pengujian.\n", flush=True)

            # Kembali otomatis atau tekan tombol apa saja
            print(" Tekan tombol apa saja untuk kembali ke Menu...", flush=True)
            wait_start = time.time()
            while time.time() - wait_start < 4.0:
                if HAS_MSVCRT and msvcrt.kbhit():
                    try:
                        msvcrt.getch()
                    except Exception:
                        pass
                    break
                time.sleep(0.1)
            break

        time.sleep(0.3)

def check_queue_status_action():
    """
    Opsi 4: Langsung menampilkan daftar pilihan sebelumnya (1, 2, 3) yang masih berlaku.
    """
    with state_lock:
        q_list = list(state["queue"])
        history = list(state["history_completed"])

    print("\n" + "=" * 65, flush=True)
    print("                 📋 STATUS ANTREAN SAAT INI", flush=True)
    print("=" * 65, flush=True)

    if q_list:
        print(f" Status: Ada {len(q_list)} pengujian dalam antrean (MASIH BERLAKU):\n", flush=True)
        for idx, item in enumerate(q_list, start=1):
            tag = "  --> [AKAN DIUJI BERIKUTNYA]" if idx == 1 else ""
            print(f"   {idx}. Pilihan [{item['id']}] {item['name']}{tag}", flush=True)
        print("\n Keterangan : Tekan tombol fisik D32 di ESP32 untuk memproses.", flush=True)
        print("              Pengujian akan mengeksekusi antrean di atas satu per satu.", flush=True)
        print("              Setelah antrean habis, otomatis kembali ke Hijau terus.", flush=True)
    else:
        print(" Status: Antrean saat ini KOSONG.", flush=True)
        if history:
            last = history[-1]
            print(f" Catatan: Pengujian terakhir [{last['id']}] {last['name']} sudah selesai diproses.", flush=True)
        print(" Keterangan: Sistem berjalan normal (Lihat TDS / Hijau terus).", flush=True)

    print("=" * 65 + "\n", flush=True)

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
        print("\n >>> [✓ MASUK ANTREAN] Pilihan [1] Lihat TDS berhasil ditambahkan.", flush=True)

    elif choice_id == "2":
        item = {"id": "2", "name": "Lihat Turbidity", "preset": "MEDIUM"}
        with state_lock:
            state["queue"].append(item)
            state["preset"] = "MEDIUM"
            state["tds_ppm"] = 245.0
            state["turbidity_ntu"] = 215.0
        send_command("SET_PRESET:MEDIUM")
        print("\n >>> [✓ MASUK ANTREAN] Pilihan [2] Lihat Turbidity berhasil ditambahkan.", flush=True)

    elif choice_id == "3":
        item = {"id": "3", "name": "Cek Keseluruhan", "preset": "HIGH"}
        with state_lock:
            state["queue"].append(item)
            state["preset"] = "HIGH"
            state["tds_ppm"] = 480.0
            state["turbidity_ntu"] = 450.0
        send_command("SET_PRESET:HIGH")
        print("\n >>> [✓ MASUK ANTREAN] Pilihan [3] Cek Keseluruhan berhasil ditambahkan.", flush=True)

    with state_lock:
        total = len(state["queue"])
    print(f" >>> Total dalam antrean sekarang: {total} pengujian (Ketik [4] untuk cek antrean).\n", flush=True)

def clear_queue_action():
    """Mengosongkan antrean seketika."""
    with state_lock:
        state["queue"].clear()
        state["preset"] = "LOW"
        state["tds_ppm"] = 85.0
        state["turbidity_ntu"] = 12.5
    send_command("SET_PRESET:LOW")
    print("\n >>> [✓ ANTREAN DIKOSONGKAN] Semua antrean dibersihkan.", flush=True)
    print(" >>> Sistem kembali ke kondisi normal (Lihat TDS / Hijau terus).\n", flush=True)

def get_nonblocking_choice():
    """
    Membaca input keyboard pengguna secara instan tanpa membuat terminal macet (nyantol).
    Di Windows, menekan tombol 1/2/3/4/C/Q langsung diproses seketika tanpa harus tekan Enter.
    """
    print(" Masukkan pilihan (1/2/3/4/C/Q): ", end="", flush=True)

    if not HAS_MSVCRT:
        # Fallback jika di luar Windows
        try:
            return input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            return "q"

    # Windows non-blocking input loop
    buffer = ""
    while True:
        # Cek apakah pengujian mendadak mulai (misal ditekan dari tombol fisik D32 ESP32)
        with state_lock:
            if state["is_testing"] or state["test_just_started"]:
                print("", flush=True)
                return "__TEST_STARTED__"

        if msvcrt.kbhit():
            try:
                ch = msvcrt.getwch()
            except Exception:
                ch = ""

            if ch in ('\r', '\n'):
                # Pengguna menekan Enter
                print("", flush=True)
                return buffer.strip().lower()
            elif ch == '\x03':  # Ctrl+C
                print("\n", flush=True)
                return "q"
            elif ch in ('\b', '\x08'):  # Backspace
                if len(buffer) > 0:
                    buffer = buffer[:-1]
                    print('\b \b', end='', flush=True)
            elif ch.lower() in ('1', '2', '3', '4', 'c', 'q', 's'):
                # PROSES INSTAN! Langsung respon tanpa perlu Enter!
                print(ch, flush=True)
                return ch.lower()
            elif ch.isprintable():
                buffer += ch
                print(ch, end='', flush=True)

        time.sleep(0.05)

def main():
    global mqtt_client

    print("=" * 65, flush=True)
    print("                           AQUASENTRY", flush=True)
    print("=" * 65, flush=True)

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

    print("[+] Menghubungkan ke sistem...", flush=True)
    for attempt in range(1, 6):
        try:
            mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
            mqtt_client.loop_start()
            break
        except Exception as e:
            if attempt < 5:
                print(f" [.] Menunggu koneksi internet/DNS (percobaan {attempt}/5)...", flush=True)
                time.sleep(2)
            else:
                print(f"\n[!] Gagal terhubung: {e}", flush=True)
                print(" [!] Pastikan laptop terhubung ke Wi-Fi dengan koneksi internet aktif.", flush=True)
                return

    # Tunggu koneksi broker awal
    for _ in range(30):
        if state["connected_to_broker"]:
            break
        time.sleep(0.1)

    if not state["connected_to_broker"]:
        print("[!] Gagal tersambung ke broker. Periksa koneksi internet.", flush=True)
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

            print("\n" + "=" * 65, flush=True)
            print("                           AQUASENTRY", flush=True)
            print("=" * 65, flush=True)
            print(f" Status Perangkat: {status_str}", flush=True)
            print("-" * 65, flush=True)
            print(" [1] Lihat TDS", flush=True)
            print(" [2] Lihat Turbidity", flush=True)
            print(" [3] Cek Keseluruhan", flush=True)
            print(" [4] Cek Status Antrean", flush=True)
            print(" [C] Kosongkan Antrean", flush=True)
            print(" [Q] Keluar", flush=True)
            print("=" * 65, flush=True)

            try:
                cmd = get_nonblocking_choice()
            except (EOFError, KeyboardInterrupt):
                print("\n\n[✓] Program dihentikan.", flush=True)
                break

            if cmd == "__TEST_STARTED__":
                monitor_testing_session()
                continue

            if not cmd:
                continue

            if cmd == "4":
                check_queue_status_action()
            elif cmd == "c":
                clear_queue_action()
            elif cmd == "s":
                send_command("START_TEST")
                time.sleep(0.5)
                monitor_testing_session()
            elif cmd == "q":
                print("\n[✓] Keluar dari Menu.", flush=True)
                break
            elif cmd in ["1", "2", "3"]:
                add_to_queue(cmd)
            else:
                print(" [!] Pilihan tidak dikenali. Silakan pilih 1, 2, 3, 4, C, atau Q.", flush=True)

            time.sleep(0.2)

    except KeyboardInterrupt:
        print("\n\n[✓] Program dihentikan.", flush=True)
    finally:
        try:
            mqtt_client.loop_stop()
            mqtt_client.disconnect()
        except Exception:
            pass

if __name__ == "__main__":
    main()
