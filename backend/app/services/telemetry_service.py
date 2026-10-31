import os
import json
import time
import threading
from typing import List, Optional
from app.config import sentry, MAX_HISTORY_SIZE

lock = threading.RLock()

BASE_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
HISTORY_FILE = os.path.join(BASE_DIR, "telemetry_history.json")

def load_history_from_disk() -> List[dict]:
    if os.path.exists(HISTORY_FILE):
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    return data
        except Exception:
            pass
    return []

def save_history_to_disk(hist: List[dict]):
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(hist, f, indent=2)
    except Exception:
        pass

telemetry_history: List[dict] = load_history_from_disk()
current_telemetry: Optional[dict] = None
last_esp_post_time: float = 0.0

def get_history(limit: int = 50) -> List[dict]:
    with lock:
        if not telemetry_history:
            disk_data = load_history_from_disk()
            if disk_data:
                telemetry_history.extend(disk_data)
        return list(telemetry_history[-limit:])

# State dari ESP32 Edge AI
device_status: str = "offline"  # online, standby, testing, offline
is_testing: bool = False
test_elapsed_sec: int = 0
active_preset: str = "LOW"
ai_prediction: str = "Standby"
final_verdict: Optional[str] = None
vote_counts: dict = {"low": 0, "medium": 0, "high": 0}

def map_edge_ai_label(label: str) -> str:
    """Konversi label Edge AI ESP32 ('Low', 'Medium', 'High') ke format sistem web."""
    if not label:
        return "Low Risk"
    l = label.lower()
    if "low" in l:
        return "Low Risk"
    elif "med" in l:
        return "Moderate Risk"
    elif "high" in l:
        return "High Risk"
    return label

def create_telemetry_entry(
    tds: float,
    turb: float,
    source: str = "Sumber Air A",
    location: str = "Sumber Air A",
    device_id: str = "ESP32_AquaSentry",
    edge_ai_label: Optional[str] = None,
    is_test: bool = False,
    elapsed_sec: int = 0,
    preset: str = "LOW"
):
    eval_res = sentry.evaluate_sample(tds, turb)
    ml_category = map_edge_ai_label(edge_ai_label) if edge_ai_label else eval_res["ML Random Forest Category"]

    return {
        "device_id": device_id,
        "timestamp": int(time.time() * 1000),
        "tds_mg_l": round(tds, 1),
        "tds_ppm": round(tds, 1),
        "turbidity_ntu": round(turb, 1),
        "r_tds": eval_res["rTDS"],
        "r_turb": eval_res["rTurb"],
        "ari": eval_res["ARI"],
        "ass_score": eval_res["ASS Score (0-100)"],
        "rule_category": eval_res["Rule Category"],
        "ml_risk_category": ml_category,
        "led_indicator": eval_res["LED Indicator"],
        "meaning": eval_res["Meaning"],
        "source": source,
        "location": location,
        "is_testing": is_test,
        "test_elapsed_sec": elapsed_sec,
        "preset": preset,
        "ai_prediction": edge_ai_label or eval_res["ML Random Forest Category"]
    }

current_telemetry = create_telemetry_entry(85.0, 15.0)

def record_telemetry(
    tds: float,
    turb: float,
    is_test: bool = True,
    elapsed_sec: int = 0,
    preset: str = "LOW",
    edge_ai_pred: Optional[str] = None,
    device_id: str = "ESP32_AquaSentry",
    save_to_history: bool = False
):
    global last_esp_post_time, current_telemetry, is_testing, test_elapsed_sec, active_preset, ai_prediction, device_status

    with lock:
        last_esp_post_time = time.time()
        is_testing = is_test
        test_elapsed_sec = elapsed_sec
        active_preset = preset or active_preset
        if edge_ai_pred:
            ai_prediction = edge_ai_pred
        device_status = "testing" if is_test else "standby"

        entry = create_telemetry_entry(
            tds=tds,
            turb=turb,
            device_id=device_id,
            edge_ai_label=edge_ai_pred,
            is_test=is_test,
            elapsed_sec=elapsed_sec,
            preset=active_preset
        )

        current_telemetry = entry

        # HANYA simpan ke riwayat bila flag save_to_history aktif (hasil akhir uji 30 detik selesai)
        if save_to_history:
            telemetry_history.append(entry)
            if len(telemetry_history) > MAX_HISTORY_SIZE:
                telemetry_history.pop(0)
            save_history_to_disk(telemetry_history)

        return entry

last_start_trigger_time: float = 0.0

def update_status(status_val: str, preset: Optional[str] = None, edge_ai_pred: Optional[str] = None):
    global last_esp_post_time, device_status, active_preset, ai_prediction, is_testing, test_elapsed_sec, last_start_trigger_time

    with lock:
        last_esp_post_time = time.time()
        if preset:
            active_preset = preset
        if edge_ai_pred:
            ai_prediction = edge_ai_pred

        if status_val == "testing_started":
            is_testing = True
            test_elapsed_sec = 0
            device_status = "testing"
            last_start_trigger_time = time.time()
        elif status_val == "cancelled":
            is_testing = False
            device_status = "standby"
        elif status_val in ["standby", "online"]:
            # Abaikan standby jika pengujian baru dimulai (< 3.5 detik) agar tidak tertimpa paket lama di jaringan
            if not (is_testing and (time.time() - last_start_trigger_time < 3.5)):
                is_testing = False
                device_status = "standby" if status_val != "online" else "online"

def update_result(verdict: str, preset: str, vote_low: int, vote_med: int, vote_high: int, avg_tds: Optional[float] = None, avg_turb: Optional[float] = None):
    global last_esp_post_time, is_testing, final_verdict, vote_counts, device_status, ai_prediction

    with lock:
        last_esp_post_time = time.time()
        is_testing = False
        final_verdict = verdict
        ai_prediction = verdict
        device_status = "standby"
        vote_counts = {
            "low": vote_low,
            "medium": vote_med,
            "high": vote_high
        }

        # Simpan TEPAT 1 BARIS ringkasan rata-rata ke riwayat ketika pengujian 30 detik selesai
        final_tds = avg_tds if avg_tds is not None else ((current_telemetry.get("tds_ppm") if current_telemetry else None) or 85.0)
        final_turb = avg_turb if avg_turb is not None else ((current_telemetry.get("turbidity_ntu") if current_telemetry else None) or 15.0)
        record_telemetry(
            tds=final_tds,
            turb=final_turb,
            is_test=False,
            elapsed_sec=30,
            preset=preset,
            edge_ai_pred=verdict,
            save_to_history=True
        )

def clear_all_telemetry():
    global telemetry_history, current_telemetry
    with lock:
        telemetry_history.clear()
        current_telemetry = None
        save_history_to_disk([])
