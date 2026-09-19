from fastapi import APIRouter, HTTPException
from app.models.schemas import WifiConfigInput
from app.services import wifi_service

router = APIRouter(prefix="/api/wifi", tags=["WiFi"])

@router.get("/scan")
def scan_wifi_endpoint():
    networks = wifi_service.scan_real_wifi_networks()
    return {
        "ok": True,
        "total": len(networks),
        "data": networks
    }

@router.get("/config")
def get_wifi_config():
    return {
        "ok": True,
        "data": wifi_service.active_wifi_config
    }

@router.post("/config")
def update_wifi_config(config: WifiConfigInput):
    if not config.ssid:
        raise HTTPException(status_code=400, detail="SSID Wi-Fi tidak boleh kosong")

    wifi_service.active_wifi_config["ssid"] = config.ssid
    wifi_service.active_wifi_config["status"] = "Terhubung"
    wifi_service.active_wifi_config["ip"] = "192.168.1.105"

    return {
        "ok": True,
        "message": f"Konfigurasi Wi-Fi baru '{config.ssid}' berhasil diperbarui ke ESP32",
        "data": wifi_service.active_wifi_config
    }
