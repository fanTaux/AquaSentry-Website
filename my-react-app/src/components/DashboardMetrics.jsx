import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

const riskCopy = {
    low: {
        title: 'Air relatif aman digunakan',
        advice: 'Kondisi fisika-kimia air berada pada rentang normal. Tetap disarankan merebus air sebelum dikonsumsi langsung.',
        recommendations: ['Aman untuk mencuci tangan, wudu, dan kebutuhan bersih-bersih', 'Tetap rebus sebelum dikonsumsi langsung'],
    },
    moderate: {
        title: 'Perlu kewaspadaan',
        advice: 'Ada indikasi penyimpangan ringan pada parameter yang diukur. Gunakan dengan hati-hati untuk kebutuhan non-konsumsi.',
        recommendations: ['Hindari konsumsi langsung tanpa direbus', 'Perhatikan perubahan warna/bau air secara berkala'],
    },
    high: {
        title: 'Air berisiko, tidak disarankan digunakan tanpa penanganan',
        advice: 'Parameter fisika-kimia menunjukkan penyimpangan signifikan dari ambang batas WHO/Permenkes.',
        recommendations: ['Rebus air sebelum digunakan untuk kebutuhan apa pun', 'Cari sumber air alternatif bila memungkinkan'],
    },
    veryhigh: {
        title: 'Air sangat berisiko, sebaiknya dihindari',
        advice: 'Indikasi risiko sangat tinggi. AquaSentry adalah alat skrining dini, bukan pengganti pengujian laboratorium.',
        recommendations: ['Hindari penggunaan langsung', 'Lakukan pengujian laboratorium bila air ini menjadi satu-satunya sumber'],
    },
};

const ITEMS_PER_PAGE = 5;

