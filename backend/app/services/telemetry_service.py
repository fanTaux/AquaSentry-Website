import time
from typing import List
from app.config import sentry, MAX_HISTORY_SIZE

telemetry_history: List[dict] = []
last_esp_post_time: float = 0.0

def create_telemetry_entry(tds: float, turb: float, source: str = "Sumber Air A", location: str = "Sumber Air A", device_id: str = "aquasentry-esp32-01"):
    eval_res = sentry.evaluate_sample(tds, turb)

    return {
        "device_id": device_id,
        "timestamp": int(time.time() * 1000),
        "tds_mg_l": tds,
        "turbidity_ntu": turb,
        "r_tds": eval_res["rTDS"],
        "r_turb": eval_res["rTurb"],
        "ari": eval_res["ARI"],
        "ass_score": eval_res["ASS Score (0-100)"],
        "rule_category": eval_res["Rule Category"],
        "ml_risk_category": eval_res["ML Random Forest Category"],
        "led_indicator": eval_res["LED Indicator"],
        "meaning": eval_res["Meaning"],
        "source": source,
        "location": location
    }

current_telemetry = create_telemetry_entry(95.0, 0.5)
