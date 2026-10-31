// Centralized API Service for AquaSentry Frontend
const API_BASE_URL = 'http://localhost:8000';

export async function fetchLocations() {
    const res = await fetch(`${API_BASE_URL}/api/locations`);
    if (!res.ok) throw new Error('Gagal mengambil data lokasi dari server');
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data || []);
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

export async function updateLocation(siteId, siteData) {
    const res = await fetch(`${API_BASE_URL}/api/locations/${siteId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteData)
    });
    if (!res.ok) throw new Error('Gagal memperbarui lokasi ke server');
    return await res.json();
}

export async function deleteLocation(siteId) {
    const res = await fetch(`${API_BASE_URL}/api/locations/${siteId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Gagal menghapus lokasi dari server');
    return await res.json();
}

export async function fetchLatestTelemetry() {
    const res = await fetch(`${API_BASE_URL}/api/telemetry/latest`);
    if (!res.ok) throw new Error('Gagal mengambil data telemetri terbaru');
    return await res.json();
}

export async function clearTelemetryHistory() {
    const res = await fetch(`${API_BASE_URL}/api/telemetry/history`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Gagal mengosongkan riwayat telemetri');
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

export async function sendEspCommand(commandData) {
    const res = await fetch(`${API_BASE_URL}/api/esp/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(commandData)
    });
    if (!res.ok) throw new Error('Gagal mengirim perintah ke ESP32');
    return await res.json();
}

export async function fetchEspStatus() {
    const res = await fetch(`${API_BASE_URL}/api/esp/status`);
    if (!res.ok) throw new Error('Gagal mengambil status ESP32');
    return await res.json();
}

export async function fetchPendingQueue() {
    const res = await fetch(`${API_BASE_URL}/api/queue`);
    if (!res.ok) throw new Error('Gagal mengambil antrean hasil uji');
    const json = await res.json();
    return Array.isArray(json) ? json : (json.data || []);
}

export async function dismissQueueItem(testId) {
    const res = await fetch(`${API_BASE_URL}/api/queue/${testId}`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Gagal menghapus antrean hasil uji');
    return await res.json();
}

export async function clearAllQueue() {
    const res = await fetch(`${API_BASE_URL}/api/queue`, {
        method: 'DELETE'
    });
    if (!res.ok) throw new Error('Gagal mengosongkan antrean');
    return await res.json();
}

