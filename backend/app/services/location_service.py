import os
import json
from app.config import LOCATIONS_FILE

def load_locations():
    if os.path.exists(LOCATIONS_FILE):
        try:
            with open(LOCATIONS_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    # Filter out legacy dummy sites
                    clean = [item for item in data if item.get("id") not in ["site-1", "site-2", "site-3", "site-4", "site-5"]]
                    return clean
        except Exception:
            pass
    return []

def save_locations(locs):
    try:
        with open(LOCATIONS_FILE, "w", encoding="utf-8") as f:
            json.dump(locs, f, indent=2, ensure_ascii=False)
    except Exception as e:
        print(f"Error saving locations: {e}")

# Global in-memory location DB
saved_locations_db = load_locations()
