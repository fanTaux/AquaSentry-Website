from fastapi import APIRouter, HTTPException
from app.models.schemas import WifiConfigInput
from app.services import wifi_service, mqtt_service, tcp_service

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
@router.post("/connect")
def update_wifi_config(config: WifiConfigInput):
    if not config.ssid:
        raise HTTPException(status_code=400, detail="SSID Wi-Fi tidak boleh kosong")

    wifi_service.active_wifi_config["ssid"] = config.ssid
    wifi_service.active_wifi_config["status"] = "Terhubung"
    wifi_service.save_wifi_config()

    # Jika ESP32 terhubung, kita dapat memicu OPEN_PORTAL agar user bisa menyambung
    # atau kirim perintah update
    mqtt_service.send_command(f"SET_WIFI:{config.ssid},{config.password or ''}")
    tcp_service.send_command(f"SET_WIFI:{config.ssid},{config.password or ''}")

    return {
        "ok": True,
        "message": f"Konfigurasi Wi-Fi baru '{config.ssid}' berhasil diperbarui ke ESP32",
        "data": wifi_service.active_wifi_config
    }

@router.post("/open-portal")
def trigger_open_portal():
    mqtt_service.send_command("OPEN_PORTAL")
    tcp_service.send_command("OPEN_PORTAL")
    return {
        "ok": True,
        "message": "Perintah OPEN_PORTAL terkirim. Hotspot AP 'ESP32_WaterAI' (password: 12345678) diaktifkan pada ESP32."
    }
