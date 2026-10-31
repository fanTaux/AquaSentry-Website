import os
import json
import time
import logging
from typing import List, Dict, Optional

logger = logging.getLogger("aquasentry.queue")

QUEUE_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))), "pending_queue.json")
MAX_QUEUE_SIZE = 50

pending_queue: List[Dict] = []

def load_queue_from_disk() -> List[Dict]:
    global pending_queue
    if os.path.exists(QUEUE_FILE):
        try:
            with open(QUEUE_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    pending_queue = data
                    return pending_queue
        except Exception as e:
            logger.error(f"[QUEUE] Gagal memuat file queue: {e}")
    pending_queue = []
    return pending_queue

def save_queue_to_disk():
    try:
        with open(QUEUE_FILE, "w", encoding="utf-8") as f:
            json.dump(pending_queue, f, indent=2, ensure_ascii=False)
    except Exception as e:
        logger.error(f"[QUEUE] Gagal menyimpan file queue: {e}")

# Load initial state on import
load_queue_from_disk()

def add_test_result(
    verdict: str,
    avg_tds: float,
    avg_turb: float,
    preset: str = "LOW",
    test_id: Optional[str] = None,
    timestamp_esp: Optional[str] = None,
    vote_counts: Optional[Dict] = None
) -> Dict:
    global pending_queue

    now_epoch = int(time.time())
    if not test_id:
        test_id = f"TEST-{now_epoch}"

    if not timestamp_esp:
        # Format WIB (UTC+7)
        local_time = time.localtime(now_epoch)
        timestamp_esp = time.strftime("%d %b %Y, %H:%M:%S WIB", local_time)

    # Hindari duplikasi jika test_id yang sama sudah ada
    for item in pending_queue:
        if item.get("test_id") == test_id:
            return item

    entry = {
        "test_id": test_id,
        "timestamp_esp": timestamp_esp,
        "final_verdict": verdict,
        "avg_tds": round(float(avg_tds), 1),
        "avg_turbidity": round(float(avg_turb), 1),
        "preset": preset,
        "vote_counts": vote_counts or {"low": 0, "medium": 0, "high": 0},
        "created_at": now_epoch
    }

    pending_queue.insert(0, entry) # Item terbaru di depan (LIFO/FIFO)
    if len(pending_queue) > MAX_QUEUE_SIZE:
        pending_queue = pending_queue[:MAX_QUEUE_SIZE]

    save_queue_to_disk()
    logger.info(f"[QUEUE] Hasil uji baru ditambahkan ke antrean: {test_id} ({timestamp_esp})")
    return entry

def get_pending_queue() -> List[Dict]:
    return load_queue_from_disk()

def remove_from_queue(test_id: str) -> bool:
    global pending_queue
    initial_len = len(pending_queue)
    pending_queue = [item for item in pending_queue if item.get("test_id") != test_id]
    if len(pending_queue) != initial_len:
        save_queue_to_disk()
        logger.info(f"[QUEUE] Item {test_id} dihapus dari antrean.")
        return True
    return False

def clear_queue():
    global pending_queue
    pending_queue.clear()
    save_queue_to_disk()
