import time
from fastapi import APIRouter
from app.models.schemas import LocationInput
from app.services import location_service, queue_service
from app.config import sentry

router = APIRouter(prefix="/api/locations", tags=["Locations"])

def evaluate_site_metrics(tds: float, turb: float) -> dict:
    """Evaluasi sampel air menggunakan model Random Forest & baku mutu."""
    tds_val = float(tds) if tds is not None else 85.0
    turb_val = float(turb) if turb is not None else 15.0

    eval_res = sentry.evaluate_sample(tds_val, turb_val)
    ml_cat = eval_res.get("ML Random Forest Category", "Low Risk").lower()

    if "low" in ml_cat:
        risk_level = "low"
        category = "Sangat Rendah (Aman)"
    elif "med" in ml_cat or "moderate" in ml_cat:
        risk_level = "moderate"
        category = "Sedang"
    else:
        risk_level = "high"
        category = "Tinggi (Bahaya)"

    return {
        "tds": round(tds_val, 1),
        "turbidity": round(turb_val, 1),
        "ari": eval_res.get("ARI", 0.35),
        "assScore": eval_res.get("ASS Score (0-100)", 85.0),
        "category": category,
        "riskLevel": risk_level
    }

@router.get("")
def get_locations():
    """Mengambil daftar titik lokasi tersimpan."""
    fresh_data = location_service.load_locations()
    location_service.saved_locations_db = fresh_data
    return {
        "ok": True,
        "total": len(fresh_data),
        "data": fresh_data
    }

@router.post("")
def save_location(loc: LocationInput):
    """Menyimpan titik lokasi baru dengan evaluasi Random Forest & timestamp asli ESP32."""
    metrics = evaluate_site_metrics(loc.tds, loc.turbidity)
    if loc.riskLevel and loc.riskLevel in ["high", "veryhigh", "moderate", "low"]:
        metrics["riskLevel"] = loc.riskLevel
        if loc.category:
            metrics["category"] = loc.category

    saved_time = loc.timestamp_esp or loc.timestamp or "Baru saja"

    new_entry = {
        "id": loc.id or f"site-{int(time.time() * 1000)}",
        "name": loc.name,
        "keterangan": loc.keterangan or "-",
        "lat": loc.lat,
        "lng": loc.lng,
        "timestamp": saved_time,
        "timestamp_esp": loc.timestamp_esp,
        "test_id": loc.test_id,
        **metrics
    }

    # Hapus entri lama dengan nama yang sama jika ada
    location_service.saved_locations_db = [
        item for item in location_service.saved_locations_db if item.get("name") != loc.name
    ]
    location_service.saved_locations_db.append(new_entry)
    location_service.save_locations(location_service.saved_locations_db)

    # Jika ditandai dari hasil uji di antrean, hapus dari antrean pending
    if loc.test_id:
        queue_service.remove_from_queue(loc.test_id)

    return {
        "ok": True,
        "message": f"Lokasi '{loc.name}' berhasil disimpan dengan jam asli pengujian: {saved_time}.",
        "data": new_entry,
        "all_locations": location_service.saved_locations_db
    }

@router.put("/{location_id}")
def update_location(location_id: str, loc: LocationInput):
    """Memperbarui data titik lokasi dan mengevaluasi ulang parameternya."""
    locations = location_service.load_locations()
    target = None

    metrics = evaluate_site_metrics(loc.tds, loc.turbidity)

    for item in locations:
        if item.get("id") == location_id:
            item["name"] = loc.name or item.get("name", "")
            item["keterangan"] = loc.keterangan if loc.keterangan is not None else item.get("keterangan", "-")
            item["lat"] = loc.lat if loc.lat is not None else item.get("lat")
            item["lng"] = loc.lng if loc.lng is not None else item.get("lng")
            item.update(metrics)
            target = item
            break

    if not target:
        return {"ok": False, "message": f"Lokasi '{location_id}' tidak ditemukan."}

    location_service.save_locations(locations)
    location_service.saved_locations_db = locations

    return {
        "ok": True,
        "message": f"Lokasi '{target['name']}' berhasil diperbarui.",
        "data": target,
        "all_locations": locations
    }

@router.delete("/{location_id}")
def delete_location(location_id: str):
    """Menghapus titik lokasi."""
    locations = location_service.load_locations()
    filtered = [item for item in locations if item.get("id") != location_id]

    if len(filtered) == len(locations):
        return {"ok": False, "message": f"Lokasi '{location_id}' tidak ditemukan."}

    location_service.save_locations(filtered)
    location_service.saved_locations_db = filtered

    return {
        "ok": True,
        "message": "Lokasi berhasil dihapus.",
        "all_locations": filtered
    }
