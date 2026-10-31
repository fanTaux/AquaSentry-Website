"""
=============================================================================
AQUASENTRY - HIVEMQ CLOUD MQTT LIVE DATA VIEWER
=============================================================================
Tidak memerlukan Wi-Fi yang sama! ESP32 dan Laptop berkomunikasi secara
global melalui HiveMQ Cloud (TLS Port 8883).

Fitur:
1. Hubungkan ke Broker HiveMQ Cloud Serverless (TLS 8883) secara instan.
2. Memilih Opsi Data (Opsi 1, Opsi 2, Opsi 3, Kustom) langsung dari laptop.
3. Mendeteksi trigger pengujian baik dari tombol fisik ESP32 (D32) maupun dari Cloud.
4. Menampilkan hitung mundur 30 detik secara realtime beserta pembacaan sensor.
5. Menampilkan hasil akhir konsensus Edge AI dan rata-rata TDS/Turbiditas 30 detik.
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
    "preset": "LOW",
    "tds_ppm": 0.0,
    "turbidity_ntu": 0.0,
    "ai_prediction": "Standby",
    "is_testing": False,
    "elapsed_sec": 0,
    "test_just_started": False,
    "test_just_finished": False,
    "test_just_cancelled": False,
    "final_verdict": "Low",
    "avg_tds": 0.0,
    "avg_turbidity": 0.0,
    "vote_low": 0,
    "vote_med": 0,
    "vote_high": 0,
}

state_lock = threading.Lock()
stop_flag = False
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
    """Memantau jalannya pengujian 30 detik secara realtime."""
    last_sec = -1
    print("\n" + "=" * 70)
    print(" ⏳ [PENGUJIAN 30 DETIK BERLANGSUNG - LIVE DARI HIVEMQ CLOUD]")
    print(" Tekan Ctrl+C atau ketik 'C' untuk membatalkan pengujian.")
    print("=" * 70)

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
            v_low = state["vote_low"]
            v_med = state["vote_med"]
            v_high = state["vote_high"]

        if cancelled:
            with state_lock:
                state["test_just_cancelled"] = False
                state["test_just_started"] = False
            print("\n\n" + "=" * 70)
            print(" 🛑 [DIBATALKAN] Pengujian 30 detik dibatalkan!")
            print(" Status PCB : LED Hasil Padam & LED Biru (D33) Solid ON.")
            print("=" * 70)
            time.sleep(1.0)
            break

        if finished or not testing:
            with state_lock:
                state["test_just_finished"] = False
                state["test_just_started"] = False

            print("\n\n" + "=" * 70)
            print(" 🏆 [✓ SELESAI!] PENGUJIAN 30 DETIK TELAH TUNTAS!")
            print(f" HASIL AKHIR KONSENSUS : [{verdict.upper()}]")
            print(f" RATA-RATA TDS (30s)   : {avg_tds:.1f} PPM")
            print(f" RATA-RATA TURBIDITAS  : {avg_turb:.1f} NTU")
            print(f" Rincian Voting 5-Detik: Low={v_low} | Med={v_med} | High={v_high}")
            if verdict == "Low":
                print(" Status LED Fisik PCB  : 🟢 LED HIJAU (D25) Menyala 10 Detik (Auto-Off)!")
            elif verdict == "Medium":
                print(" Status LED Fisik PCB  : 🟡 LED KUNING (D22) Menyala 10 Detik (Auto-Off)!")
            elif verdict == "High":
                print(" Status LED Fisik PCB  : 🔴 LED MERAH (D23) Menyala 10 Detik (Auto-Off)!")
            print(" Status LED Status     : 🔵 LED Biru (D33) Kembali Solid ON.")
            print("=" * 70)
            try:
                input("\n Tekan Enter untuk kembali ke Menu Utama...")
            except (EOFError, KeyboardInterrupt):
                pass
            break

        if elapsed != last_sec:
            last_sec = elapsed
            sisa = max(0, 30 - elapsed)
            led_info = ""
            if ai_pred == "Low":
                led_info = "[🟢 LED Hijau]"
            elif ai_pred == "Medium":
                led_info = "[🟡 LED Kuning]"
            elif ai_pred == "High":
                led_info = "[🔴 LED Merah]"

            print(f" ⏳ Waktu: {elapsed:2d}s / 30s (Sisa {sisa:2d}s) | TDS: {tds:5.1f} PPM | Turb: {turb:5.1f} NTU => AI: {ai_pred:<8} {led_info}")

        time.sleep(0.2)

def main():
    global mqtt_client, stop_flag

    print("=" * 75)
    print("      AQUASENTRY - MENU LIHAT DATA & KONTROL (HIVEMQ CLOUD MQTT)      ")
    print("   Cloud Broker: " + MQTT_BROKER)
    print("   Bebas jaringan: Tidak perlu satu Wi-Fi dengan ESP32!")
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

    print(f"\n[+] Menghubungkan ke HiveMQ Cloud ({MQTT_BROKER}:8883)...")
    try:
        mqtt_client.connect(MQTT_BROKER, MQTT_PORT, 60)
        mqtt_client.loop_start()
    except Exception as e:
        print(f"[!] Gagal terhubung ke HiveMQ Cloud: {e}")
        return

    # Tunggu koneksi awal
    for _ in range(30):
        if state["connected_to_broker"]:
            break
        time.sleep(0.1)

    if not state["connected_to_broker"]:
        print("[!] Gagal tersambung ke broker HiveMQ Cloud. Periksa koneksi internet.")
        return

    print(" [✓] Tersambung ke HiveMQ Cloud (TLS 8883)!")
    print(" [.] Menunggu sinyal detak ESP32...")

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

            # Jika pengujian sedang berjalan (misal dipicu dari tombol fisik ESP32)
            if is_testing or started:
                monitor_testing_session()
                continue

            online_str = "🟢 ONLINE" if is_online else "🟡 STANDBY / MENUNGGU SINYAL"

            print("\n" + "=" * 75)
            print("                        MENU LIHAT DATA & KONTROL")
            print("=" * 75)
            print(f" [Status ESP32]         : {online_str}")
            print(f" [Data Terpilih]        : {preset} (TDS ~{tds:.0f} PPM, Turb ~{turb:.0f} NTU)")
            print("-" * 75)
            print(" [1] Opsi 1 (Low)")
            print(" [2] Opsi 2 (Medium)")
            print(" [3] Opsi 3 (High)")
            print(" [4] Opsi 4 (Kustom)            -> Input Nilai TDS & Turbiditas Bebas")
            print(" [R] Reset Sensor               -> Gunakan Pembacaan Sensor Fisik")
            print(" [S] Start Pengujian (30 Detik) -> Mulai Sesi Pengujian")
            print(" [C] Batalkan Pengujian         -> Hentikan Pengujian")
            print(" [W] Buka Web Hotspot Setup     -> Buka Captive Portal Wi-Fi Baru")
            print(" [Q] Keluar")
            print("=" * 75)

            try:
                pilihan = input(" Masukkan pilihan (1/2/3/4/R/S/C/W/Q): ").strip().lower()
            except (EOFError, KeyboardInterrupt):
                print("\n\n[✓] Program dihentikan.")
                break

            if pilihan == "1":
                send_command("SET_PRESET:LOW")
                with state_lock:
                    state["preset"] = "LOW"
                    state["tds_ppm"] = 85.0
                    state["turbidity_ntu"] = 15.0
                print("\n >>> [✓ TERKIRIM] Opsi 1 (Low) dipilih.")
                print(" >>> Tekan Tombol Fisik (D32) di ESP32 atau ketik 'S' untuk mulai uji!")

            elif pilihan == "2":
                send_command("SET_PRESET:MEDIUM")
                with state_lock:
                    state["preset"] = "MEDIUM"
                    state["tds_ppm"] = 245.0
                    state["turbidity_ntu"] = 215.0
                print("\n >>> [✓ TERKIRIM] Opsi 2 (Medium) dipilih.")
                print(" >>> Tekan Tombol Fisik (D32) di ESP32 atau ketik 'S' untuk mulai uji!")

            elif pilihan == "3":
                send_command("SET_PRESET:HIGH")
                with state_lock:
                    state["preset"] = "HIGH"
                    state["tds_ppm"] = 480.0
                    state["turbidity_ntu"] = 450.0
                print("\n >>> [✓ TERKIRIM] Opsi 3 (High) dipilih.")
                print(" >>> Tekan Tombol Fisik (D32) di ESP32 atau ketik 'S' untuk mulai uji!")

            elif pilihan == "4":
                try:
                    c_tds = input(" Masukkan target TDS (PPM, contoh: 120): ").strip()
                    c_turb = input(" Masukkan target Turbiditas (NTU, contoh: 25): ").strip()
                    send_command(f"SET_CUSTOM:{float(c_tds)},{float(c_turb)}")
                    with state_lock:
                        state["preset"] = "CUSTOM"
                        state["tds_ppm"] = float(c_tds)
                        state["turbidity_ntu"] = float(c_turb)
                    print(f"\n >>> [✓ TERKIRIM] Opsi 4 (Kustom) dipilih: TDS={c_tds} PPM, Turb={c_turb} NTU.")
                except ValueError:
                    print(" [!] Input angka tidak valid.")

            elif pilihan == "r":
                send_command("RESET_SENSOR")
                print("\n >>> [✓ TERKIRIM] Beralih ke sensor fisik analog PCB.")

            elif pilihan == "s":
                send_command("START_TEST")
                print("\n >>> [✓ TERKIRIM] Memulai pengujian 30 detik via Cloud...")
                # Tunggu sejenak hingga status testing_started diterima
                time.sleep(0.5)
                monitor_testing_session()

            elif pilihan == "c":
                send_command("CANCEL_TEST")
                print("\n >>> [✓ TERKIRIM] Perintah pembatalan dikirim.")

            elif pilihan == "w":
                send_command("OPEN_PORTAL")
                print("\n >>> [✓ TERKIRIM] Membuka Captive Portal Wi-Fi ESP32.")

            elif pilihan == "q":
                print("\n[✓] Keluar dari Menu Lihat Data.")
                break

            else:
                print(" [!] Pilihan tidak dikenali.")

            time.sleep(0.5)

    except KeyboardInterrupt:
        print("\n\n[✓] Program dihentikan.")
    finally:
        mqtt_client.loop_stop()
        mqtt_client.disconnect()

if __name__ == "__main__":
    main()
