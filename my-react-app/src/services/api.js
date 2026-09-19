// Centralized API Service for AquaSentry Frontend
const API_BASE_URL = 'http://localhost:8000';

export async function fetchLocations() {
    const res = await fetch(`${API_BASE_URL}/api/locations`);
    if (!res.ok) throw new Error('Gagal mengambil data lokasi dari server');
    const json = await res.json();
    return json.data || [];
}

export async function saveLocation(siteData) {
    const res = await fetch(`${API_BASE_URL}/api/locations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
    });
    if (!res.ok) throw new Error('Gagal menyimpan lokasi ke server');
    return await res.json();
}

export async function fetchLatestTelemetry() {
    const res = await fetch(`${API_BASE_URL}/api/telemetry/latest`);
    if (!res.ok) throw new Error('Gagal mengambil data telemetri terbaru');
    return await res.json();
}

export async function checkBackendHealth() {
    const res = await fetch(`${API_BASE_URL}/api/health`);
    if (!res.ok) throw new Error('Backend tidak merespons');
    return await res.json();
}

export async function scanWifiNetworks() {
    const res = await fetch(`${API_BASE_URL}/api/wifi/scan`);
    if (!res.ok) throw new Error('Gagal memindai jaringan Wi-Fi');
    return await res.json();
}

export async function connectWifiNetwork(payload) {
    const res = await fetch(`${API_BASE_URL}/api/wifi/connect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Gagal mengirim konfigurasi Wi-Fi');
    return await res.json();
}
