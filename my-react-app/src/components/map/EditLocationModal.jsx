import { useState, useEffect } from 'react';
import { riskCategoryFromML, computeRiskScore } from '../../hooks/useTelemetry';

export default function EditLocationModal({
    isOpen,
    site,
    onClose,
    onSave,
    onDelete
}) {
    const [name, setName] = useState('');
    const [keterangan, setKeterangan] = useState('');
    const [tds, setTds] = useState(85);
    const [turbidity, setTurbidity] = useState(15);
    const [lat, setLat] = useState(-7.9525);
    const [lng, setLng] = useState(112.6145);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (site) {
            setName(site.name || '');
            setKeterangan(site.keterangan || '');
            setTds(site.tds ?? 85);
            setTurbidity(site.turbidity ?? 15);
            setLat(site.lat ?? -7.9525);
            setLng(site.lng ?? 112.6145);
        }
    }, [site]);

    if (!isOpen || !site) return null;

    // Real-time preview of ML classification
    const tdsVal = parseFloat(tds) || 0;
    const turbVal = parseFloat(turbidity) || 0;
    const previewRisk = riskCategoryFromML(null, tdsVal, turbVal);
    const previewScore = computeRiskScore(null, tdsVal, turbVal);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsSubmitting(true);
        try {
            await onSave(site.id, {
                ...site,
                name: name.trim(),
                keterangan: keterangan.trim(),
                tds: tdsVal,
                turbidity: turbVal,
                lat: parseFloat(lat),
                lng: parseFloat(lng),
                assScore: previewScore
            });
            onClose();
        } catch (err) {
            alert('Gagal menyimpan perubahan: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async () => {
        if (window.confirm(`Apakah Anda yakin ingin menghapus lokasi "${site.name}"?`)) {
            setIsSubmitting(true);
            try {
                await onDelete(site.id);
                onClose();
            } catch (err) {
                alert('Gagal menghapus lokasi: ' + err.message);
            } finally {
                setIsSubmitting(false);
            }
        }
    };

    return (
        <div className="fixed inset-0 z-[400] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-100 max-h-[92vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-2xl bg-blue-50 text-aqua-primary flex items-center justify-center">
                            <span className="material-symbols-outlined text-lg">edit</span>
                        </div>
                        <div>
                            <h3 className="text-base font-black text-aqua-text">Edit Titik Lokasi</h3>
                            <p className="text-[11px] text-gray-400">Perbarui informasi dan parameter sampel air</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 text-gray-500 flex items-center justify-center transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-sm">close</span>
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* Live ML Prediction Badge Preview */}
                    <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl flex items-center justify-between">
                        <span className="text-xs font-bold text-gray-500">Prediksi Machine Learning:</span>
                        <span
                            className="text-xs font-black px-3.5 py-1 rounded-full text-white shadow-xs"
                            style={{ backgroundColor: previewRisk.color }}
                        >
                            {previewRisk.label}
                        </span>
                    </div>

                    {/* Nama Lokasi */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-aqua-primary">label</span>
                            Nama Titik Lokasi
                        </label>
                        <input
                            type="text"
                            required
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Contoh: Kos Fawwas, Sumber Air A, dll."
                            className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-bold text-aqua-text focus:outline-none focus:ring-2 focus:ring-aqua-primary/30"
                        />
                    </div>

                    {/* Catatan / Keterangan */}
                    <div className="space-y-1">
                        <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                            <span className="material-symbols-outlined text-sm text-aqua-primary">description</span>
                            Catatan Lapangan / Keterangan
                        </label>
                        <input
                            type="text"
                            value={keterangan}
                            onChange={(e) => setKeterangan(e.target.value)}
                            placeholder="Contoh: uaman polll, jernih, bau tanah, dll."
                            className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-medium text-aqua-text focus:outline-none focus:ring-2 focus:ring-aqua-primary/30"
                        />
                    </div>

                    {/* Parameter Sensor: TDS & Turbidity */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-aqua-primary">opacity</span>
                                TDS (mg/L / ppm)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="1000"
                                value={tds}
                                onChange={(e) => setTds(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-bold text-aqua-text focus:outline-none focus:ring-2 focus:ring-aqua-primary/30"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700 flex items-center gap-1">
                                <span className="material-symbols-outlined text-sm text-aqua-primary">blur_on</span>
                                Turbidity (NTU)
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0"
                                max="600"
                                value={turbidity}
                                onChange={(e) => setTurbidity(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-bold text-aqua-text focus:outline-none focus:ring-2 focus:ring-aqua-primary/30"
                            />
                        </div>
                    </div>

                    {/* Koordinat Lat & Lng */}
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700">Latitude</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={lat}
                                onChange={(e) => setLat(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-aqua-primary/30"
                            />
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-bold text-gray-700">Longitude</label>
                            <input
                                type="number"
                                step="0.0001"
                                value={lng}
                                onChange={(e) => setLng(e.target.value)}
                                className="w-full px-3.5 py-2.5 bg-gray-50/80 border border-gray-200 rounded-xl text-xs font-mono text-gray-700 focus:outline-none focus:ring-2 focus:ring-aqua-primary/30"
                            />
                        </div>
                    </div>

                    {/* Footer Action Buttons */}
                    <div className="pt-3 border-t border-gray-100 flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={handleDelete}
                            disabled={isSubmitting}
                            className="px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-base">delete</span>
                            Hapus
                        </button>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                            >
                                Batal
                            </button>
                            <button
                                type="submit"
                                disabled={isSubmitting}
                                className="px-5 py-2 bg-aqua-primary hover:bg-aqua-primary-hover text-white rounded-xl text-xs font-black shadow-md shadow-aqua-primary/20 transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                            >
                                <span className="material-symbols-outlined text-sm">check</span>
                                {isSubmitting ? 'Menyimpan...' : 'Simpan Perubahan'}
                            </button>
                        </div>
                    </div>
                </form>
            </div>
        </div>
    );
}
