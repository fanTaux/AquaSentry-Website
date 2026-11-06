"""
=============================================================================
AQUASENTRY - SISTEM ANTREAN CERDAS & PEMANTAU TELEMETRI (HIVEMQ MQTT)
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
    "queue": [],                  # List of {"id": "1", "name": "...", "preset": "LOW"}
    "currently_running_item": None, # Item yang sedang diuji saat pengujian berjalan
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

def safe_float(val, default=0.0):
    try:
        return float(val) if val is not None else default
    except (ValueError, TypeError):
        return default

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
            # Sinkronkan preset pertama ke ESP32 saat terhubung
            sync_esp32_to_queue_head()
        else:
            state["connected_to_broker"] = False

def on_disconnect(client, userdata, rc, properties=None):
    with state_lock:
        state["connected_to_broker"] = False

def on_message(client, userdata, msg):
    try:
        payload = msg.payload.decode('utf-8', errors='ignore')
        if not payload:
            return
        data = json.loads(payload)
        if not isinstance(data, dict):
            return

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
                    state["test_just_started"] = False
                elif status_val == "standby":
                    state["is_testing"] = False

            elif msg.topic == TOPIC_TELEMETRY:
                # Perbarui data telemetri jika tidak sedang terkunci selesai
                if not state["test_just_finished"]:
                    state["is_testing"] = bool(data.get("is_testing", state["is_testing"]))
                state["preset"] = data.get("preset", state["preset"])
                state["tds_ppm"] = safe_float(data.get("tds_ppm"), state["tds_ppm"])
                state["turbidity_ntu"] = safe_float(data.get("turbidity_ntu"), state["turbidity_ntu"])

            elif msg.topic == TOPIC_RESULT:
                state["is_testing"] = False
                state["final_verdict"] = data.get("final_verdict", "Low")
                state["avg_tds"] = safe_float(data.get("avg_tds"), state["tds_ppm"])
                state["avg_turbidity"] = safe_float(data.get("avg_turbidity"), state["turbidity_ntu"])
                state["test_just_finished"] = True
                state["test_just_started"] = False

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

def sync_esp32_to_queue_head():
    """
    KUNCI UTAMA: Selalu siapkan parameter ESP32 mengikuti TIKET TERDEPAN (Queue Head)
    saat masih di mode Standby. Jadi begitu tombol fisik ditekan, ESP32 sudah PASTI
    mengeksekusi preset yang sesuai, bukan preset lama!
    """
    with state_lock:
        if state["queue"]:
            target_preset = state["queue"][0]["preset"]
        else:
            target_preset = "LOW"
        state["preset"] = target_preset

    send_command(f"SET_PRESET:{target_preset}")

def monitor_testing_session():
    """
    Menjalankan dan memantau sesi pengujian 30 detik dengan pelacak tahap yang jelas.
    """
    with state_lock:
        # Ambil tiket terdepan dari antrean
        if state["queue"]:
            active_item = state["queue"].pop(0)
        else:
            active_item = {"id": "1", "name": "Lihat TDS (Default)", "preset": "LOW"}

        state["currently_running_item"] = active_item
        total_finished = len(state["history_completed"])
        remaining_count = len(state["queue"])
        total_stages = total_finished + 1 + remaining_count
        current_stage = total_finished + 1
        preset_name = active_item["preset"]

    # Pastikan perintah preset terkirim lagi untuk garansi
    send_command(f"SET_PRESET:{preset_name}")

    nama_warna = "🔴 Merah" if preset_name == "HIGH" else ("🟡 Kuning" if preset_name == "MEDIUM" else "🟢 Hijau")

    print("\n" + "=" * 65, flush=True)
    print("           ⏳ PENGUJIAN 30 DETIK SEDANG BERJALAN", flush=True)
    print("=" * 65, flush=True)
    print(f" ▶ Sedang Diuji    : [{active_item['id']}] {active_item['name']} ({preset_name} / {nama_warna})", flush=True)
    print(f" ▶ Tahap Antrean   : Pengujian {current_stage} dari {total_stages}", flush=True)

    with state_lock:
        if state["queue"]:
            next_names = ", ".join([f"[{it['id']}] {it['name']}" for it in state["queue"][:2]])
            if len(state["queue"]) > 2:
                next_names += f", +{len(state['queue']) - 2} lainnya"
            print(f" ▶ Sisa Berikutnya : {next_names}", flush=True)
        else:
            print(" ▶ Sisa Berikutnya : (Ini adalah antrean terakhir)", flush=True)
    print("-" * 65, flush=True)

    last_live_print = 0
    start_time = time.time()

    while True:
        with state_lock:
            testing = state["is_testing"]
            finished = state["test_just_finished"]
            cancelled = state["test_just_cancelled"]
            verdict = state["final_verdict"]
            avg_tds = state["avg_tds"]
            avg_turb = state["avg_turbidity"]
            live_tds = state["tds_ppm"]
            live_turb = state["turbidity_ntu"]
            remaining_q = len(state["queue"])

        # Cetak baris live sensor 1 baris halus tanpa spam baris baru
        now_ts = time.time()
        if now_ts - last_live_print >= 0.5:
            last_live_print = now_ts
            elapsed_sec = int(min(30, now_ts - start_time))
            badge = "🔴" if live_turb > 300 or live_tds > 350 else ("🟡" if live_turb > 100 or live_tds > 180 else "🟢")
            sys.stdout.write(f"\r  ⏳ Berjalan: {elapsed_sec}s/30s | TDS: {live_tds:.1f} PPM | Turb: {live_turb:.1f} NTU [{badge}]   ")
            sys.stdout.flush()

        if cancelled:
            with state_lock:
                state["test_just_cancelled"] = False
                state["test_just_started"] = False
                state["currently_running_item"] = None

            print("\n\n" + "=" * 65, flush=True)
            print(" [PENGUJIAN DIBATALKAN]", flush=True)
            print(" Status kembali ke mode Standby.", flush=True)
            print("=" * 65 + "\n", flush=True)
            sync_esp32_to_queue_head()
            time.sleep(1.0)
            break

        if finished or (not testing and (time.time() - start_time > 3.0)):
            # Simpan item yang sukses ke riwayat selesai
            with state_lock:
                state["history_completed"].append(active_item)
                state["test_just_finished"] = False
                state["test_just_started"] = False
                state["is_testing"] = False
                state["currently_running_item"] = None

            kategori_str = "Air Bersih & Aman (Low Risk)"
            if verdict == "Medium":
                kategori_str = "Kualitas Air Sedang (Medium Risk)"
            elif verdict == "High":
                kategori_str = "Kekeruhan Tinggi / Bahaya (High Risk)"

            print("\n\n" + "=" * 65, flush=True)
            print("                    [✓ HASIL PENGUJIAN SELESAI]", flush=True)
            print("=" * 65, flush=True)
            print(f" Pengujian : [{active_item['id']}] {active_item['name']} (Tahap {current_stage} dari {total_stages})", flush=True)
            print(f" Status    : {kategori_str}", flush=True)
            print(f" Rata TDS  : {avg_tds:.1f} PPM", flush=True)
            print(f" Rata Turb : {avg_turb:.1f} NTU", flush=True)
            print("=" * 65, flush=True)

            # SINKRONKAN LANGSUNG ITEM BERIKUTNYA KE ESP32 SAAT STANDBY
            sync_esp32_to_queue_head()

            if remaining_q == 0:
                print(" >>> [ANTREAN SELESAI] Semua antrean telah habis diproses!", flush=True)
                print(" >>> Sistem otomatis kembali ke kondisi normal (Hijau terus).\n", flush=True)
            else:
                next_item = state["queue"][0]
                print(f" >>> [1 TAHAP SELESAI] Sisa antrean: {remaining_q} pengujian lagi.", flush=True)
                print(f" >>> Alat ESP32 telah disiapkan untuk: [{next_item['id']}] {next_item['name']}.", flush=True)
                print(" >>> Tekan tombol fisik D32 di ESP32 untuk memproses tahap berikutnya.\n", flush=True)

            # Jeda singkat agar pengguna membaca hasil, lalu otomatis kembali ke menu
            print(" (Kembali ke Menu dalam 3 detik atau tekan tombol apa saja)...", flush=True)
            pause_start = time.time()
            while time.time() - pause_start < 3.0:
                if HAS_MSVCRT and msvcrt.kbhit():
                    try:
                        msvcrt.getwch()
                    except Exception:
                        pass
                    break
                time.sleep(0.1)

            # Debounce pengaman agar paket telemetry lama tidak memicu testing ulang
            time.sleep(0.5)
            break

        time.sleep(0.1)

def check_queue_status_action():
    """
    Opsi 4: Langsung menampilkan daftar pilihan sebelumnya (1, 2, 3) yang masih berlaku
    secara transparan beserta tahapannya.
    """
    with state_lock:
        q_list = list(state["queue"])
        history = list(state["history_completed"])

    print("\n" + "=" * 65, flush=True)
    print("                 📋 STATUS ANTREAN SAAT INI", flush=True)
    print("=" * 65, flush=True)

    if q_list:
        print(f" Total Dalam Antrean: {len(q_list)} Pengujian (MASIH BERLAKU):\n", flush=True)
        for idx, item in enumerate(q_list, start=1):
            if idx == 1:
                print(f"   ▶ {idx}. Pilihan [{item['id']}] {item['name']:<18} --> [SIAP DIUJI SEKARANG] (Preset: {item['preset']})", flush=True)
            else:
                print(f"     {idx}. Pilihan [{item['id']}] {item['name']:<18} --> [Antrean ke-{idx}] (Preset: {item['preset']})", flush=True)

        print("\n Keterangan : Alat ESP32 sudah diset untuk Pilihan terdepan di atas.", flush=True)
        print("              Tekan tombol fisik D32 di ESP32 untuk memulai tahap 1.", flush=True)
        print("              Setelah selesai, sistem otomatis menyiapkan tahap berikutnya.", flush=True)
        print("              Setelah semua antrean habis, otomatis kembali ke Hijau terus.", flush=True)
    else:
        print(" Status: Antrean saat ini KOSONG.", flush=True)
        if history:
            last = history[-1]
            print(f" Catatan: Pengujian terakhir [{last['id']}] {last['name']} sudah selesai diproses.", flush=True)
        print(" Keterangan: Sistem berjalan normal (Lihat TDS / Hijau terus).", flush=True)

    print("=" * 65 + "\n", flush=True)

def add_to_queue(choice_id):
    """Menambahkan pilihan 1, 2, atau 3 ke antrean secara tertib."""
    if choice_id == "1":
        item = {"id": "1", "name": "Lihat TDS", "preset": "LOW"}
    elif choice_id == "2":
        item = {"id": "2", "name": "Lihat Turbidity", "preset": "MEDIUM"}
    elif choice_id == "3":
        item = {"id": "3", "name": "Cek Keseluruhan", "preset": "HIGH"}
    else:
        return

    with state_lock:
        state["queue"].append(item)
        total = len(state["queue"])
        head_item = state["queue"][0]

    # Selalu pastikan ESP32 menyiapkan preset tiket TERDEPAN (Queue Head)
    sync_esp32_to_queue_head()

    print(f"\n >>> [✓ MASUK ANTREAN] Pilihan [{item['id']}] {item['name']} berhasil ditambahkan.", flush=True)
    print(f" >>> Total dalam antrean sekarang : {total} pengujian.", flush=True)
    print(f" >>> Siap diuji berikutnya di alat : [{head_item['id']}] {head_item['name']}.\n", flush=True)

def clear_queue_action():
    """Mengosongkan antrean seketika."""
    with state_lock:
        state["queue"].clear()
        state["preset"] = "LOW"
        state["tds_ppm"] = 85.0
        state["turbidity_ntu"] = 12.5
    send_command("SET_PRESET:LOW")
    print("\n >>> [✓ ANTREAN DIKOSONGKAN] Semua antrean telah dibersihkan.", flush=True)
    print(" >>> Sistem kembali ke kondisi normal (Lihat TDS / Hijau terus).\n", flush=True)

def get_nonblocking_choice():
    """
    Membaca input keyboard pengguna secara instan tanpa membuat terminal macet (nyantol)
    serta kebal terhadap crash jika menekan tombol panah / fungsi khusus.
    """
    print(" Masukkan pilihan (1/2/3/4/C/Q): ", end="", flush=True)

    if not HAS_MSVCRT:
        try:
            return input().strip().lower()
        except (EOFError, KeyboardInterrupt):
            return "q"

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

            # Cegah crash akibat tombol khusus Windows (Arrow keys, F1-F12 menghasilkan scan code ganda \x00 atau \xe0)
            if ch in ('\x00', '\xe0'):
                try:
                    if msvcrt.kbhit():
                        msvcrt.getwch() # Bersihkan byte kedua scan code
                except Exception:
                    pass
                continue

            if ch in ('\r', '\n'):
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
                # PROSES INSTAN! Langsung respon seketika
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
    mqtt_client.on_disconnect = on_disconnect
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
                q_len = len(state["queue"])
                head = state["queue"][0] if q_len > 0 else None

            # Jika pengujian sedang berjalan (misal dipicu tombol fisik ESP32)
            if is_testing or started:
                monitor_testing_session()
                continue

            status_str = "Terhubung" if is_online else "Tidak Terhubung"

            print("\n" + "=" * 65, flush=True)
            print("                           AQUASENTRY", flush=True)
            print("=" * 65, flush=True)
            print(f" Status Perangkat : {status_str}", flush=True)
            if head:
                warna_tag = "🔴 Merah" if head['preset'] == "HIGH" else ("🟡 Kuning" if head['preset'] == "MEDIUM" else "🟢 Hijau")
                print(f" Siap Diuji Alat  : ▶ [{head['id']}] {head['name']} ({head['preset']} / {warna_tag})", flush=True)
                print(f" Status Antrean   : Ada {q_len} pengujian dalam antrean", flush=True)
            else:
                print(" Status Antrean   : Kosong (Default: Berjalan Normal / Hijau terus)", flush=True)
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
