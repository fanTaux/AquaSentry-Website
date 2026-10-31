import time
from fastapi import APIRouter
from app.models.schemas import TelemetryInput
from app.services import telemetry_service

router = APIRouter(prefix="/api/telemetry", tags=["Telemetry"])

@router.get("/latest")
def get_latest_telemetry():
    last_post = telemetry_service.last_esp_post_time
    # Jika dalam 15 detik terakhir ada pesan dari ESP32 (MQTT heartbeat tiap 3s atau telemetry tiap 1s)
    is_esp_online = (time.time() - last_post) <= 15.0 if last_post > 0 else False

    history = telemetry_service.get_history()
    latest_data = history[-1] if history else telemetry_service.current_telemetry

    return {
        "ok": True,
        "is_esp_online": is_esp_online,
        "device_status": telemetry_service.device_status if is_esp_online else "offline",
        "last_seen_seconds_ago": round(time.time() - last_post, 1) if last_post > 0 else None,
        "is_testing": telemetry_service.is_testing,
        "test_elapsed_sec": telemetry_service.test_elapsed_sec,
        "preset": telemetry_service.active_preset,
        "ai_prediction": telemetry_service.ai_prediction,
        "final_verdict": telemetry_service.final_verdict,
        "vote_counts": telemetry_service.vote_counts,
        "history_count": len(history),
        "data": latest_data
    }

@router.get("/history")
def get_telemetry_history(limit: int = 50):
    hist = telemetry_service.get_history(limit)
    return {
        "ok": True,
        "total": len(hist),
        "data": hist
    }

@router.delete("/history")
def clear_telemetry_history():
    telemetry_service.clear_all_telemetry()
    return {
        "ok": True,
        "message": "Riwayat telemetri berhasil dikosongkan."
    }

@router.post("")
def process_telemetry(input_data: TelemetryInput):
    tds = input_data.tds_ppm if input_data.tds_ppm is not None else (input_data.tds_mg_l or 0.0)
    turb = input_data.turbidity_ntu

    reading_entry = telemetry_service.record_telemetry(
        tds=tds,
        turb=turb,
        is_test=input_data.is_testing or False,
        elapsed_sec=input_data.test_elapsed_sec or 0,
        preset=input_data.preset or "LOW",
        edge_ai_pred=input_data.edge_ai_prediction,
        device_id=input_data.device_id or "ESP32_AquaSentry"
    )

    return {
        "ok": True,
        "message": "Telemetry received and evaluated with Machine Learning model",
        "result": reading_entry
    }
