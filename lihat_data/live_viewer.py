"""
=============================================================================
AQUASENTRY - SISTEM ANTREAN & PEMANTAU TELEMETRI (HIVEMQ CLOUD MQTT)
=============================================================================
Fitur:
1. Broker HiveMQ Cloud TLS 8883.
2. Menu 4 Opsi Cepat:
   [1] Lihat TDS (Default: Hijau terus)
   [2] Lihat Turbidity (1x Tiket Uji Kuning)
   [3] Cek Keseluruhan (1x Tiket Uji Merah)
   [4] Cek Status Antrean (Lihat apakah pilihan 1/2/3 sebelumnya masih berlaku atau sudah hangus)
3. Sekali Uji (Single-Use Queue): Begitu 1x pengujian 30 detik selesai,
   tiket antrean otomatis hangus dan sistem kembali ke HIJAU secara mandiri.
4. Tampilan proses uji 1 baris (\r in-place) tanpa spam terminal.
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
    "experiment_id": "Percobaan 1",
    "local_category": "",
    # Sistem Tiket Antrean (Single-Use Queue)
    "active_ticket": None,        # None = Tidak ada tiket (Default Hijau terus), "MEDIUM" = Opsi 2, "HIGH" = Opsi 3
    "ticket_used": False,         # Menandai apakah tiket sebelumnya sudah selesai terpakai/hangus
    "last_ticket_name": "Belum ada",
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
mqtt_client = None

def get_ticket_status_text():
    with state_lock:
        ticket = state["active_ticket"]
        used = state["ticket_used"]
        last_name = state["last_ticket_name"]

    if ticket == "MEDIUM":
        return "🟡 MASIH BERLAKU: Tiket [2] Lihat Turbidity (Menunggu 1x Pengujian)"
    elif ticket == "HIGH":
        return "🔴 MASIH BERLAKU: Tiket [3] Cek Keseluruhan (Menunggu 1x Pengujian)"
    elif used:
        return f"🟢 KOSONG (Tiket '{last_name}' sebelumnya sudah selesai dipakai -> Berjalan HIJAU terus)"
    else:
        return "🟢 TIDAK ADA ANTREAN (Default: Berjalan HIJAU terus)"

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
    """
    Memantau jalannya pengujian sensor secara realtime.
    Pembaruan progres tampil di satu baris (\r) rapi tanpa baris baru terus-menerus.
    """
    last_sec = -1
    print("\n" + "=" * 75)
    print(" ⏳ [PENGUJIAN SEDANG BERJALAN - 30 DETIK]")
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
                if state["active_ticket"]:
                    state["last_ticket_name"] = "Lihat Turbidity" if state["active_ticket"] == "MEDIUM" else "Cek Keseluruhan"
                state["active_ticket"] = None
                state["ticket_used"] = True
                state["preset"] = "LOW"
                state["tds_ppm"] = 85.0
                state["turbidity_ntu"] = 12.5

            # Kembalikan ESP32 ke Hijau
            send_command("SET_PRESET:LOW")

            sys.stdout.write("\r" + " " * 75 + "\r")
            print("\n" + "=" * 75)
            print(" 🛑 [PENGUJIAN DIBATALKAN]")
            print(" >>> Tiket antrean dibatalkan. Status otomatis kembali ke HIJAU (Normal).")
            print("=" * 75 + "\n")
            time.sleep(1.0)
            break

        if finished or not testing:
            with state_lock:
                state["test_just_finished"] = False
                state["test_just_started"] = False
                if state["active_ticket"]:
                    state["last_ticket_name"] = "Lihat Turbidity" if state["active_ticket"] == "MEDIUM" else "Cek Keseluruhan"
                state["active_ticket"] = None
                state["ticket_used"] = True
                state["preset"] = "LOW"
                state["tds_ppm"] = 85.0
                state["turbidity_ntu"] = 12.5

            # Konsumsi antrean: Otomatis kirim sinyal kembalikan ESP32 ke HIJAU (Normal)
            send_command("SET_PRESET:LOW")

            kategori_str = "Air Bersih & Aman"
            led_info = "🟢 LED Hijau Aktif"
            if verdict == "Medium":
                kategori_str = "Kualitas Air Sedang"
                led_info = "🟡 LED Kuning Aktif"
            elif verdict == "High":
                kategori_str = "Kekeruhan Tinggi (Waspada)"
                led_info = "🔴 LED Merah Aktif"

            if local_cat:
                kategori_str = f"{kategori_str} ({local_cat})"

            # Bersihkan baris progress
            sys.stdout.write("\r" + " " * 75 + "\r")
            print("\n" + "=" * 75)
            print(" 🏆 [HASIL PENGUJIAN SELESAI]")
            print(f" PERANGKAT         : {dev_id}")
            print(f" STATUS KUALITAS   : {kategori_str}")
            print(f" RATA-RATA TDS     : {avg_tds:.1f} PPM")
            print(f" RATA-RATA TURB    : {avg_turb:.1f} NTU")
            print(f" INDIKATOR LED     : {led_info}")
            print("=" * 75)
            print(" >>> [✓ TIKET ANTREAN SELESAI DIPAKAI]")
            print(" >>> 1x Pengujian selesai diproses. Antrean kini KOSONG.")
            print(" >>> Sistem otomatis kembali ke: HIJAU (Air Bersih / Normal terus).\n")
            try:
                input(" Tekan Enter untuk kembali ke Menu...")
            except (EOFError, KeyboardInterrupt):
                pass
            break

        # Tampilkan 1 baris progress in-place (\r) tanpa baris baru
        if elapsed != last_sec:
            last_sec = elapsed
            pct = max(0, min(20, int((elapsed / 30.0) * 20)))
            bar = "█" * pct + "░" * (20 - pct)
            led_tag = "[🟢 Hijau]"
            if ai_pred in ["Medium", "Sedang"]:
                led_tag = "[🟡 Kuning]"
            elif ai_pred in ["High", "Berbahaya"]:
                led_tag = "[🔴 Merah]"

            # Cetak 1 baris saja di tempat (\r)
            sys.stdout.write(f"\r ⏳ Berjalan: [{bar}] {elapsed:2d}/30s | TDS: {tds:5.1f} PPM | Turb: {turb:5.1f} NTU {led_tag} ")
            sys.stdout.flush()

        time.sleep(0.15)

def check_queue_status_action():
    """
    Opsi 4: Langsung cek apakah pilihan sebelumnya (1/2/3) masih berlaku atau sudah hangus.
    """
    with state_lock:
        ticket = state["active_ticket"]
        used = state["ticket_used"]
        last_name = state["last_ticket_name"]
        curr_preset = state["preset"]
        curr_tds = state["tds_ppm"]
        curr_turb = state["turbidity_ntu"]

    print("\n" + "=" * 75)
    print("                📋 PENGECEKAN STATUS ANTREAN SAAT INI")
    print("=" * 75)

    if ticket == "MEDIUM":
        print(" [STATUS TIKET]   : 🟡 MASIH BERLAKU (AKTIF)")
        print(" [PILIHAN ANDA]   : [2] Lihat Turbidity")
        print(" [KONDISI UJI]    : Sedang menunggu 1x pengujian (TDS ~245 PPM, Turb ~215 NTU)")
        print(" [KETERANGAN]     : Begitu tombol D32 ditekan atau pengujian dimulai,")
        print("                    tiket ini akan dieksekusi 1x selama 30 detik.")
        print("                    Setelah pengujian selesai, status OTOMATIS kembali ke Hijau.")
    elif ticket == "HIGH":
        print(" [STATUS TIKET]   : 🔴 MASIH BERLAKU (AKTIF)")
        print(" [PILIHAN ANDA]   : [3] Cek Keseluruhan")
        print(" [KONDISI UJI]    : Sedang menunggu 1x pengujian (TDS ~480 PPM, Turb ~450 NTU)")
        print(" [KETERANGAN]     : Begitu tombol D32 ditekan atau pengujian dimulai,")
        print("                    tiket ini akan dieksekusi 1x selama 30 detik.")
        print("                    Setelah pengujian selesai, status OTOMATIS kembali ke Hijau.")
    elif used:
        print(" [STATUS TIKET]   : 🟢 SUDAH TIDAK BERLAKU (KOSONG / SUDAH SELESAI DIGUNAKAN)")
        print(f" [RIWAYAT TIKET]  : Tiket sebelumnya '{last_name}' sudah hangus karena uji telah selesai.")
        print(f" [STATUS SAAT INI]: KONDISI DEFAULT (HIJAU TERUS - TDS ~{curr_tds:.0f} PPM, Turb ~{curr_turb:.0f} NTU)")
        print(" [KETERANGAN]     : Selama Anda tidak memilih [2] atau [3], pengujian berikutnya")
        print("                    akan SELALU berjalan pada kondisi HIJAU (Normal / Air Bersih).")
    else:
        print(" [STATUS TIKET]   : 🟢 TIDAK ADA ANTREAN AKTIF (KOSONG)")
        print(" [PILIHAN ANDA]   : [1] Lihat TDS (Default Normal)")
        print(f" [STATUS SAAT INI]: HIJAU TERUS (TDS ~{curr_tds:.0f} PPM, Turb ~{curr_turb:.0f} NTU)")
        print(" [KETERANGAN]     : Pengujian akan selalu menghasilkan status HIJAU (Air Bersih).")

    print("=" * 75 + "\n")

def main():
    global mqtt_client

    print("=" * 75)
    print("             AQUASENTRY - SISTEM ANTREAN & PEMANTAU DATA              ")
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
                is_testing = state["is_testing"]
                started = state["test_just_started"]
                dev_id = state["device_id"]

            # Jika pengujian sedang berjalan (misal dipicu tombol fisik ESP32)
            if is_testing or started:
                monitor_testing_session()
                continue

            online_str = "🟢 ONLINE" if is_online else "🟡 STANDBY / MENUNGGU SINYAL"
            status_antrean = get_ticket_status_text()

            print("\n" + "=" * 75)
            print("                 AQUASENTRY - SISTEM ANTREAN & PEMANTAU DATA")
            print("=" * 75)
            print(f" [Status Perangkat] : {online_str} ({dev_id})")
            print(f" [Status Antrean]   : {status_antrean}")
            print("-" * 75)
            print(" [1] Lihat TDS")
            print(" [2] Lihat Turbidity")
            print(" [3] Cek Keseluruhan")
            print(" [4] Cek Status Antrean (Lihat apakah pilihan sebelumnya masih berlaku)")
            print(" [Q] Keluar")
            print("=" * 75)

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
                # Opsi 1: Mode Normal (Hijau / Air Bersih terus)
                send_command("SET_PRESET:LOW")
                with state_lock:
                    state["active_ticket"] = None
                    state["ticket_used"] = False
                    state["preset"] = "LOW"
                    state["tds_ppm"] = 85.0
                    state["turbidity_ntu"] = 12.5
                print("\n >>> [✓ Pilihan [1] Aktif] Mode 'Lihat TDS' dipilih.")
                print(" >>> Antrean dikosongkan. Pengujian berjalan di kondisi HIJAU (Normal) terus.\n")

            elif pilihan == "2":
                # Opsi 2: Antrekan 1x uji Sedang / Kuning
                send_command("SET_PRESET:MEDIUM")
                with state_lock:
                    state["active_ticket"] = "MEDIUM"
                    state["ticket_used"] = False
                    state["preset"] = "MEDIUM"
                    state["tds_ppm"] = 245.0
                    state["turbidity_ntu"] = 215.0
                print("\n >>> [✓ Pilihan [2] Tercatat] 1x Tiket 'Lihat Turbidity' masuk antrean!")
                print(" >>> Tiket MASIH BERLAKU untuk 1x pengujian.")
                print(" >>> Tekan Tombol D32 di ESP32 (atau ketik 'S') untuk memproses pengujian.")
                print(" >>> Setelah pengujian 30 detik selesai, status akan otomatis kembali ke Hijau.\n")

            elif pilihan == "3":
                # Opsi 3: Antrekan 1x uji Keruh / Merah
                send_command("SET_PRESET:HIGH")
                with state_lock:
                    state["active_ticket"] = "HIGH"
                    state["ticket_used"] = False
                    state["preset"] = "HIGH"
                    state["tds_ppm"] = 480.0
                    state["turbidity_ntu"] = 450.0
                print("\n >>> [✓ Pilihan [3] Tercatat] 1x Tiket 'Cek Keseluruhan' masuk antrean!")
                print(" >>> Tiket MASIH BERLAKU untuk 1x pengujian.")
                print(" >>> Tekan Tombol D32 di ESP32 (atau ketik 'S') untuk memproses pengujian.")
                print(" >>> Setelah pengujian 30 detik selesai, status akan otomatis kembali ke Hijau.\n")

            elif pilihan == "4":
                # Opsi 4: Cek apakah pilihan 1/2/3 sebelumnya masih berlaku atau tidak
                check_queue_status_action()

            elif pilihan == "s":
                # Pintasan opsional menjalankan uji
                send_command("START_TEST")
                print("\n >>> [✓ Memulai Pengujian] Mengirim sinyal mulai uji ke ESP32...")
                time.sleep(0.5)
                monitor_testing_session()

            elif pilihan == "c":
                # Pintasan membatalkan uji
                send_command("CANCEL_TEST")
                send_command("SET_PRESET:LOW")
                with state_lock:
                    state["active_ticket"] = None
                    state["preset"] = "LOW"
                print("\n >>> [✓] Pengujian dibatalkan. Status kembali ke Hijau.")

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
