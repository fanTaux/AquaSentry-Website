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

export default function MapCanvas({ sites, riskFilter, selectedSite, onSelectSite }) {
    const mapContainerRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markersRef = useRef({});

    // Initialize Leaflet Map Instance
    useEffect(() => {
        if (!mapContainerRef.current) return;
        if (mapInstanceRef.current) return;

        const map = L.map(mapContainerRef.current, {
            center: [-8.4500, 115.2300],
            zoom: 10.5,
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

        filteredSites.forEach(site => {
            const badge = getBadgeStyle(site.riskLevel);

            const customIcon = L.divIcon({
                className: 'custom-teardrop-pin',
                html: `
                    <div className="relative flex flex-col items-center justify-center cursor-pointer group">
                        <span className="animate-ping absolute top-1 inline-flex h-7 w-7 rounded-full ${badge.pulse} opacity-40"></span>
                        <svg viewBox="0 0 24 32" class="w-9 h-11 drop-shadow-md transform transition-transform group-hover:scale-125 overflow-visible">
                            <path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20c0-6.63-5.37-12-12-12z" fill="${badge.hexColor}" stroke="#ffffff" stroke-width="1.8"/>
                            <circle cx="12" cy="11" r="5" fill="#ffffff"/>
                            <circle cx="12" cy="11" r="3" fill="${badge.hexColor}"/>
                        </svg>
                    </div>
                `,
                iconSize: [36, 44],
                iconAnchor: [18, 44]
            });

            const marker = L.marker([site.lat, site.lng], { icon: customIcon }).addTo(map);

            marker.on('click', () => {
                onSelectSite(site);
                map.flyTo([site.lat, site.lng], 12, { duration: 1 });
            });

            markersRef.current[site.id] = marker;
        });
    }, [sites, riskFilter, onSelectSite]);

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
                        <span className="block font-black text-xs text-aqua-text">Wilayah Uji: Bali Explorer</span>
                        <span className="text-[10px] text-gray-500 font-normal">Pin Teardrop (Hijau: Aman, Kuning: Waspada, Merah: Bahaya)</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
