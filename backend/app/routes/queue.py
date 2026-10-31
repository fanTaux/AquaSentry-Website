from fastapi import APIRouter
from app.services import queue_service

router = APIRouter(prefix="/api/queue", tags=["Test Results Queue"])

@router.get("")
def get_pending_tests():
    """Mengambil daftar hasil pengujian ESP32 yang belum ditandai ke peta."""
    items = queue_service.get_pending_queue()
    return {
        "ok": True,
        "total": len(items),
        "data": items
    }

@router.delete("/{test_id}")
def dismiss_pending_test(test_id: str):
    """Menghapus/mengabaikan satu hasil pengujian dari antrean."""
    success = queue_service.remove_from_queue(test_id)
    return {
        "ok": success,
        "message": f"Hasil pengujian '{test_id}' dihapus dari antrean." if success else "Item tidak ditemukan.",
        "remaining_queue": queue_service.get_pending_queue()
    }

@router.delete("")
def clear_all_pending_tests():
    """Mengosongkan semua antrean hasil pengujian."""
    queue_service.clear_queue()
    return {
        "ok": True,
        "message": "Semua antrean hasil uji berhasil dibersihkan."
    }
