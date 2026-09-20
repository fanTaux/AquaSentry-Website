from typing import Optional
from pydantic import BaseModel

class TelemetryInput(BaseModel):
    device_id: Optional[str] = "aquasentry-esp32-01"
    tds_mg_l: float
    turbidity_ntu: float
    edge_ai_prediction: Optional[str] = None
    ari: Optional[float] = None
    ass_score: Optional[float] = None
    source: Optional[str] = "Sumber Air A"
    location: Optional[str] = "Sumber Air A"

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
    method: Optional[str] = "GPS Hotspot (Auto-Detect)"
    device: Optional[str] = "aquasentry-esp32-01"
    advice: Optional[str] = "Air aman digunakan."
    notes: Optional[str] = "Lokasi pengujian baru."

class WifiConfigInput(BaseModel):
    ssid: str
    password: Optional[str] = None

class LoginInput(BaseModel):
    username: str
    password: Optional[str] = None
