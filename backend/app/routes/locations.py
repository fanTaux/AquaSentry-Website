import time
from fastapi import APIRouter
from app.models.schemas import LocationInput
from app.services import location_service

router = APIRouter(prefix="/api/locations", tags=["Locations"])

@router.get("")
def get_locations():
    """Returns saved location pins."""
    return {
        "ok": True,
        "total": len(location_service.saved_locations_db),
        "data": location_service.saved_locations_db
    }

@router.post("")
def save_location(loc: LocationInput):
    """Saves a new location pin permanently."""
    new_id = loc.id or f"site-{int(time.time() * 1000)}"
    new_entry = loc.dict()
    new_entry["id"] = new_id

    # Remove duplicates with same name if any
    location_service.saved_locations_db = [
        item for item in location_service.saved_locations_db if item["name"] != loc.name
    ]
    location_service.saved_locations_db.append(new_entry)

    location_service.save_locations(location_service.saved_locations_db)

    return {
        "ok": True,
        "message": f"Lokasi '{loc.name}' berhasil disimpan secara permanen!",
        "data": new_entry,
        "all_locations": location_service.saved_locations_db
    }
