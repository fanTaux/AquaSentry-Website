import { useEffect, useState } from 'react';
import { useAppContext } from '../context/AppContext';
import { fetchLocations, saveLocation, updateLocation, deleteLocation, fetchPendingQueue, dismissQueueItem, clearAllQueue } from '../services/api';
import { riskCategoryFromML, computeRiskScore } from '../hooks/useTelemetry';
import MapCanvas from './map/MapCanvas';
import LocationFilterBar from './map/LocationFilterBar';
import LocationCardGrid from './map/LocationCardGrid';
import LocationDetailSidebar from './map/LocationDetailSidebar';
import LocationWizardModal from './map/LocationWizardModal';
import EditLocationModal from './map/EditLocationModal';
import PendingQueueDrawer from './map/PendingQueueDrawer';

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
                const resData = await fetchLocations();
                const list = Array.isArray(resData) ? resData : (resData.data || []);
                const clean = list.filter(s => !['site-1', 'site-2', 'site-3', 'site-4', 'site-5'].includes(s.id));
                setSites(clean);
                localStorage.setItem('aquasentry_locations', JSON.stringify(clean));
                if (clean.length > 0) {
                    setSelectedSite(prev => (prev && clean.some(s => s.id === prev.id)) ? prev : clean[0]);
                } else {
                    setSelectedSite(null);
                }
            } catch (err) {
                console.error('Gagal memuat titik lokasi dari server:', err);
            }
        };
        loadLocationsFromBackend();
    }, []);

    // Risk condition filter state ('all', 'low', 'moderate', 'veryhigh')
    const [riskFilter, setRiskFilter] = useState('all');

    // Antrean hasil pengujian ESP32 (Queue Pending Tagging)
    const [pendingQueue, setPendingQueue] = useState([]);
    const [selectedTestId, setSelectedTestId] = useState(null);
    const [selectedEspTimestamp, setSelectedEspTimestamp] = useState(null);
    const [queuedTestItem, setQueuedTestItem] = useState(null);
    const [isQueueDrawerOpen, setIsQueueDrawerOpen] = useState(false);

    // Polling antrean hasil pengujian ESP32 dari backend
    useEffect(() => {
        const syncQueue = async () => {
            try {
                const list = await fetchPendingQueue();
                setPendingQueue(Array.isArray(list) ? list : []);
            } catch (err) {
                // Ignore silent polling error
            }
        };
        syncQueue();
        const timer = setInterval(syncQueue, 2500);
        return () => clearInterval(timer);
    }, []);

    // Modal state for location tagging wizard
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [modalStep, setModalStep] = useState(1);
    const [locationMethod, setLocationMethod] = useState('gps');
    const [newSiteName, setNewSiteName] = useState('');
    const [newSiteKeterangan, setNewSiteKeterangan] = useState('');
    const [newSiteLat, setNewSiteLat] = useState(-7.9525);
    const [newSiteLng, setNewSiteLng] = useState(112.6145);

    // Selected Telemetry History Index for tagging (0 = Live Reading)
    const [selectedHistoryIndex, setSelectedHistoryIndex] = useState('live');
    const [newSiteTds, setNewSiteTds] = useState(120);
    const [newSiteTurb, setNewSiteTurb] = useState(1.2);

    // Geolocation detection state
    const [isDetectingGps, setIsDetectingGps] = useState(false);
    const [gpsStatusMessage, setGpsStatusMessage] = useState('');

    // Sync current telemetry values when history selector changes or defaults to live
    useEffect(() => {
        if (selectedHistoryIndex === 'queue') {
            // Kunci nilai parameter hasil uji dari antrean, jangan tertimpa nilai standby!
            return;
        }
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
                setNewSiteLat(-7.9525);
                setNewSiteLng(112.6145);
                setGpsStatusMessage('Tidak dapat mengakses GPS (Menggunakan lokasi estimasi Malang).');
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    };

    const handleSelectSite = (site) => {
        setSelectedSite(site);
    };

    const handleOpenModal = () => {
        setQueuedTestItem(null);
        setSelectedTestId(null);
        setSelectedEspTimestamp(null);
        setSelectedHistoryIndex('live');
        setIsAddModalOpen(true);
        setModalStep(1);
        handleDetectCurrentLocation();
    };

    const handleTagQueueItem = (testItem) => {
        setQueuedTestItem(testItem);
        setSelectedTestId(testItem.test_id);
        setSelectedEspTimestamp(testItem.timestamp_esp);
        setSelectedHistoryIndex('queue');
        setNewSiteTds(testItem.avg_tds);
        setNewSiteTurb(testItem.avg_turbidity);

        const timeBrief = testItem.timestamp_esp ? testItem.timestamp_esp.split(',')[1]?.trim() : '';
        setNewSiteName(`Sampel Air (${timeBrief || testItem.test_id})`);
        setNewSiteKeterangan(`Hasil Uji ESP32: ${testItem.final_verdict} Risk (TDS ${testItem.avg_tds} ppm, Turb ${testItem.avg_turbidity} NTU)`);
        setModalStep(1);
        setIsAddModalOpen(true);
        handleDetectCurrentLocation();
    };

    const handleDismissQueueItem = async (testId) => {
        try {
            await dismissQueueItem(testId);
            setPendingQueue(prev => prev.filter(item => item.test_id !== testId));
        } catch (err) {
            console.error("Gagal mengabaikan antrean uji:", err);
        }
    };

    const handleClearAllQueue = async () => {
        try {
            await clearAllQueue();
            setPendingQueue([]);
        } catch (err) {
            console.error("Gagal membersihkan semua antrean:", err);
        }
    };

    const handleAddSiteSubmit = async (e) => {
        e.preventDefault();
        if (!newSiteName) return;

        const tdsVal = queuedTestItem ? Number(queuedTestItem.avg_tds) : (parseFloat(newSiteTds) || 100);
        const turbVal = queuedTestItem ? Number(queuedTestItem.avg_turbidity) : (parseFloat(newSiteTurb) || 0.5);

        // Evaluasi Menggunakan Machine Learning Random Forest Model
        // Prioritaskan hasil verdict ESP32 jika ditandai dari antrean (High/Medium/Low)
        const mlVerdict = queuedTestItem?.final_verdict || null;
        const calculatedRisk = riskCategoryFromML(mlVerdict, tdsVal, turbVal);
        const ars = computeRiskScore(mlVerdict, tdsVal, turbVal);

        let riskLevel = calculatedRisk.level;
        let category = 'Sangat Rendah (Aman)';
        let advice = 'Kondisi air relatif aman digunakan. Tetap disarankan merebus sebelum dikonsumsi langsung.';

        if (riskLevel === 'veryhigh') {
            category = 'Sangat Tinggi (Bahaya)';
            advice = 'Air sangat berisiko, sebaiknya dihindari dan diuji di laboratorium.';
        } else if (riskLevel === 'high') {
            category = 'Tinggi (Bahaya)';
            advice = 'Air berisiko tinggi. Tidak disarankan digunakan tanpa pengolahan/penyaringan.';
        } else if (riskLevel === 'moderate') {
            category = 'Sedang';
            advice = 'Perlu kewaspadaan. Parameter menunjukkan sedikit peningkatan kekeruhan/padatan terlarut.';
        }

        const newId = `site-${Date.now()}`;
        const savedTime = selectedEspTimestamp || 'Baru saja (Ditandai)';

        const newSite = {
            id: newId,
            name: newSiteName,
            source: `Sumber Custom`,
            keterangan: newSiteKeterangan || `Pengujian Titik Jelajah`,
            lat: newSiteLat,
            lng: newSiteLng,
            tds: tdsVal,
            turbidity: turbVal,
            ari: Math.round((ars / 20) * 100) / 100,
            assScore: ars,
            category: category,
            riskLevel: riskLevel,
            timestamp: savedTime,
            timestamp_esp: selectedEspTimestamp,
            test_id: selectedTestId,
            method: locationMethod === 'gps' ? 'GPS Hotspot HP (Auto-Detect)' : 'Pin Manual Peta (Grab Style)',
            device: 'ESP32_AquaSentry',
            advice: advice,
            notes: `Pengujian sampel air dengan model Random Forest (${tdsVal} mg/L, ${turbVal} NTU).`
        };

        const updatedSites = [...sites.filter(item => item.name !== newSiteName), newSite];
        setSites(updatedSites);
        setSelectedSite(newSite);
        setIsAddModalOpen(false);
        setModalStep(1);

        // Hapus dari antrean lokal seketika
        if (selectedTestId) {
            setPendingQueue(prev => prev.filter(item => item.test_id !== selectedTestId));
        }

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

        setSelectedTestId(null);
        setSelectedEspTimestamp(null);
        setQueuedTestItem(null);
        setSelectedHistoryIndex('live');
        setNewSiteName('');
        setNewSiteKeterangan('');
    };

    // State & Handlers untuk Edit & Hapus Titik Lokasi
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingSite, setEditingSite] = useState(null);

    const handleOpenEdit = (site) => {
        setEditingSite(site);
        setIsEditModalOpen(true);
    };

    const handleSaveEdit = async (siteId, updatedData) => {
        try {
            const res = await updateLocation(siteId, updatedData);
            if (res && res.ok) {
                const updatedList = res.all_locations || sites.map(s => s.id === siteId ? res.data : s);
                setSites(updatedList);
                if (selectedSite?.id === siteId) {
                    setSelectedSite(res.data);
                }
                localStorage.setItem('aquasentry_locations', JSON.stringify(updatedList));
            }
        } catch (err) {
            console.error("Gagal update lokasi:", err);
            throw err;
        }
    };

    const handleDeleteSite = async (siteId) => {
        try {
            const res = await deleteLocation(siteId);
            if (res && res.ok) {
                const updatedList = res.all_locations || sites.filter(s => s.id !== siteId);
                setSites(updatedList);
                if (selectedSite?.id === siteId) {
                    setSelectedSite(updatedList[0] || null);
                }
                localStorage.setItem('aquasentry_locations', JSON.stringify(updatedList));
            }
        } catch (err) {
            console.error("Gagal hapus lokasi:", err);
            throw err;
        }
    };

    const filteredSites = sites.filter(s => {
        if (riskFilter === 'all') return true;
        if (riskFilter === 'low') return s.riskLevel === 'low';
        if (riskFilter === 'moderate') return s.riskLevel === 'moderate' || s.riskLevel === 'high';
        if (riskFilter === 'veryhigh') return s.riskLevel === 'veryhigh';
        return true;
    });

    return (
        <div className="space-y-4 sm:space-y-6 animate-fade-in">
            {/* Header Banner */}
            <div className="bg-white border border-gray-100 p-4 sm:p-6 rounded-2xl sm:rounded-3xl shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="material-symbols-outlined text-aqua-primary text-xl sm:text-2xl">map</span>
                        <span className="text-[10px] font-black uppercase tracking-widest text-aqua-primary">GenZ Traveler & Mobile Hotspot Tracker</span>
                    </div>
                    <h1 className="text-xl sm:text-2xl font-black text-aqua-text tracking-tight">
                        Peta Pengujian & Penandaan Lokasi Sampel Air
                    </h1>
                    <p className="text-[11px] sm:text-xs text-aqua-text-muted mt-1 font-medium">
                        Deteksi otomatis koordinat lokasi dari Hotspot HP Anda atau tandai lokasi persis di peta.
                    </p>
                </div>

                <div className="grid grid-cols-1 sm:flex sm:items-center gap-2.5 sm:gap-3 w-full md:w-auto">
                    {/* Tombol Pembuka Floating Slide Drawer Antrean */}
                    <button
                        type="button"
                        onClick={() => setIsQueueDrawerOpen(true)}
                        className={`w-full sm:w-auto px-4 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl text-xs font-black shadow-xs transition-all flex items-center justify-center gap-2.5 cursor-pointer active:scale-95 ${
                            pendingQueue.length > 0
                                ? 'bg-gradient-to-r from-sky-50 to-blue-50 text-aqua-primary border border-aqua-primary/40 shadow-blue-100 hover:border-aqua-primary ring-2 ring-aqua-primary/10'
                                : 'bg-white hover:bg-gray-50 text-gray-600 border border-gray-200'
                        }`}
                        title="Buka panel antrean hasil uji ESP32"
                    >
                        <div className="relative flex items-center justify-center">
                            <span className="material-symbols-outlined text-lg">
                                {pendingQueue.length > 0 ? 'notifications_active' : 'inbox'}
                            </span>
                            {pendingQueue.length > 0 && (
                                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
                                </span>
                            )}
                        </div>
                        <span>Antrean Hasil Uji</span>
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            pendingQueue.length > 0
                                ? 'bg-aqua-primary text-white shadow-2xs'
                                : 'bg-gray-100 text-gray-500'
                        }`}>
                            {pendingQueue.length}
                        </span>
                    </button>

                    <button
                        onClick={handleOpenModal}
                        className="w-full sm:w-auto bg-aqua-primary text-white font-bold text-xs px-5 py-2.5 sm:py-3 rounded-xl sm:rounded-2xl shadow-xs hover:bg-aqua-primary/90 transition-all flex items-center justify-center gap-2 cursor-pointer active:scale-95"
                    >
                        <span className="material-symbols-outlined text-lg">add_location_alt</span>
                        Tandai Lokasi Uji Baru
                    </button>
                </div>
            </div>

            {/* Main Interactive Map & Details Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                {/* Left Area (2 Columns on Desktop) */}
                <div className="lg:col-span-2 space-y-4 flex flex-col">
                    {/* 1. MAP CANVAS */}
                    <MapCanvas
                        sites={sites}
                        riskFilter={riskFilter}
                        selectedSite={selectedSite}
                        onSelectSite={handleSelectSite}
                        onEditSite={handleOpenEdit}
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
                            onEditSite={handleOpenEdit}
                        />
                    </div>
                </div>

                {/* Selected Location Details Sidebar (Right Column) */}
                <div className="space-y-6">
                    <LocationDetailSidebar
                        selectedSite={selectedSite}
                        onEditSite={handleOpenEdit}
                        onDeleteSite={handleDeleteSite}
                    />
                </div>
            </div>

            {/* Gen Z Location Tagging Modal Wizard */}
            <LocationWizardModal
                isOpen={isAddModalOpen}
                onClose={() => {
                    setIsAddModalOpen(false);
                    setQueuedTestItem(null);
                    setSelectedHistoryIndex('live');
                }}
                queuedTestItem={queuedTestItem}
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

            {/* Modal Edit Titik Lokasi (Pencil UI) */}
            <EditLocationModal
                isOpen={isEditModalOpen}
                site={editingSite}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveEdit}
                onDelete={handleDeleteSite}
            />

            {/* Floating Slide Drawer Antrean Hasil Uji */}
            <PendingQueueDrawer
                isOpen={isQueueDrawerOpen}
                onClose={() => setIsQueueDrawerOpen(false)}
                queue={pendingQueue}
                onTagTest={handleTagQueueItem}
                onDismissTest={handleDismissQueueItem}
                onClearAll={handleClearAllQueue}
            />
        </div>
    );
}
