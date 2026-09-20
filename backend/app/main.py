from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.health import router as health_router
from app.routes.wifi import router as wifi_router
from app.routes.locations import router as locations_router
from app.routes.telemetry import router as telemetry_router

app = FastAPI(
    title="AquaSentry API Backend",
    description="Backend API untuk Skrining Kualitas Air Real-Time & Machine Learning (Modular Refactored Architecture)",
    version="1.0.0"
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
