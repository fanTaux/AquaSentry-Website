import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchLocations, saveLocation } from '../services/api';
import MapCanvas from './map/MapCanvas';
import LocationFilterBar from './map/LocationFilterBar';
import LocationCardGrid from './map/LocationCardGrid';
import LocationDetailSidebar from './map/LocationDetailSidebar';
import LocationWizardModal from './map/LocationWizardModal';

export default function LocationMap() {
    const { latestReading, reading, history } = useAppContext();

    const [sites, setSites] = useState(() => {
        try {
            const saved = localStorage.getItem('aquasentry_locations');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const clean = parsed.filter(s => !['site-1', 'site-2', 'site-3', 'site-4', 'site-5'].includes(s.id));
                    return clean;
                }
            }
        } catch (e) {}
        return [];
    });

    const [selectedSite, setSelectedSite] = useState(() => {
        try {
            const saved = localStorage.getItem('aquasentry_locations');
            if (saved) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) {
                    const clean = parsed.filter(s => !['site-1', 'site-2', 'site-3', 'site-4', 'site-5'].includes(s.id));
                    if (clean.length > 0) return clean[0];
                }
            }
        } catch (e) {}
        return null;
    });

    // Load locations from Backend API on mount
    useEffect(() => {
        const loadLocationsFromBackend = async () => {
            try {
                const data = await fetchLocations();
                const clean = data.filter(s => !['site-1', 'site-2', 'site-3', 'site-4', 'site-5'].includes(s.id));
                setSites(clean);
                localStorage.setItem('aquasentry_locations', JSON.stringify(clean));
                if (clean.length > 0) {
                    setSelectedSite(prev => (prev && clean.some(s => s.id === prev.id)) ? prev : clean[0]);
                } else {
                    setSelectedSite(null);
                }
            } catch (err) {
                // Fallback to localStorage / empty
            }
        };
        loadLocationsFromBackend();
    }, []);

    // Risk condition filter state ('all', 'low', 'moderate', 'veryhigh')
    const [riskFilter, setRiskFilter] = useState('all');

    // Modal state for location tagging wizard
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [modalStep, setModalStep] = useState(1);
    const [locationMethod, setLocationMethod] = useState('gps');
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteKeterangan, setNewSiteKeterangan] = useState('');
    const [newSiteLat, setNewSiteLat] = useState(-8.5069);
    const [newSiteLng, setNewSiteLng] = useState(115.2625);

    // Selected Telemetry History Index for tagging (0 = Live Reading)
    const [selectedHistoryIndex, setSelectedHistoryIndex] = useState('live');
    const [newSiteTds, setNewSiteTds] = useState(120);
    const [newSiteTurb, setNewSiteTurb] = useState(1.2);

    // Geolocation detection state
    const [isDetectingGps, setIsDetectingGps] = useState(false);
    const [gpsStatusMessage, setGpsStatusMessage] = useState('');

    // Sync current telemetry values when history selector changes or defaults to live
    useEffect(() => {
        if (selectedHistoryIndex === 'live') {
            if (reading) {
                setNewSiteTds(reading.tds);
                setNewSiteTurb(reading.turbidity);
            }
        } else {
            const idx = parseInt(selectedHistoryIndex, 10);
            if (!isNaN(idx) && history[idx]) {
                setNewSiteTds(history[idx].tds);
                setNewSiteTurb(history[idx].turbidity);
            }
        }
    }, [selectedHistoryIndex, reading, history]);

    // Sync active reading from telemetry to matched location
    useEffect(() => {
        if (!latestReading) return;

        setSites(prevSites =>
            prevSites.map(s => {
                if (
                    (latestReading.source && s.source === latestReading.source) ||
                    (latestReading.source && s.keterangan === latestReading.source)
                ) {
                    const category = latestReading.ml_risk_category || latestReading.rule_category || 'Sangat Rendah (Aman)';
                    let riskLevel = 'low';
                    if (category.includes('Sangat Tinggi')) riskLevel = 'veryhigh';
                    else if (category.includes('Tinggi')) riskLevel = 'high';
                    else if (category.includes('Sedang')) riskLevel = 'moderate';

                    const updated = {
                        ...s,
                        tds: latestReading.tds_mg_l,
                        turbidity: latestReading.turbidity_ntu,
                        ari: latestReading.ari !== undefined ? latestReading.ari : s.ari,
                        assScore: latestReading.ass_score !== undefined ? latestReading.ass_score : s.assScore,
                        category: category,
                        riskLevel: riskLevel,
                        timestamp: 'Baru saja (Real-time Sync)'
                    };

                    if (selectedSite?.id === s.id) {
                        setSelectedSite(updated);
                    }
                    return updated;
                }
                return s;
            })
        );
    }, [latestReading, selectedSite]);

    // Handle HTML5 Geolocation Detection (GPS / Hotspot HP)
    const handleDetectCurrentLocation = () => {
        if (!navigator.geolocation) {
            setGpsStatusMessage('Browser Anda tidak mendukung Geolocation API.');
            return;
        }

        setIsDetectingGps(true);
        setGpsStatusMessage('Mendeteksi koordinat lokasi dari GPS/Hotspot HP...');

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = parseFloat(position.coords.latitude.toFixed(4));
                const lng = parseFloat(position.coords.longitude.toFixed(4));
                const acc = Math.round(position.coords.accuracy);

                setNewSiteLat(lat);
                setNewSiteLng(lng);
                setIsDetectingGps(false);
                setGpsStatusMessage(`Lokasi terdeteksi dari Hotspot HP: Lat ${lat}, Lng ${lng} (Akurasi ~${acc}m).`);

                if (!newSiteName) {
                    setNewSiteName(`Titik Jelajah GenZ (${lat}, ${lng})`);
                }
            },
            (error) => {
                setIsDetectingGps(false);
                setNewSiteLat(-8.5069);
                setNewSiteLng(115.2625);
                setGpsStatusMessage('Tidak dapat mengakses GPS (Menggunakan lokasi estimasi Hotspot Bali).');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSelectSite = (site) => {
        setSelectedSite(site);
    };

    const handleOpenModal = () => {
        setIsAddModalOpen(true);
        setModalStep(1);
        handleDetectCurrentLocation();
    };

    const handleAddSiteSubmit = async (e) => {
        e.preventDefault();
        if (!newSiteName) return;

        const tdsVal = parseFloat(newSiteTds) || 100;
        const turbVal = parseFloat(newSiteTurb) || 0.5;

        // Calculate ARI & ASS
        const rTds = tdsVal / 300.0;
        const rTurb = turbVal / 3.0;
        const ari = 0.5 * rTds + 0.5 * rTurb;
        const ass = Math.round((100.0 / (1.0 + ari)) * 10) / 10;

        let riskLevel = 'low';
        let category = 'Sangat Rendah (Aman)';

        if (tdsVal > 600 || turbVal > 6.0) {
            riskLevel = 'veryhigh';
            category = 'Sangat Tinggi (Bahaya)';
        } else if (tdsVal > 300 || turbVal > 3.0) {
            riskLevel = 'high';
            category = 'Tinggi';
        } else if (tdsVal > 150 || turbVal > 1.5) {
            riskLevel = 'moderate';
            category = 'Sedang';
        }

        const newId = `site-${Date.now()}`;
        const newSite = {
            id: newId,
            name: newSiteName,
            source: `Sumber Custom`,
            keterangan: newSiteKeterangan || `Pengujian Titik Jelajah`,
            lat: newSiteLat,
            lng: newSiteLng,
            tds: tdsVal,
            turbidity: turbVal,
            ari: Math.round(ari * 100) / 100,
            assScore: ass,
            category: category,
            riskLevel: riskLevel,
            timestamp: 'Baru saja (Ditandai)',
            method: locationMethod === 'gps' ? 'GPS Hotspot HP (Auto-Detect)' : 'Pin Manual Peta (Grab Style)',
            device: 'aquasentry-esp32-01',
            advice: riskLevel === 'low' ? 'Kondisi air aman. Disarankan merebus sebelum dikonsumsi.' : 'Kondisi air perlu kewaspadaan/penanganan.',
            notes: `Lokasi pengujian baru ditandai dari Telemetri Sensor (${tdsVal} mg/L, ${turbVal} NTU).`
        };

        const updatedSites = [...sites.filter(item => item.name !== newSiteName), newSite];
        setSites(updatedSites);
        setSelectedSite(newSite);
        setIsAddModalOpen(false);
        setModalStep(1);

        // Save to localStorage
        try {
            localStorage.setItem('aquasentry_locations', JSON.stringify(updatedSites));
        } catch (e) {}

        // Send POST to Backend API
        try {
            const resData = await saveLocation(newSite);
            if (resData && resData.ok && resData.all_locations) {
                setSites(resData.all_locations);
                localStorage.setItem('aquasentry_locations', JSON.stringify(resData.all_locations));
            }
        } catch (err) {
            console.error("Gagal simpan lokasi ke backend:", err);
        }

        setNewSiteName('');
        setNewSiteKeterangan('');
    };

    const filteredSites = sites.filter(s => {
        if (riskFilter === 'all') return true;
        if (riskFilter === 'low') return s.riskLevel === 'low';
        if (riskFilter === 'moderate') return s.riskLevel === 'moderate' || s.riskLevel === 'high';
        if (riskFilter === 'veryhigh') return s.riskLevel === 'veryhigh';
        return true;
    });

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header Banner */}
            <div className="bg-white border border-gray-100 p-6 rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="material-symbols-outlined text-aqua-primary text-2xl">map</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-aqua-primary">GenZ Traveler & Mobile Hotspot Tracker</span>
                    </div>
                    <h1 className="text-2xl font-black text-aqua-text tracking-tight">
                        Peta Pengujian & Penandaan Lokasi Sampel Air
                    </h1>
                    <p className="text-xs text-aqua-text-muted mt-1 font-medium">
                        Deteksi otomatis koordinat lokasi dari Hotspot HP Anda atau tandai lokasi persis di peta.
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={handleOpenModal}
                        className="bg-aqua-primary text-white font-bold text-xs px-5 py-3 rounded-2xl shadow-sm hover:bg-aqua-primary/90 transition-all flex items-center gap-2 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-lg">add_location_alt</span>
                        Tandai Lokasi Uji Baru
                    </button>
                </div>
            </div>

            {/* Main Interactive Map & Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Left Area (2 Columns on Desktop) */}
                <div className="lg:col-span-2 space-y-4 flex flex-col">
                    {/* 1. MAP CANVAS */}
                    <MapCanvas
                        sites={sites}
                        riskFilter={riskFilter}
                        selectedSite={selectedSite}
                        onSelectSite={handleSelectSite}
                    />

                    {/* 2. CONTROL FILTER & CARDS BELOW MAP */}
                    <div className="bg-white border border-gray-100 rounded-3xl p-5 shadow-xs space-y-4">
                        <LocationFilterBar
                            sites={sites}
                            riskFilter={riskFilter}
                            setRiskFilter={setRiskFilter}
                            countFiltered={filteredSites.length}
                        />

                        <LocationCardGrid
                            sites={sites}
                            filteredSites={filteredSites}
                            selectedSite={selectedSite}
                            onSelectSite={handleSelectSite}
                        />
                    </div>
                </div>

                {/* Selected Location Details Sidebar (Right Column) */}
                <div className="space-y-6">
                    <LocationDetailSidebar selectedSite={selectedSite} />
                </div>
            </div>

            {/* Gen Z Location Tagging Modal Wizard */}
            <LocationWizardModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                modalStep={modalStep}
                setModalStep={setModalStep}
                locationMethod={locationMethod}
                setLocationMethod={setLocationMethod}
                newSiteName={newSiteName}
                setNewSiteName={setNewSiteName}
                newSiteKeterangan={newSiteKeterangan}
                setNewSiteKeterangan={setNewSiteKeterangan}
                newSiteLat={newSiteLat}
                setNewSiteLat={setNewSiteLat}
                newSiteLng={newSiteLng}
                setNewSiteLng={setNewSiteLng}
                selectedHistoryIndex={selectedHistoryIndex}
                setSelectedHistoryIndex={setSelectedHistoryIndex}
                newSiteTds={newSiteTds}
                setNewSiteTds={setNewSiteTds}
                newSiteTurb={newSiteTurb}
                setNewSiteTurb={setNewSiteTurb}
                isDetectingGps={isDetectingGps}
                gpsStatusMessage={gpsStatusMessage}
                onDetectLocation={handleDetectCurrentLocation}
                onSubmit={handleAddSiteSubmit}
                reading={reading}
                history={history}
            />
        </div>
    );
}
