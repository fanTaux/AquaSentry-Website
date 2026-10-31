import time
from fastapi import APIRouter, HTTPException
from app.models.schemas import EspCommandInput
from app.services import mqtt_service, tcp_service, telemetry_service

router = APIRouter(prefix="/api/esp", tags=["ESP Control"])

@router.get("/status")
def get_esp_control_status():
    last_post = telemetry_service.last_esp_post_time
    is_esp_online = (time.time() - last_post) <= 15.0 if last_post > 0 else False

    return {
        "ok": True,
        "is_esp_online": is_esp_online,
        "mqtt_connected": mqtt_service.is_mqtt_connected,
        "tcp_connected": tcp_service.is_tcp_connected,
        "device_status": telemetry_service.device_status if is_esp_online else "offline",
        "is_testing": telemetry_service.is_testing,
        "test_elapsed_sec": telemetry_service.test_elapsed_sec,
        "active_preset": telemetry_service.active_preset,
        "ai_prediction": telemetry_service.ai_prediction,
        "final_verdict": telemetry_service.final_verdict,
        "vote_counts": telemetry_service.vote_counts
    }

@router.post("/command")
def send_esp_command(cmd_input: EspCommandInput):
    cmd = cmd_input.command.strip().upper()
    esp_msg = cmd

    if cmd == "START_TEST":
        esp_msg = "START_TEST"
        telemetry_service.update_status("testing_started")
    elif cmd == "CANCEL_TEST":
        esp_msg = "CANCEL_TEST"
        telemetry_service.update_status("cancelled")
    elif cmd in ["SET_PRESET", "PRESET"]:
        target_preset = (cmd_input.preset or "LOW").upper()
        if target_preset == "HARDWARE":
            esp_msg = "RESET_SENSOR"
            telemetry_service.active_preset = "HARDWARE"
        else:
            esp_msg = f"SET_PRESET:{target_preset}"
            telemetry_service.active_preset = target_preset
    elif cmd == "RESET_SENSOR":
        esp_msg = "RESET_SENSOR"
        telemetry_service.active_preset = "HARDWARE"
    elif cmd == "SET_CUSTOM":
        tds = cmd_input.tds or 100.0
        turb = cmd_input.turbidity or 10.0
        esp_msg = f"SET_CUSTOM:{tds:.1f},{turb:.1f}"
        telemetry_service.active_preset = "CUSTOM"
    elif cmd == "OPEN_PORTAL":
        esp_msg = "OPEN_PORTAL"

    # Kirimkan perintah melalui MQTT dan TCP (dual-channel transmission)
    sent_mqtt = mqtt_service.send_command(esp_msg)
    sent_tcp = tcp_service.send_command(esp_msg)

    success = sent_mqtt or sent_tcp

    return {
        "ok": True,
        "dispatched_command": esp_msg,
        "channels": {
            "mqtt_hivemq": sent_mqtt,
            "tcp_lan": sent_tcp
        },
        "message": f"Perintah '{esp_msg}' telah dikirim ke ESP32" if success else f"Perintah '{esp_msg}' di-enqueue (ESP32 belum terhubung ke Cloud/TCP)",
        "current_state": {
            "is_testing": telemetry_service.is_testing,
            "active_preset": telemetry_service.active_preset
        }
    }
