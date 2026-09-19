import { getBadgeStyle } from './MapCanvas';

export default function LocationDetailSidebar({ selectedSite }) {
    if (!selectedSite) {
        return (
            <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-xs text-center space-y-3">
                <div className="w-12 h-12 bg-blue-50 text-aqua-primary rounded-2xl flex items-center justify-center mx-auto text-xl font-black">
                    <span className="material-symbols-outlined text-2xl">pin_drop</span>
                </div>
                <h4 className="text-sm font-black text-aqua-text">Belum Ada Lokasi Terpilih</h4>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    Klik tombol <span className="font-bold text-aqua-primary">+ Tandai Lokasi Baru</span> di bagian atas peta untuk menambahkan titik lokasi pemantauan air GenZ Anda.
                </p>
            </div>
        );
    }

    const badge = getBadgeStyle(selectedSite.riskLevel);

    return (
        <div className="bg-white border border-gray-100 p-6 rounded-3xl shadow-xs space-y-5">
            {/* Top Badge */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-gray-400 uppercase tracking-wider">
                    <span className="material-symbols-outlined text-base text-aqua-primary">pin_drop</span>
                    <span>Detail Lokasi Terpilih</span>
                </div>
                <span className={`text-xs font-black px-3.5 py-1 rounded-full ${badge.bg} text-white shadow-xs`}>
                    {selectedSite.category}
                </span>
            </div>

            {/* Location Header */}
            <div>
                <h3 className="text-xl font-black text-aqua-text tracking-tight">{selectedSite.name}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-400 mt-1 font-medium">
                    <span className="bg-blue-50 text-aqua-primary px-2.5 py-0.5 rounded-md font-bold">{selectedSite.keterangan}</span>
                    <span>-</span>
                    <span className="font-mono text-[11px]">{selectedSite.lat}, {selectedSite.lng}</span>
                </div>
            </div>

            {/* Device & Location Method Card */}
            <div className="bg-slate-50 border border-slate-100 p-3.5 rounded-2xl space-y-1.5 text-xs font-bold text-slate-700">
                <div className="flex items-center justify-between text-[11px]">
                    <span className="text-gray-400 font-medium">Metode Penentuan:</span>
                    <span className="text-aqua-primary">{selectedSite.method || 'GPS Hotspot HP'}</span>
                </div>
                <div className="flex items-center justify-between text-[11px] border-t border-slate-200/60 pt-1.5">
                    <span className="text-gray-400 font-medium">ID Alat / Koneksi:</span>
                    <span className="font-mono text-gray-600">{selectedSite.device || 'aquasentry-esp32-01'} (Hotspot 4G)</span>
                </div>
            </div>

            {/* Measured Parameters (TDS, Turbidity, ARI) */}
            <div className="grid grid-cols-3 gap-2 pt-1">
                <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">TDS</span>
                    <span className="text-base font-black text-aqua-text mt-0.5 block">{selectedSite.tds}</span>
                    <span className="text-[9px] text-gray-400 font-medium">mg/L</span>
                </div>

                <div className="bg-gray-50 border border-gray-100 p-3 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block">Turbiditas</span>
                    <span className="text-base font-black text-aqua-text mt-0.5 block">{selectedSite.turbidity}</span>
                    <span className="text-[9px] text-gray-400 font-medium">NTU</span>
                </div>

                <div className="bg-blue-50/80 border border-blue-100 p-3 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-aqua-primary uppercase block">Indeks ARI</span>
                    <span className="text-base font-black text-aqua-primary mt-0.5 block">{selectedSite.ari || '0.35'}</span>
                    <span className="text-[9px] text-aqua-primary/80 font-medium">Indeks Risiko</span>
                </div>
            </div>

            {/* ASS Safety Gauge Bar */}
            <div className="bg-gradient-to-r from-aqua-primary/10 via-blue-50 to-indigo-50 border border-aqua-primary/20 p-4 rounded-2xl space-y-2">
                <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-aqua-text">Skor Keselamatan (ASS)</span>
                    <span className="font-black text-aqua-primary text-sm">{selectedSite.assScore} / 100</span>
                </div>
                <div className="w-full bg-gray-200 h-2.5 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-aqua-primary rounded-full transition-all duration-700"
                        style={{ width: `${Math.min(100, Math.max(0, selectedSite.assScore))}%` }}
                    ></div>
                </div>
            </div>

            {/* Actionable Usage & Health Recommendation */}
            <div className="bg-emerald-50/70 border border-emerald-100 p-3.5 rounded-2xl space-y-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">health_and_safety</span>
                    Rekomendasi Penggunaan
                </span>
                <p className="text-xs text-emerald-900 leading-relaxed font-medium">
                    {selectedSite.advice || 'Kondisi air relatif aman. Disarankan merebus air sebelum dikonsumsi.'}
                </p>
            </div>

            {/* Field Notes */}
            <div className="text-xs text-gray-600 bg-gray-50 p-3.5 rounded-2xl border border-gray-100 space-y-1">
                <span className="font-bold text-gray-400 text-[10px] uppercase block">Catatan Lapangan</span>
                <p className="leading-relaxed">{selectedSite.notes}</p>
            </div>

            <div className="text-[11px] text-gray-400 text-center font-medium border-t border-gray-100 pt-3">
                Pengujian Terakhir: <span className="font-bold text-gray-700">{selectedSite.timestamp}</span>
            </div>
        </div>
    );
}
