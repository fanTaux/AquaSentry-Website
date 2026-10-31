import json
import logging
import socket
import threading
import time
from app import config
from app.services import telemetry_service

logger = logging.getLogger("aquasentry.tcp")

client_socket: socket.socket = None
is_tcp_connected: bool = False
_thread: threading.Thread = None
_stop_requested: bool = False

def find_esp_ip():
    """Mencoba IP tersimpan di config, dan bila gagal memindai kandidat di subnet lokal."""
    primary_ip = getattr(config, "ESP_IP", "192.168.1.27")
    port = getattr(config, "ESP_PORT", 8080)

    # 1. Coba primary IP dulu
    candidates = [primary_ip, "192.168.137.208", "192.168.1.27", "192.168.1.9", "192.168.4.1"]
    for ip in candidates:
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(0.4)
            s.connect((ip, port))
            s.close()
            config.ESP_IP = ip
            return ip
        except Exception:
            pass

    return primary_ip

def run_tcp_loop():
    global client_socket, is_tcp_connected, _stop_requested

    while not _stop_requested:
        esp_ip = find_esp_ip()
        esp_port = getattr(config, "ESP_PORT", 8080)

        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.settimeout(2.0)
            s.connect((esp_ip, esp_port))
            s.settimeout(1.0)
            client_socket = s
            is_tcp_connected = True
            logger.info(f"[TCP] Terhubung ke ESP32 di {esp_ip}:{esp_port}")
            print(f"[OK TCP] Backend terhubung langsung ke ESP32 ({esp_ip}:{esp_port})!")

            buffer = ""
            while not _stop_requested and is_tcp_connected:
                try:
                    data = client_socket.recv(1024).decode("utf-8", errors="ignore")
                    if not data:
                        is_tcp_connected = False
                        break

                    buffer += data
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line:
                            continue

                        try:
                            payload = json.loads(line)
                            is_testing = bool(payload.get("is_testing", False))
                            preset = payload.get("preset", "LOW")
                            edge_ai_class = payload.get("edge_ai_class", "Standby")

                            if is_testing and "tds_ppm" in payload:
                                tds = float(payload.get("tds_ppm", 85.0))
                                turb = float(payload.get("turbidity_ntu", 15.0))
                                elapsed = int(payload.get("test_elapsed_sec", 0))

                                telemetry_service.record_telemetry(
                                    tds=tds,
                                    turb=turb,
                                    is_test=True,
                                    elapsed_sec=elapsed,
                                    preset=preset,
                                    edge_ai_pred=edge_ai_class,
                                    device_id="ESP32_AquaSentry_TCP"
                                )
                            else:
                                if payload.get("cancelled", False):
                                    telemetry_service.update_status("cancelled")
                                else:
                                    telemetry_service.update_status("standby", preset=preset, edge_ai_pred=edge_ai_class)

                        except json.JSONDecodeError:
                            continue

                except socket.timeout:
                    continue
                except Exception:
                    is_tcp_connected = False
                    break

        except Exception:
            is_tcp_connected = False
            time.sleep(3)

def start_tcp_client():
    global _thread, _stop_requested
    if _thread and _thread.is_alive():
        return

    _stop_requested = False
    _thread = threading.Thread(target=run_tcp_loop, daemon=True, name="AquaSentry-TCP-Worker")
    _thread.start()

def stop_tcp_client():
    global _stop_requested, client_socket, is_tcp_connected
    _stop_requested = True
    is_tcp_connected = False
    if client_socket:
        try:
            client_socket.close()
        except Exception:
            pass

def send_command(command: str) -> bool:
    global client_socket, is_tcp_connected
    if client_socket and is_tcp_connected:
        try:
            client_socket.sendall(f"{command}\n".encode("utf-8"))
            print(f"[TCP SEND] Perintah terkirim ke ESP32: {command}")
            return True
        except Exception:
            is_tcp_connected = False
            return False
    return False
