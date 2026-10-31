from typing import Optional
from pydantic import BaseModel

class TelemetryInput(BaseModel):
    device_id: Optional[str] = "ESP32_AquaSentry"
    tds_mg_l: Optional[float] = None
    tds_ppm: Optional[float] = None
    turbidity_ntu: float
    edge_ai_prediction: Optional[str] = None
    ari: Optional[float] = None
    ass_score: Optional[float] = None
    source: Optional[str] = "Sumber Air A"
    location: Optional[str] = "Sumber Air A"
    is_testing: Optional[bool] = False
    test_elapsed_sec: Optional[int] = 0
    preset: Optional[str] = "LOW"

class EspCommandInput(BaseModel):
    command: str  # START_TEST, CANCEL_TEST, SET_PRESET, RESET_SENSOR, OPEN_PORTAL
    preset: Optional[str] = None  # LOW, MEDIUM, HIGH, HARDWARE
    tds: Optional[float] = None
    turbidity: Optional[float] = None

class LocationInput(BaseModel):
    id: Optional[str] = None
    name: str
    keterangan: Optional[str] = None
    lat: float
    lng: float
    tds: float
    turbidity: float
    assScore: Optional[float] = 85.0
    category: Optional[str] = "Sangat Rendah (Aman)"
    riskLevel: Optional[str] = "low"
    timestamp: Optional[str] = "Baru saja"
    timestamp_esp: Optional[str] = None
    test_id: Optional[str] = None
    method: Optional[str] = "GPS Hotspot (Auto-Detect)"
    device: Optional[str] = "ESP32_AquaSentry"
    advice: Optional[str] = "Air aman digunakan."
    notes: Optional[str] = "Lokasi pengujian baru."

class WifiConfigInput(BaseModel):
    ssid: str
    password: Optional[str] = None

class LoginInput(BaseModel):
    username: str
    password: Optional[str] = None
