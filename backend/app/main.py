from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.health import router as health_router
from app.routes.wifi import router as wifi_router
from app.routes.locations import router as locations_router
from app.routes.telemetry import router as telemetry_router
from app.routes.esp_control import router as esp_control_router
from app.routes.queue import router as queue_router
from app.services import mqtt_service, tcp_service

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: Jalankan background worker MQTT Cloud & TCP LAN
    print("[INIT] Memulai worker background MQTT Cloud (HiveMQ) & TCP LAN...")
    mqtt_service.start_mqtt_client()
    tcp_service.start_tcp_client()
    yield
    # Shutdown
    print("[SHUTDOWN] Menghentikan worker background...")
    mqtt_service.stop_mqtt_client()
    tcp_service.stop_tcp_client()

app = FastAPI(
    title="AquaSentry API Backend",
    description="Backend API untuk Skrining Kualitas Air Real-Time & Machine Learning (Modular Refactored Architecture)",
    version="1.0.0",
    lifespan=lifespan
)

# Enable CORS for frontend Vite dev server
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(health_router)
app.include_router(wifi_router)
app.include_router(locations_router)
app.include_router(telemetry_router)
app.include_router(esp_control_router)
app.include_router(queue_router)
