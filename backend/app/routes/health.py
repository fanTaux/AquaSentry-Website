import time
from datetime import datetime
from fastapi import APIRouter, HTTPException
from app.config import sentry
from app.models.schemas import LoginInput
from app.services import telemetry_service

router = APIRouter()

@router.get("/")
@router.get("/api/health")
def health_check():
    last_post = telemetry_service.last_esp_post_time
    is_esp_online = (time.time() - last_post) <= 6.0 if last_post > 0 else False
    return {
        "status": "online",
        "service": "AquaSentry API Backend",
        "model_loaded": sentry.model is not None,
        "is_esp_online": is_esp_online,
        "last_esp_post_seconds_ago": round(time.time() - last_post, 1) if last_post > 0 else None,
        "timestamp": datetime.now().isoformat()
    }

@router.post("/api/auth/login")
def login(data: LoginInput):
    if not data.username:
        raise HTTPException(status_code=400, detail="Username wajib diisi")

    return {
        "ok": True,
        "token": f"aquasentry-token-{int(time.time())}",
        "user": {
            "name": data.username,
            "role": "field_worker",
            "access_level": "operator"
        }
    }
