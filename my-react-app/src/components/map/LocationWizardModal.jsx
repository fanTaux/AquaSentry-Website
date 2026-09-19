import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';

export default function LocationWizardModal({
    isOpen,
    onClose,
    modalStep,
    setModalStep,
    locationMethod,
    setLocationMethod,
    newSiteName,
    setNewSiteName,
    newSiteKeterangan,
    setNewSiteKeterangan,
    newSiteLat,
    setNewSiteLat,
    newSiteLng,
    setNewSiteLng,
    selectedHistoryIndex,
    setSelectedHistoryIndex,
    newSiteTds,
    setNewSiteTds,
    newSiteTurb,
    setNewSiteTurb,
    isDetectingGps,
    gpsStatusMessage,
    onDetectLocation,
    onSubmit,
    reading,
    history
}) {
    const pickerMapContainerRef = useRef(null);
    const pickerMapInstanceRef = useRef(null);

    // Toggle mode: 'sensor' (Gunakan Rekaman Data Sensor) vs 'manual' (Input Sendiri)
    const [paramSourceMode, setParamSourceMode] = useState('sensor');

    // Interactive Pin Picker Map in Modal (Grab/Shopee Style)
    useEffect(() => {
        if (!isOpen || locationMethod !== 'manual') return;

        const timer = setTimeout(() => {
            if (!pickerMapContainerRef.current) return;
            if (pickerMapInstanceRef.current) {
                pickerMapInstanceRef.current.remove();
                pickerMapInstanceRef.current = null;
            }

            const pMap = L.map(pickerMapContainerRef.current, {
                center: [newSiteLat, newSiteLng],
                zoom: 13,
                zoomControl: false
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19
            }).addTo(pMap);

            const pMarker = L.marker([newSiteLat, newSiteLng], { draggable: true }).addTo(pMap);

            pMarker.on('dragend', (e) => {
                const pos = e.target.getLatLng();
                setNewSiteLat(parseFloat(pos.lat.toFixed(4)));
                setNewSiteLng(parseFloat(pos.lng.toFixed(4)));
            });

            pMap.on('click', (e) => {
                pMarker.setLatLng(e.latlng);
                setNewSiteLat(parseFloat(e.latlng.lat.toFixed(4)));
                setNewSiteLng(parseFloat(e.latlng.lng.toFixed(4)));
            });

            pickerMapInstanceRef.current = pMap;
        }, 150);

        return () => {
            clearTimeout(timer);
            if (pickerMapInstanceRef.current) {
                pickerMapInstanceRef.current.remove();
                pickerMapInstanceRef.current = null;
            }
        };
    }, [isOpen, locationMethod, modalStep, newSiteLat, newSiteLng, setNewSiteLat, setNewSiteLng]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-5 border border-gray-100">
                {/* Step Progress Indicator */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-aqua-primary text-white font-black text-xs flex items-center justify-center">
                            {modalStep}
                        </div>
                        <div>
                            <h3 className="text-base font-black text-aqua-text">
                                {modalStep === 1 ? '1. Pilih Metode Penentuan Lokasi' : '2. Konfirmasi & Tandai Lokasi'}
                            </h3>
                            <p className="text-[11px] text-gray-400">Langkah {modalStep} dari 2</p>
                        </div>
                    </div>

                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-400 cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-lg">close</span>
                    </button>
                </div>

                {/* STEP 1: Select Location Method */}
                {modalStep === 1 && (
                    <div className="space-y-4">
                        <p className="text-xs text-aqua-text-muted font-medium">
                            Pilih bagaimana Anda ingin menentukan lokasi pengujian sampel air saat ini:
                        </p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {/* Option A: Auto GPS Hotspot */}
                            <div
                                onClick={() => {
                                    setLocationMethod('gps');
                                    onDetectLocation();
                                }}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2 ${locationMethod === 'gps' ? 'border-aqua-primary bg-aqua-primary/5 shadow-sm' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                            >
                                <div className="w-10 h-10 rounded-xl bg-blue-50 text-aqua-primary flex items-center justify-center font-bold">
                                    <span className="material-symbols-outlined text-2xl">my_location</span>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-aqua-text flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm text-aqua-primary">my_location</span>
                                        Auto GPS / Hotspot
                                    </h4>
                                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                        Otomatis menggunakan lokasi GPS HP / Laptop yang terhubung hotspot.
                                    </p>
                                </div>
                            </div>

                            {/* Option B: Grab/Shopee Style Manual Pin */}
                            <div
                                onClick={() => setLocationMethod('manual')}
                                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer space-y-2 ${locationMethod === 'manual' ? 'border-aqua-primary bg-aqua-primary/5 shadow-sm' : 'border-gray-100 bg-gray-50 hover:bg-gray-100'}`}
                            >
                                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                                    <span className="material-symbols-outlined text-2xl">pin_drop</span>
                                </div>
                                <div>
                                    <h4 className="text-xs font-black text-aqua-text flex items-center gap-1.5">
                                        <span className="material-symbols-outlined text-sm text-indigo-600">pin_drop</span>
                                        Tandai Peta (Grab Style)
                                    </h4>
                                    <p className="text-[11px] text-gray-500 mt-1 leading-relaxed">
                                        Pilih & geser pin langsung di peta mini seperti memilih alamat kirim.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {locationMethod === 'gps' && (
                            <div className="bg-blue-50/70 border border-blue-100 p-4 rounded-2xl space-y-2">
                                <div className="flex items-center justify-between text-xs font-bold text-aqua-primary">
                                    <span>Sinyal GPS Hotspot Terhubung</span>
                                    <button
                                        type="button"
                                        onClick={onDetectLocation}
                                        disabled={isDetectingGps}
                                        className="hover:underline flex items-center gap-1 text-[11px] cursor-pointer"
                                    >
                                        <span className={`material-symbols-outlined text-sm ${isDetectingGps ? 'animate-spin' : ''}`}>refresh</span>
                                        Detect ulang
                                    </button>
                                </div>
                                <p className="text-xs text-gray-700 font-medium">
                                    {gpsStatusMessage || 'Mendeteksi posisi presisi dari HP...'}
                                </p>
                            </div>
                        )}

                        {locationMethod === 'manual' && (
                            <div className="space-y-1.5">
                                <span className="text-xs font-bold text-gray-600 block">Geser Marker Di Peta Mini:</span>
                                <div className="relative w-full h-44 rounded-2xl overflow-hidden border border-gray-200 shadow-inner">
                                    <div ref={pickerMapContainerRef} className="w-full h-full" />
                                </div>
                                <p className="text-[11px] font-mono text-center text-gray-500 font-bold">
                                    Koordinat Terpilih: {newSiteLat}, {newSiteLng}
                                </p>
                            </div>
                        )}

                        <div className="pt-2 flex justify-end">
                            <button
                                type="button"
                                onClick={() => setModalStep(2)}
                                className="w-full py-3 bg-aqua-primary text-white rounded-xl font-bold text-xs hover:bg-aqua-primary/90 shadow-sm transition-all cursor-pointer flex items-center justify-center gap-2"
                            >
                                <span>Lanjut ke Konfirmasi Nama & Parameter</span>
                                <span className="material-symbols-outlined text-sm">arrow_forward</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: Input Details & Parameter Source Mode Selection */}
                {modalStep === 2 && (
                    <form onSubmit={onSubmit} className="space-y-4">
                        <div className="bg-slate-50 border border-slate-100 p-3 rounded-xl flex items-center justify-between text-xs font-bold text-slate-700">
                            <span className="flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-sm text-aqua-primary">tune</span>
                                Metode: <span className="text-aqua-primary">{locationMethod === 'gps' ? 'Auto GPS Hotspot' : 'Pin Manual Peta'}</span>
                            </span>
                            <span className="font-mono text-gray-500 text-[11px]">{newSiteLat}, {newSiteLng}</span>
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">Nama Lokasi Sampel Air</label>
                            <input
                                type="text"
                                placeholder="Contoh: Air Terjun Tegenungan, Gianyar"
                                value={newSiteName}
                                onChange={(e) => setNewSiteName(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-aqua-primary focus:ring-1 focus:ring-aqua-primary"
                                required
                            />
                        </div>

                        <div>
                            <label className="text-[11px] font-bold text-gray-600 block mb-1">Keterangan / Catatan Titik Sampel</label>
                            <input
                                type="text"
                                placeholder="Contoh: Mata air jernih dekat warung / area arung jeram"
                                value={newSiteKeterangan}
                                onChange={(e) => setNewSiteKeterangan(e.target.value)}
                                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-aqua-primary focus:ring-1 focus:ring-aqua-primary"
                            />
                        </div>

                        {/* PARAMETER SOURCE SELECTION (MODE TAB: SENSOR vs MANUAL) */}
                        <div className="space-y-3 bg-blue-50/60 border border-blue-100 p-3.5 rounded-2xl">
                            <label className="text-[11px] font-bold text-aqua-primary uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-symbols-outlined text-base">sensors</span>
                                Sumber Hasil Parameter Air
                            </label>

                            {/* Mode Switcher Buttons */}
                            <div className="grid grid-cols-2 gap-2 bg-white/90 p-1 rounded-xl border border-blue-100">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setParamSourceMode('sensor');
                                        setSelectedHistoryIndex('live');
                                        if (reading) {
                                            setNewSiteTds(reading.tds);
                                            setNewSiteTurb(reading.turbidity);
                                        }
                                    }}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${paramSourceMode === 'sensor' ? 'bg-aqua-primary text-white shadow-xs' : 'text-gray-500 hover:text-gray-700 bg-transparent'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">sensors</span>
                                    <span>Data Sensor Teruji</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setParamSourceMode('manual');
                                        setSelectedHistoryIndex('custom');
                                    }}
                                    className={`py-2 px-3 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${paramSourceMode === 'manual' ? 'bg-aqua-primary text-white shadow-xs' : 'text-gray-500 hover:text-gray-700 bg-transparent'}`}
                                >
                                    <span className="material-symbols-outlined text-sm">edit</span>
                                    <span>Input Manual Sendiri</span>
                                </button>
                            </div>

                            {/* MODE A: SELECT FROM RECORDED TELEMETRY SENSOR DATA */}
                            {paramSourceMode === 'sensor' && (
                                <div className="space-y-2 pt-1">
                                    <label className="text-[10px] font-bold text-gray-500 uppercase block">Pilih Rekaman Telemetri Sensor:</label>
                                    <select
                                        value={selectedHistoryIndex}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setSelectedHistoryIndex(val);
                                            if (val === 'live' && reading) {
                                                setNewSiteTds(reading.tds);
                                                setNewSiteTurb(reading.turbidity);
                                            } else {
                                                const idx = parseInt(val, 10);
                                                if (!isNaN(idx) && history[idx]) {
                                                    setNewSiteTds(history[idx].tds);
                                                    setNewSiteTurb(history[idx].turbidity);
                                                }
                                            }
                                        }}
                                        className="w-full bg-white border border-blue-200 text-aqua-text font-bold text-xs p-2.5 rounded-xl focus:outline-none focus:border-aqua-primary cursor-pointer shadow-xs"
                                    >
                                        <option value="live">
                                            [Live Sensor] TDS: {reading?.tds || 110} mg/L, Turbiditas: {reading?.turbidity || 0.5} NTU
                                        </option>
                                        {history.length > 0 && (
                                            history.slice().reverse().map((item, idx) => {
                                                const timeStr = new Date(item.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                                                return (
                                                    <option key={idx} value={history.length - 1 - idx}>
                                                        [History {timeStr}] TDS: {item.tds} mg/L, Turbiditas: {item.turbidity} NTU ({item.risk?.label})
                                                    </option>
                                                );
                                            })
                                        )}
                                    </select>

                                    {/* Read-Only Parameter Preview Badges */}
                                    <div className="grid grid-cols-2 gap-3 pt-1">
                                        <div className="bg-white/90 p-2.5 rounded-xl border border-blue-100 text-center">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase block">TDS Terpilih</span>
                                            <span className="text-sm font-black text-aqua-text">{newSiteTds} mg/L</span>
                                        </div>
                                        <div className="bg-white/90 p-2.5 rounded-xl border border-blue-100 text-center">
                                            <span className="text-[9px] font-bold text-gray-400 uppercase block">Turbiditas Terpilih</span>
                                            <span className="text-sm font-black text-aqua-text">{newSiteTurb} NTU</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* MODE B: TYPE CUSTOM VALUES MANUALLY */}
                            {paramSourceMode === 'manual' && (
                                <div className="space-y-2 pt-1">
                                    <span className="text-[10px] font-bold text-gray-500 uppercase block">Ketik Sendiri Nilai Parameter Air:</span>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">TDS Terukur (mg/L)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={newSiteTds}
                                                onChange={(e) => setNewSiteTds(e.target.value)}
                                                className="w-full bg-white px-3 py-2 rounded-xl border border-blue-200 text-xs font-mono font-bold text-aqua-text focus:outline-none focus:border-aqua-primary"
                                                placeholder="120"
                                                required
                                            />
                                        </div>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1">Turbiditas (NTU)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={newSiteTurb}
                                                onChange={(e) => setNewSiteTurb(e.target.value)}
                                                className="w-full bg-white px-3 py-2 rounded-xl border border-blue-200 text-xs font-mono font-bold text-aqua-text focus:outline-none focus:border-aqua-primary"
                                                placeholder="1.2"
                                                required
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="flex items-center gap-3 pt-2">
                            <button
                                type="button"
                                onClick={() => setModalStep(1)}
                                className="py-2.5 px-4 border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer flex items-center gap-1"
                            >
                                <span className="material-symbols-outlined text-sm">arrow_back</span>
                                Kembali
                            </button>
                            <button
                                type="submit"
                                className="flex-1 py-2.5 bg-aqua-primary text-white rounded-xl font-bold text-xs hover:bg-aqua-primary/90 shadow-sm transition-all cursor-pointer"
                            >
                                Simpan & Tandai Pin Di Peta
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