export default function DashboardMetrics() {
    const {
        state,
        history,
        clearHistory,
        isDeviceOnline,
        isTesting,
        testElapsedSec,
        finalVerdict,
        sendCommand,
        aiPrediction
    } = useAppContext();
    const [selectedReading, setSelectedReading] = useState(null);
    const [pageIndex, setPageIndex] = useState(1);
    const [isActionLoading, setIsActionLoading] = useState(false);
    const [actionFeedback, setActionFeedback] = useState('');

    const { tds, turbidity, ars, risk, lastUpdate } = state;
    const copy = riskCopy[risk.level] || riskCopy.low;

    const handleClearHistory = async () => {
        if (window.confirm('Apakah Anda yakin ingin mengosongkan semua riwayat pengukuran?')) {
            if (clearHistory) await clearHistory();
            setPageIndex(1);
        }
    };

    const lastUpdateLabel = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '-';

    const elapsed = Math.min(Math.max(testElapsedSec || 0, 0), 30);
    const progressPercent = Math.round((elapsed / 30) * 100);
    const remainingSec = Math.max(0, 30 - elapsed);

    const handleStartTest = async () => {
        setIsActionLoading(true);
        setActionFeedback('Mengirim sinyal mulai ke ESP32...');
        try {
            await sendCommand({ command: 'START_TEST' });
            setTimeout(() => setActionFeedback(''), 3000);
        } catch (err) {
            setActionFeedback('Gagal: ' + err.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleCancelTest = async () => {
        setIsActionLoading(true);
        setActionFeedback('Membatalkan pengujian...');
        try {
            await sendCommand({ command: 'CANCEL_TEST' });
            setTimeout(() => setActionFeedback(''), 3000);
        } catch (err) {
            setActionFeedback('Gagal: ' + err.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    // Evaluasi status kualitas air dengan warna & teks semantik yang tepat
    const effectiveVerdict = (finalVerdict || aiPrediction || risk.level || 'Low').toLowerCase();
    const isHigh = effectiveVerdict.includes('high') || effectiveVerdict.includes('keruh') || effectiveVerdict.includes('buruk');
    const isMedium = effectiveVerdict.includes('med') || effectiveVerdict.includes('moderate') || effectiveVerdict.includes('sedang');

    const riskInfo = isHigh ? {
        level: 'high',
        badgeText: 'High Risk (Air Keruh / Berisiko)',
        badgeBg: 'bg-rose-50 text-rose-700 border-rose-200',
        iconBg: 'bg-rose-100 text-rose-600',
        icon: 'warning',
        title: 'Kualitas Air Buruk & Berisiko Tinggi',
        desc: 'Parameter TDS atau Kekeruhan air melebihi ambang batas baku mutu. Sangat tidak disarankan untuk dikonsumsi langsung tanpa pengolahan intensif.',
    } : isMedium ? {
        level: 'moderate',
        badgeText: 'Medium Risk (Air Sedang)',
        badgeBg: 'bg-amber-50 text-amber-700 border-amber-200',
        iconBg: 'bg-amber-100 text-amber-600',
        icon: 'info',
        title: 'Kualitas Air Sedang — Perlu Filtrasi',
        desc: 'Terdapat kandungan partikel terlarut atau kekeruhan sedang. Disarankan melakukan pengendapan, filtrasi, atau perebusan sebelum dikonsumsi.',
    } : {
        level: 'low',
        badgeText: 'Low Risk (Air Bersih & Aman)',
        badgeBg: 'bg-emerald-50 text-emerald-700 border-emerald-200',
        iconBg: 'bg-emerald-100 text-emerald-600',
        icon: 'check_circle',
        title: 'Kualitas Air Baik & Rendah Risiko',
        desc: 'Parameter fisika-kimia berada dalam batas baku mutu aman Permenkes RI. Air relatif bersih dan layak untuk kebutuhan domestik.',
    };

    return (
        <div className="space-y-4 sm:space-y-6 pb-6 sm:pb-8 animate-fade-in">
            {/* MASTER UNIFIED HERO CARD: PENGUJIAN SENSOR + STATUS KLASIFIKASI KUALITAS AIR */}
            <section className="bg-white rounded-2xl sm:rounded-3xl p-4 sm:p-6 md:p-8 border border-gray-100 shadow-xs space-y-4 sm:space-y-6">
                {/* 1. HEADER: Icon + Judul Pengujian + Status Konektivitas + Tombol Aksi */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 sm:pb-5 border-b border-gray-100">
                    <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center flex-shrink-0 shadow-xs mt-0.5 sm:mt-0">
                            <span className="material-symbols-outlined text-xl sm:text-2xl">science</span>
                        </div>
                        <div className="min-w-0">
                            <h2 className="text-sm sm:text-base md:text-xl font-black text-aqua-text tracking-tight leading-snug">
                                Pengujian Sensor & Klasifikasi Kualitas Air
                            </h2>
                            <div className="flex items-center gap-1.5 sm:gap-2 mt-1 flex-wrap">
                                <span className={`w-2 h-2 rounded-full shrink-0 ${
                                    !isDeviceOnline ? 'bg-gray-400' : isTesting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                                }`} />
                                <span className={`text-[11px] sm:text-xs font-bold ${
                                    !isDeviceOnline ? 'text-gray-400' : isTesting ? 'text-amber-600 font-extrabold' : 'text-emerald-700'
                                }`}>
                                    {!isDeviceOnline ? 'ESP32 Offline' : isTesting ? `Menguji (${elapsed}s / 30s)` : 'ESP32 Siap (Standby)'}
                                </span>
                                <span className="text-gray-300 hidden xs:inline">&bull;</span>
                                <span className="text-[10px] sm:text-xs text-aqua-text-muted font-medium">Update: {lastUpdateLabel}</span>
                            </div>
                        </div>
                    </div>

                    {/* Tombol Mulai / Batalkan Pengujian */}
                    <div className="flex flex-col sm:items-end gap-1.5 w-full sm:w-auto">
                        {!isTesting ? (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleStartTest}
                                className="w-full sm:w-auto bg-aqua-primary hover:bg-aqua-primary-hover active:scale-98 text-white text-xs font-black uppercase tracking-wider py-3 sm:py-3.5 px-5 sm:px-7 rounded-xl sm:rounded-2xl shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <span className="material-symbols-outlined text-lg sm:text-xl">play_arrow</span>
                                <span>Mulai Pengujian (30 Detik)</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                disabled={isActionLoading}
                                onClick={handleCancelTest}
                                className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 active:scale-98 text-rose-700 border border-rose-200 text-xs font-black uppercase tracking-wider py-3 sm:py-3.5 px-5 sm:px-7 rounded-xl sm:rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-lg sm:text-xl">close</span>
                                <span>Batalkan Pengujian ({remainingSec}s)</span>
                            </button>
                        )}
                        {actionFeedback && (
                            <span className="text-[10px] sm:text-[11px] font-bold text-aqua-text-muted animate-fade-in text-center sm:text-right">{actionFeedback}</span>
                        )}
                    </div>
                </div>

                {/* 2. PROGRESS BAR KETIKA PENGUJIAN 30 DETIK AKTIF */}
                {isTesting && (
                    <div className="bg-sky-50/50 border border-sky-100 rounded-xl sm:rounded-2xl p-3.5 sm:p-4 space-y-2 animate-fade-in">
                        <div className="flex justify-between items-center text-xs font-extrabold text-aqua-text">
                            <span className="flex items-center gap-1.5 text-sky-800 text-[11px] sm:text-xs min-w-0 truncate">
                                <span className="material-symbols-outlined text-base animate-spin shrink-0">sync</span>
                                <span className="truncate">Edge AI Menganalisis Sampel Air...</span>
                            </span>
                            <span className="font-mono text-sky-900 bg-sky-100 px-2 py-0.5 rounded-lg text-xs shrink-0">{elapsed}s / 30s</span>
                        </div>
                        <div className="w-full h-2 sm:h-2.5 bg-slate-200/80 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-sky-500 via-blue-600 to-indigo-600 transition-all duration-300 rounded-full"
                                style={{ width: `${progressPercent}%` }}
                            />
                        </div>
                        <div className="flex justify-between text-[10px] sm:text-[11px] text-aqua-text-muted font-bold">
                            <span>Voting Sementara: {aiPrediction}</span>
                            <span>Sisa: {remainingSec}s</span>
                        </div>
                    </div>
                )}

                {/* 3. HASIL STATUS KLASIFIKASI KUALITAS AIR */}
                <div className={`p-4 sm:p-5 rounded-xl sm:rounded-2xl border transition-all ${
                    riskInfo.level === 'high' ? 'bg-rose-50/70 border-rose-200' :
                    riskInfo.level === 'moderate' ? 'bg-amber-50/70 border-amber-200' :
                    'bg-emerald-50/70 border-emerald-200'
                }`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-3.5 sm:gap-4">
                        <div className="flex items-start sm:items-center gap-3 sm:gap-3.5 min-w-0">
                            <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl flex items-center justify-center flex-shrink-0 shadow-xs ${riskInfo.iconBg}`}>
                                <span className="material-symbols-outlined text-xl sm:text-2xl">{riskInfo.icon}</span>
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                    <span className={`px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-full text-[10px] sm:text-xs font-black uppercase tracking-wider border shadow-2xs ${riskInfo.badgeBg}`}>
                                        {riskInfo.badgeText}
                                    </span>
                                    {finalVerdict && !isTesting && (
                                        <span className="text-[10px] sm:text-[11px] font-bold text-slate-500">
                                            (Konsensus Hasil Uji 30 Detik)
                                        </span>
                                    )}
                                </div>
                                <h3 className="text-sm sm:text-base md:text-lg font-black text-slate-900 mt-1 leading-snug">
                                    {riskInfo.title}
                                </h3>
                            </div>
                        </div>

                        {/* MINI STAT CHIPS: TDS & Turbidity */}
                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:gap-2.5 shrink-0 pt-2.5 md:pt-0 border-t md:border-t-0 border-gray-200/50">
                            <div className="bg-white/80 border border-gray-200/80 rounded-xl px-3 py-1.5 sm:py-2 text-center sm:text-left shadow-2xs">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">TDS</span>
                                <span className="text-xs sm:text-base font-black text-slate-900">
                                    {Number(tds || 0).toFixed(0)} <span className="text-[10px] font-bold text-gray-500">ppm</span>
                                </span>
                            </div>
                            <div className="bg-white/80 border border-gray-200/80 rounded-xl px-3 py-1.5 sm:py-2 text-center sm:text-left shadow-2xs">
                                <span className="text-[9px] font-bold uppercase tracking-wider text-gray-500 block">Turbidity</span>
                                <span className="text-xs sm:text-base font-black text-slate-900">
                                    {Number(turbidity || 0).toFixed(1)} <span className="text-[10px] font-bold text-gray-500">NTU</span>
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

            </section>

            {/* RIWAYAT PENGUKURAN SECTION */}
            <div className="bg-white border border-gray-100 rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 sm:mb-5">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-aqua-primary text-lg sm:text-xl">history</span>
                            <h3 className="text-sm font-black text-aqua-text">Riwayat Pengukuran</h3>
                        </div>
                        <p className="text-[11px] sm:text-xs text-aqua-text-muted mt-0.5">Log data hasil pengujian kualitas air dari sensor</p>
                    </div>

                    {history && history.length > 0 && (
                        <button
                            type="button"
                            onClick={handleClearHistory}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200/80 flex items-center gap-1.5 text-[11px] sm:text-xs font-bold transition-all cursor-pointer hover:shadow-2xs active:scale-95 shrink-0 self-start sm:self-auto"
                            title="Hapus / Kosongkan Seluruh Riwayat Pengukuran"
                        >
                            <span className="material-symbols-outlined text-sm">delete_sweep</span>
                            <span>Hapus Riwayat</span>
                        </button>
                    )}
                </div>

                {(!history || history.length === 0) ? (
                    <div className="text-center py-8 sm:py-10 px-3 sm:px-4 bg-gray-50/70 rounded-xl sm:rounded-2xl border border-dashed border-gray-200 space-y-1.5 sm:space-y-2">
                        <span className="material-symbols-outlined text-2xl sm:text-3xl text-gray-300">history_toggle_off</span>
                        <p className="text-xs font-bold text-gray-600">Riwayat Pengukuran Kosong</p>
                        <p className="text-[10px] sm:text-[11px] text-gray-400">Belum ada data pengukuran atau riwayat baru saja dibersihkan.</p>
                    </div>
                ) : (
                    <>
                        {(() => {
                            const totalItems = history.length;
                            const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;
                            const safePageIndex = Math.min(pageIndex, totalPages);
                            const startIndex = (safePageIndex - 1) * ITEMS_PER_PAGE;
                            const currentSlice = [...history].reverse().slice(startIndex, startIndex + ITEMS_PER_PAGE);

                            return (
                                <>
                                    <div className="space-y-2">
                                        {currentSlice.map((r, i) => (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => setSelectedReading(r)}
                                                className="w-full flex items-center justify-between p-3 sm:p-3.5 bg-gray-50/80 hover:bg-gray-100 active:bg-gray-200/80 rounded-xl sm:rounded-2xl border border-gray-100 transition-all text-left cursor-pointer group gap-2.5"
                                            >
                                                <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: r.risk?.color || '#2DC653' }}></span>
                                                    <div className="min-w-0 truncate">
                                                        <p className="text-xs sm:text-sm font-bold text-aqua-text truncate">{r.risk?.label || 'Terkonfirmasi'}</p>
                                                        <p className="text-[10px] sm:text-[11px] text-aqua-text-muted truncate">
                                                            TDS {Number(r.tds || 0).toFixed(0)} ppm &middot; Turbidity {Number(r.turbidity || 0).toFixed(1)} NTU
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                                                    <span className="text-[10px] sm:text-[11px] font-bold text-aqua-text-muted whitespace-nowrap">
                                                        {new Date(r.timestamp || Date.now()).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                    <span className="material-symbols-outlined text-gray-300 group-hover:text-aqua-primary transition-colors text-base">chevron_right</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>

                                    {totalItems > ITEMS_PER_PAGE && (
                                        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3.5 sm:pt-4 mt-3.5 sm:mt-4 border-t border-gray-100 text-[11px] sm:text-xs font-medium text-gray-500">
                                            <div className="text-center sm:text-left">
                                                Menampilkan <span className="font-bold text-aqua-text">{startIndex + 1}</span> - <span className="font-bold text-aqua-text">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> dari <span className="font-bold text-aqua-text">{totalItems}</span> riwayat
                                            </div>
                                            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => setPageIndex(p => Math.max(1, p - 1))}
                                                    disabled={safePageIndex <= 1}
                                                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer text-aqua-text flex items-center justify-center gap-1"
                                                >
                                                    <span className="material-symbols-outlined text-sm">chevron_left</span>
                                                    Sebelumnya
                                                </button>
                                                <span className="px-2 font-bold text-aqua-text text-xs shrink-0">
                                                    {safePageIndex} / {totalPages}
                                                </span>
                                                <button
                                                    type="button"
                                                    onClick={() => setPageIndex(p => Math.min(totalPages, p + 1))}
                                                    disabled={safePageIndex >= totalPages}
                                                    className="flex-1 sm:flex-none px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer text-aqua-text flex items-center justify-center gap-1"
                                                >
                                                    Selanjutnya
                                                    <span className="material-symbols-outlined text-sm">chevron_right</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </>
                            );
                        })()}
                    </>
                )}
            </div>

            {/* DETAIL MODAL (HISTORICAL READING) */}
            {selectedReading && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-3 sm:p-4 bg-aqua-text/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-2xl sm:rounded-[2rem] shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
                        <div className="bg-aqua-primary p-5 sm:p-6 text-white relative">
                            <button
                                onClick={() => setSelectedReading(null)}
                                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 active:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                            <span className="text-[9px] font-black text-white/70 uppercase tracking-widest">Detail Pengukuran</span>
                            <h2 className="text-xl sm:text-2xl font-black mt-1 pr-8 leading-tight">{selectedReading.risk?.label || 'Pengukuran Kualitas Air'}</h2>
                            <p className="text-[11px] text-white/70 mt-1">
                                {new Date(selectedReading.timestamp || Date.now()).toLocaleDateString('id-ID', {
                                    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                                })}
                            </p>
                        </div>
                        <div className="p-4 sm:p-6 overflow-y-auto space-y-4">
                            <div className="grid grid-cols-2 gap-2 sm:gap-3">
                                {[
                                    ['opacity', 'TDS', `${Number(selectedReading.tds || 0).toFixed(0)} ppm`],
                                    ['blur_on', 'Turbidity', `${Number(selectedReading.turbidity || 0).toFixed(1)} NTU`],
                                ].map(([icon, label, val]) => (
                                    <div key={label} className="bg-aqua-background border border-gray-100 p-2.5 sm:p-4 rounded-xl sm:rounded-2xl text-center shadow-xs">
                                        <span className="material-symbols-outlined text-aqua-primary text-lg sm:text-xl mb-0.5 block">{icon}</span>
                                        <p className="text-[8px] sm:text-[9px] font-bold text-aqua-text-muted uppercase tracking-wider">{label}</p>
                                        <p className="text-xs sm:text-sm font-black text-aqua-text mt-0.5 truncate">{val}</p>
                                    </div>
                                ))}
                            </div>
                            <div
                                className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl text-xs font-bold leading-relaxed"
                                style={{ backgroundColor: `${selectedReading.risk?.color || '#2DC653'}14`, color: selectedReading.risk?.color || '#2DC653' }}
                            >
                                <p className="font-black uppercase tracking-widest text-[9px] mb-2">Rekomendasi</p>
                                <ul className="space-y-1.5 list-disc list-inside text-[11px] sm:text-xs text-slate-700">
                                    {(riskCopy[selectedReading.risk?.level] || riskCopy.low).recommendations.map((r) => (
                                        <li key={r}>{r}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="p-4 sm:p-5 bg-aqua-background border-t border-gray-100 flex gap-3">
                            <button
                                onClick={() => setSelectedReading(null)}
                                className="flex-1 py-2.5 sm:py-3 bg-aqua-primary text-white rounded-xl sm:rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-aqua-primary-hover active:scale-98 transition-all cursor-pointer shadow-xs"
                            >
                                Tutup
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
