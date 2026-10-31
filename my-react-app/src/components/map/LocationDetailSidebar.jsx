import { getBadgeStyle } from './MapCanvas';

export default function LocationDetailSidebar({ selectedSite, onEditSite, onDeleteSite }) {
    if (!selectedSite) {
        return (
            <div className="bg-white border border-gray-100 p-8 rounded-3xl shadow-xs text-center space-y-3">
                <div className="w-12 h-12 bg-blue-50 text-aqua-primary rounded-2xl flex items-center justify-center mx-auto text-xl font-black">
                    <span className="material-symbols-outlined text-2xl">pin_drop</span>
                </div>
                <h4 className="text-sm font-black text-aqua-text">Belum Ada Lokasi Terpilih</h4>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">
                    Pilih salah satu titik lokasi pada peta atau daftar di bawah untuk melihat parameternya.
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
                    <span>Detail Lokasi</span>
                </div>
                <span className={`text-xs font-black px-3.5 py-1 rounded-full ${badge.bg} text-white shadow-xs`}>
                    {selectedSite.category}
                </span>
            </div>

            {/* Header: Nama Lokasi & Action Buttons */}
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        {selectedSite.no && (
                            <span className="w-6 h-6 rounded-full bg-slate-800 text-white text-xs font-black flex items-center justify-center shrink-0 shadow-sm">
                                {selectedSite.no}
                            </span>
                        )}
                        <h3 className="text-xl font-black text-aqua-text tracking-tight truncate">{selectedSite.name}</h3>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1.5 font-medium">
                        {selectedSite.sumber_air && (
                            <span className="bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded-md font-bold">
                                {selectedSite.sumber_air}
                            </span>
                        )}
                        <span className="font-mono text-[11px] text-gray-400">{selectedSite.lat}, {selectedSite.lng}</span>
                    </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        onClick={() => onEditSite && onEditSite(selectedSite)}
                        title="Edit Data Lokasi Ini"
                        className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white transition-all flex items-center gap-1.5 text-xs font-black cursor-pointer shadow-sm"
                    >
                        <span className="material-symbols-outlined text-sm">edit</span>
                        <span>Edit Data</span>
                    </button>
                    <button
                        onClick={() => onDeleteSite && onDeleteSite(selectedSite.id)}
                        title="Hapus Lokasi Ini"
                        className="p-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-500 hover:text-rose-600 transition-all flex items-center justify-center cursor-pointer shadow-2xs"
                    >
                        <span className="material-symbols-outlined text-base">delete</span>
                    </button>
                </div>
            </div>

            {/* Parameter Hasil Uji (TDS & Turbiditas) */}
            <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider">TDS (Padatan)</span>
                    <span className="text-xl font-black text-aqua-text mt-0.5 block">{selectedSite.tds}</span>
                    <span className="text-[10px] text-gray-400 font-medium">ppm (mg/L)</span>
                </div>

                <div className="bg-gray-50 border border-gray-100 p-3.5 rounded-2xl text-center">
                    <span className="text-[10px] font-bold text-gray-400 uppercase block tracking-wider">Turbiditas</span>
                    <span className="text-xl font-black text-aqua-text mt-0.5 block">{selectedSite.turbidity}</span>
                    <span className="text-[10px] text-gray-400 font-medium">NTU (Kekeruhan)</span>
                </div>
            </div>



            {/* Waktu Pengujian Asli dari ESP32 */}
            <div className="flex items-center gap-1.5 text-xs text-gray-500 pt-2 border-t border-gray-100">
                <span className="material-symbols-outlined text-sm text-aqua-primary">schedule</span>
                <span>Waktu Pengujian: <strong className="text-gray-700">{selectedSite.timestamp || 'Baru saja'}</strong></span>
            </div>
        </div>
    );
}
