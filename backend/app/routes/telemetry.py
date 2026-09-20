import time
from fastapi import APIRouter
from app.config import MAX_HISTORY_SIZE
from app.models.schemas import TelemetryInput
from app.services import telemetry_service

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])

@router.get("/latest")
def get_latest_telemetry():
    last_post = telemetry_service.last_esp_post_time
    is_esp_online = (time.time() - last_post) <= 6.0 if last_post > 0 else False
    return {
        "ok": True,
        "is_esp_online": is_esp_online,
        "last_seen_seconds_ago": round(time.time() - last_post, 1) if last_post > 0 else None,
        "data": telemetry_service.telemetry_history[-1] if telemetry_service.telemetry_history else telemetry_service.current_telemetry
    }

@router.get("/history")
def get_telemetry_history(limit: int = 50):
    return {
        "ok": True,
        "total": len(telemetry_service.telemetry_history),
        "data": telemetry_service.telemetry_history[-limit:]
    }

@router.post("")
def process_telemetry(input_data: TelemetryInput):
    telemetry_service.last_esp_post_time = time.time()

    reading_entry = telemetry_service.create_telemetry_entry(
        input_data.tds_mg_l,
        input_data.turbidity_ntu,
        input_data.source or "Sumber Air A",
        input_data.location or "Sumber Air A",
        input_data.device_id or "aquasentry-esp32-01"
    )

    telemetry_service.current_telemetry = reading_entry
    telemetry_service.telemetry_history.append(reading_entry)

    if len(telemetry_service.telemetry_history) > MAX_HISTORY_SIZE:
        telemetry_service.telemetry_history.pop(0)

    return {
        "ok": True,
        "message": "Telemetry received and evaluated with Machine Learning model",
        "result": reading_entry
    }
