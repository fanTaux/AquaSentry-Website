import { useEffect, useRef } from 'react';
import L from 'leaflet';

export const getBadgeStyle = (level) => {
    switch (level) {
        case 'veryhigh':
            return { bg: 'bg-rose-500', text: 'text-rose-500', border: 'border-rose-500', label: 'Bahaya', pulse: 'bg-rose-400', hexColor: '#ef4444' };
        case 'high':
            return { bg: 'bg-amber-500', text: 'text-amber-500', border: 'border-amber-500', label: 'Tinggi', pulse: 'bg-amber-400', hexColor: '#f97316' };
        case 'moderate':
            return { bg: 'bg-yellow-500', text: 'text-yellow-600', border: 'border-yellow-500', label: 'Sedang', pulse: 'bg-yellow-400', hexColor: '#eab308' };
        default:
            return { bg: 'bg-emerald-500', text: 'text-emerald-500', border: 'border-emerald-500', label: 'Aman', pulse: 'bg-emerald-400', hexColor: '#10b981' };
    }
};

export default function MapCanvas({ sites, riskFilter, selectedSite, onSelectSite, onEditSite }) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});

    // Initialize Leaflet Map Instance
    useEffect(() => {
        if (!mapContainerRef.current) return;
        if (mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [-7.9525, 112.6145],
            zoom: 12,
            zoomControl: false
        });

        L.control.zoom({ position: 'topright' }).addTo(map);

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap contributors',
            maxZoom: 19
        }).addTo(map);

        mapInstanceRef.current = map;

        return () => {
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    // Update Teardrop Markers on Sites / Filter Change
    useEffect(() => {
        const map = mapInstanceRef.current;
        if (!map) return;

        Object.values(markersRef.current).forEach(m => m.remove());
        markersRef.current = {};

        const filteredSites = sites.filter(s => {
            if (riskFilter === 'all') return true;
            if (riskFilter === 'low') return s.riskLevel === 'low';
            if (riskFilter === 'moderate') return s.riskLevel === 'moderate' || s.riskLevel === 'high';
            if (riskFilter === 'veryhigh') return s.riskLevel === 'veryhigh';
            return true;
        });

        filteredSites.forEach((site, idx) => {
            const badge = getBadgeStyle(site.riskLevel);
            const pinNo = site.no || (idx + 1);

            const customIcon = L.divIcon({
                className: 'custom-pin-marker',
                html: `
                    <div class="relative flex items-center justify-center cursor-pointer group">
                        <div class="relative flex items-center justify-center w-7 h-7 rounded-full shadow-lg text-white font-black text-xs border-2 border-white transition-all duration-200 group-hover:scale-125 ring-1 ring-black/15" style="background-color: ${badge.hexColor};">
                            <span class="animate-ping absolute inset-0 rounded-full ${badge.pulse} opacity-30"></span>
                            <span class="relative z-10">${pinNo}</span>
                        </div>
                    </div>
                `,
                iconSize: [28, 28],
                iconAnchor: [14, 14]
            });

            const marker = L.marker([site.lat, site.lng], { icon: customIcon }).addTo(map);
            marker.bindTooltip(`<b>#${pinNo}</b> ${site.name}`, { direction: 'top', offset: [0, -14] });

            marker.bindPopup(`
                <div style="font-family: inherit; min-width: 180px; padding: 4px;">
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px; margin-bottom: 4px;">
                        <span style="background: ${badge.hexColor}; color: white; padding: 2px 6px; border-radius: 6px; font-size: 10px; font-weight: 800;">#${pinNo}</span>
                        <span style="font-size: 10px; font-weight: 800; color: #64748b;">${site.category || 'Tervalidasi'}</span>
                    </div>
                    <div style="font-size: 13px; font-weight: 800; color: #0f172a; margin-bottom: 2px;">${site.name}</div>
                    <div style="font-size: 11px; color: #64748b; margin-bottom: 4px;">Sumber: <b>${site.sumber_air || site.keterangan || '-'}</b></div>
                    <div style="font-size: 11px; color: #334155; margin-bottom: 8px; background: #f8fafc; padding: 4px 6px; border-radius: 6px; border: 1px solid #e2e8f0;">
                        TDS: <b>${site.tds}</b> ppm | Turb: <b>${site.turbidity}</b> NTU
                    </div>
                    <button id="map-edit-btn-${site.id}" style="width: 100%; background: #2563eb; color: #ffffff; border: none; padding: 6px 10px; border-radius: 8px; font-size: 11px; font-weight: 800; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 4px; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                        ✏️ Edit Data Lokasi
                    </button>
                </div>
            `);

            marker.on('popupopen', () => {
                const btn = document.getElementById(`map-edit-btn-${site.id}`);
                if (btn) {
                    btn.onclick = () => {
                        if (onEditSite) onEditSite(site);
                    };
                }
            });

            marker.on('click', () => {
                onSelectSite(site);
                map.flyTo([site.lat, site.lng], 13, { duration: 1 });
            });

            markersRef.current[site.id] = marker;
        });
    }, [sites, riskFilter, onSelectSite, onEditSite]);

    // Fly to Selected Site when changed externally
    useEffect(() => {
        if (mapInstanceRef.current && selectedSite && selectedSite.lat && selectedSite.lng) {
            mapInstanceRef.current.flyTo([selectedSite.lat, selectedSite.lng], 12, { duration: 1 });
        }
    }, [selectedSite]);

    return (
        <div className="bg-white border border-gray-100 rounded-3xl p-3 shadow-xs space-y-3 flex flex-col">
            <div className="relative w-full h-[460px] rounded-2xl overflow-hidden border border-gray-100 shadow-inner z-0">
                <div ref={mapContainerRef} className="w-full h-full" />

                {/* Map Overlay Badge */}
                <div className="absolute top-3 left-3 z-10 bg-white/95 backdrop-blur-md px-4 py-2.5 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-3 text-[11px] font-bold text-aqua-text">
                    <span className="material-symbols-outlined text-xl text-aqua-primary">explore</span>
                    <div>
                        <span className="block font-black text-xs text-aqua-text">Wilayah Uji: Malang & Sekitarnya</span>
                        <span className="text-[10px] text-gray-500 font-normal">Pin Teardrop (Hijau: Aman, Kuning: Waspada, Merah: Bahaya)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
