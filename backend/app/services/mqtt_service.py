import json
import logging
import ssl
import time
import paho.mqtt.client as mqtt

from app.config import (
    MQTT_BROKER,
    MQTT_PORT,
    MQTT_USER,
    MQTT_PASS,
    MQTT_TOPIC_TELEMETRY,
    MQTT_TOPIC_RESULT,
    MQTT_TOPIC_STATUS,
    MQTT_TOPIC_COMMAND,
)
from app.services import telemetry_service, queue_service, wifi_service

logger = logging.getLogger("aquasentry.mqtt")

client: mqtt.Client = None
is_mqtt_connected: bool = False

def on_connect(c, userdata, flags, rc, properties=None):
    global is_mqtt_connected
    rc_code = getattr(rc, "value", rc)
    if rc_code == 0 or str(rc) == "Success":
        is_mqtt_connected = True
        logger.info(f"[MQTT] Terhubung sukses ke HiveMQ Cloud ({MQTT_BROKER}:{MQTT_PORT})")
        print(f"\n[OK MQTT] Backend terhubung ke HiveMQ Cloud Broker ({MQTT_BROKER})!", flush=True)
        c.subscribe("aquasentry/#", 0)
        print("[MQTT SUB] Berhasil subscribe ke topic aquasentry/#", flush=True)
    else:
        is_mqtt_connected = False
        logger.error(f"[MQTT] Gagal konek ke HiveMQ Cloud, kode RC={rc}")
        print(f"[!] Gagal konek ke MQTT HiveMQ, RC={rc}", flush=True)

def on_disconnect(c, userdata, rc, properties=None):
    global is_mqtt_connected
    is_mqtt_connected = False
    logger.warning(f"[MQTT] Terputus dari HiveMQ Cloud, RC={rc}")
    print(f"[MQTT] Terputus dari HiveMQ Cloud, RC={rc}. Paho auto-reconnect aktif...", flush=True)

def on_message(c, userdata, msg):
    topic = msg.topic
    # Abaikan perintah kontrol balik
    if topic == MQTT_TOPIC_COMMAND or topic.endswith("/command"):
        return

    try:
        telemetry_service.last_esp_post_time = time.time()

        payload_str = msg.payload.decode("utf-8")
        data = json.loads(payload_str)

        print(f"[MQTT MSG] {topic}: {payload_str}", flush=True)

        if topic == MQTT_TOPIC_STATUS or topic.endswith("/status"):
            status_val = data.get("status", "online")
            preset_val = data.get("preset")
            ai_pred = data.get("ai_prediction") or data.get("edge_ai_class")
            telemetry_service.update_status(status_val, preset=preset_val, edge_ai_pred=ai_pred)

            config_changed = False
            if "ssid" in data and data["ssid"] and wifi_service.active_wifi_config.get("ssid") != data["ssid"]:
                wifi_service.active_wifi_config["ssid"] = data["ssid"]
                config_changed = True
            if "ip" in data and data["ip"] and wifi_service.active_wifi_config.get("ip") != data["ip"]:
                wifi_service.active_wifi_config["ip"] = data["ip"]
                config_changed = True
            if "rssi" in data and data["rssi"] is not None:
                wifi_service.active_wifi_config["rssi"] = data["rssi"]
            wifi_service.active_wifi_config["status"] = "Terhubung"
            if config_changed:
                wifi_service.save_wifi_config()

        elif topic == MQTT_TOPIC_TELEMETRY or topic.endswith("/telemetry"):
            tds = float(data.get("tds_ppm", data.get("tds_mg_l", 85.0)))
            turb = float(data.get("turbidity_ntu", 15.0))
            is_test = bool(data.get("is_testing", True))
            elapsed_sec = int(data.get("elapsed_sec", data.get("test_elapsed_sec", 0)))
            preset = str(data.get("preset", "LOW"))
            ai_pred = str(data.get("ai_prediction", data.get("edge_ai_class", "Standby")))
            device_id = str(data.get("device", "ESP32_AquaSentry"))

            # LIVE streaming saat uji 30s: update live display
            telemetry_service.record_telemetry(
                tds=tds,
                turb=turb,
                is_test=is_test,
                elapsed_sec=elapsed_sec,
                preset=preset,
                edge_ai_pred=ai_pred,
                device_id=device_id,
                save_to_history=False
            )

        elif topic == MQTT_TOPIC_RESULT or topic.endswith("/result"):
            verdict = str(data.get("final_verdict", "Low"))
            preset = str(data.get("preset", "LOW"))
            vote_low = int(data.get("vote_low", 0))
            vote_med = int(data.get("vote_medium", 0))
            vote_high = int(data.get("vote_high", 0))
            avg_tds = float(data["avg_tds"]) if "avg_tds" in data else 85.0
            avg_turb = float(data["avg_turbidity"]) if "avg_turbidity" in data else 15.0
            test_id = data.get("test_id")
            timestamp_esp = data.get("timestamp_esp")

            print(f"[MQTT RESULT] Menerima hasil pengujian resmi: {verdict} (TDS: {avg_tds}, Turb: {avg_turb})")

            # Uji 30s SELESAI: Simpan TEPAT 1 baris hasil ringkasan ke riwayat
            telemetry_service.update_result(
                verdict=verdict,
                preset=preset,
                vote_low=vote_low,
                vote_med=vote_med,
                vote_high=vote_high,
                avg_tds=avg_tds,
                avg_turb=avg_turb
            )

            # Tambahkan ke Antrean Pending Siap Ditandai ke Peta
            queue_service.add_test_result(
                verdict=verdict,
                avg_tds=avg_tds,
                avg_turb=avg_turb,
                preset=preset,
                test_id=test_id,
                timestamp_esp=timestamp_esp,
                vote_counts={"low": vote_low, "medium": vote_med, "high": vote_high}
            )

    except Exception as e:
        logger.error(f"[MQTT] Error memproses payload pada {topic}: {e}")

def start_mqtt_client():
    global client
    if client is not None:
        return

    try:
        client_id = f"AquaSentry_Backend_{int(time.time())}"
        try:
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2, client_id)
        except AttributeError:
            client = mqtt.Client(client_id)

        client.username_pw_set(MQTT_USER, MQTT_PASS)
        client.tls_set(cert_reqs=ssl.CERT_NONE)
        client.tls_insecure_set(True)

        # Reconnect otomatis bawaan Paho dengan backoff 1-10s
        client.reconnect_delay_set(min_delay=1, max_delay=10)

        client.on_connect = on_connect
        client.on_disconnect = on_disconnect
        client.on_message = on_message

        print(f"[MQTT] Menghubungkan ke HiveMQ Cloud ({MQTT_BROKER}:{MQTT_PORT})...")
        client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
        client.loop_start()
    except Exception as e:
        print(f"[!] Gagal memulai MQTT client: {e}")

def stop_mqtt_client():
    global client
    if client:
        try:
            client.loop_stop()
            client.disconnect()
        except Exception:
            pass
        client = None

def send_command(command: str) -> bool:
    """Kirim perintah ke ESP32 melalui HiveMQ Cloud MQTT."""
    global client, is_mqtt_connected
    if client and is_mqtt_connected:
        try:
            client.publish(MQTT_TOPIC_COMMAND, command)
            print(f"[MQTT SEND] Perintah terkirim ke ESP32: {command}")
            return True
        except Exception as e:
            logger.error(f"[MQTT] Gagal mengirim perintah: {e}")
            return False
    return False
