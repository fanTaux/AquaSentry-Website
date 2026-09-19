import { useState } from 'react';
import { useAppContext } from '../context/AppContext';
import RiskGauge from './dashboard/RiskGauge';
import ReadingCard from './dashboard/ReadingCard';
import MetricModal from './dashboard/MetricModal';
import RiskAdviceCard from './dashboard/RiskAdviceCard';

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

export default function DashboardMetrics() {
    const { state, history, isDeviceOnline } = useAppContext();
    const [selectedReading, setSelectedReading] = useState(null);
    const [activeParamModal, setActiveParamModal] = useState(null);

    const { tds, turbidity, ars, risk, lastUpdate } = state;
    const copy = riskCopy[risk.level] || riskCopy.low;

    const lastUpdateLabel = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '-';

    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 15;

    const reversedHistory = [...history].reverse();
    const totalItems = reversedHistory.length;
    const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE) || 1;

    const pageIndex = Math.min(Math.max(currentPage, 1), totalPages);
    const startIndex = (pageIndex - 1) * ITEMS_PER_PAGE;
    const currentHistoryPage = reversedHistory.slice(startIndex, startIndex + ITEMS_PER_PAGE);

    const handlePrevPage = () => {
        setCurrentPage(prev => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage(prev => Math.min(prev + 1, totalPages));
    };

    const getParamStats = (param) => {
        if (!history || history.length === 0) {
            const val = state[param] || 0;
            return { avg: val, min: val, max: val, count: 1 };
        }
        const values = history.map(h => h[param]).filter(v => typeof v === 'number');
        if (values.length === 0) {
            const val = state[param] || 0;
            return { avg: val, min: val, max: val, count: 1 };
        }
        const sum = values.reduce((a, b) => a + b, 0);
        const avg = sum / values.length;
        const min = Math.min(...values);
        const max = Math.max(...values);
        return { avg, min, max, count: values.length };
    };

    const paramDetails = {
        tds: {
            title: 'TDS (Total Dissolved Solids)',
            subtitle: 'Padatan Terlarut Total',
            icon: 'opacity',
            unit: 'ppm',
            currentValue: tds.toFixed(0),
            description: 'Padatan Terlarut Total (TDS) mengukur jumlah total mineral, garam, logam, serta kation dan anion terlarut dalam air. TDS merupakan salah satu parameter utama untuk menentukan tingkat kejernihan dan kandungan mineral terlarut pada air.',
            impact: 'Nilai TDS yang terlalu tinggi dapat merusak rasa air (menjadi pahit/berunsur logam), meninggalkan kerak pada perabotan, dan mengindikasikan tingginya zat mineral atau polutan terlarut.',
            thresholds: [
                { range: '< 300 ppm', status: 'Ideal / Sangat Baik', color: '#2DC653', desc: 'Air dengan rasa murni dan paling ideal dikonsumsi.' },
                { range: '300 - 600 ppm', status: 'Baik / Layak', color: '#0077B6', desc: 'Dalam batas aman untuk kebutuhan sehari-hari.' },
                { range: '600 - 1.000 ppm', status: 'Cukup (Waspada)', color: '#F4A261', desc: 'Rasa air mulai terasa mineral berat.' },
                { range: '1.000 - 1.500 ppm', status: 'Batas Maksimum', color: '#F07A3C', desc: 'Batas toleransi baku mutu WHO / Permenkes RI.' },
                { range: '> 1.500 ppm', status: 'Tinggi (Berisiko)', color: '#E63946', desc: 'Melebihi ambang batas aman, tidak disarankan dikonsumsi langsung.' },
            ],
            standards: 'Batas Maksimum Permenkes RI & WHO: 1.500 ppm'
        },
        turbidity: {
            title: 'Turbidity (Kekeruhan Air)',
            subtitle: 'Tingkat Kekeruhan Air',
            icon: 'blur_on',
            unit: 'NTU',
            currentValue: turbidity.toFixed(1),
            description: 'Turbidity (Kekeruhan) mengukur seberapa jernih sampel air berdasarkan tingkat hamburan cahaya yang disebabkan oleh partikel halus tersuspensi (seperti tanah liat, lumpur, dan zat organik).',
            impact: 'Air yang keruh membuat tampilan air kotor dan dapat melindungi mikroorganisme atau bakteri pathogen dari proses pencucian atau disinfeksi biasa.',
            thresholds: [
                { range: '< 1.0 NTU', status: 'Sangat Jernih', color: '#2DC653', desc: 'Sangat jernih transparan, standar air minum tinggi.' },
                { range: '1.0 - 5.0 NTU', status: 'Jernih / Normal', color: '#0077B6', desc: 'Batas normal yang aman untuk penggunaan domestik.' },
                { range: '5.0 - 10.0 NTU', status: 'Agak Keruh', color: '#F4A261', desc: 'Batas maksimum air bersih menurut Permenkes RI.' },
                { range: '> 10.0 NTU', status: 'Sangat Keruh', color: '#E63946', desc: 'Tampak keruh secara visual, perlu pengendapan/filtrasi.' },
            ],
            standards: 'Batas Maksimum Permenkes RI: 10 NTU | Rekomendasi WHO: 5 NTU'
        }
    };

    return (
        <div className="space-y-6 pb-8 animate-fade-in">
            {/* HERO: current reading + ARS gauge */}
            <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <RiskGauge ars={ars} color={risk.color} label={risk.label} />

                    <div className="flex-1 w-full">
                        <h2 className="text-xl font-black text-aqua-text mb-1">{copy.title}</h2>
                        <p className="text-sm text-aqua-text-muted mb-4 leading-relaxed">{copy.advice}</p>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                            <ReadingCard
                                icon="opacity"
                                label="TDS"
                                sublabel="Padatan Terlarut"
                                value={tds.toFixed(0)}
                                unit="ppm"
                                hint="Ambang WHO/Permenkes: 1.500 ppm"
                                onClick={() => setActiveParamModal('tds')}
                            />
                            <ReadingCard
                                icon="blur_on"
                                label="Turbidity"
                                sublabel="Kekeruhan Air"
                                value={turbidity.toFixed(1)}
                                unit="NTU"
                                hint="Ambang WHO/Permenkes: 10 NTU"
                                onClick={() => setActiveParamModal('turbidity')}
                            />
                        </div>

                        <div className="flex items-center justify-between text-[10px] font-bold text-aqua-text-muted uppercase tracking-widest">
                            <span className="flex items-center gap-1.5">
                                <span className={`w-1.5 h-1.5 rounded-full ${isDeviceOnline ? 'bg-aqua-success' : 'bg-aqua-danger'}`}></span>
                                {isDeviceOnline ? 'Sensor aktif' : 'Sensor offline'}
                            </span>
                            <span>Update terakhir: {lastUpdateLabel}</span>
                        </div>
                    </div>
                </div>

                <RiskAdviceCard copy={copy} lastUpdateLabel={lastUpdateLabel} isDeviceOnline={isDeviceOnline} />
            </section>

            {/* HISTORY */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="font-bold text-aqua-text text-xl">Riwayat Pengukuran</h2>
                        <p className="text-xs text-aqua-text-muted mt-0.5 font-medium">
                            Maksimal 15 baris per halaman
                        </p>
                    </div>
                    <span className="bg-aqua-secondary/15 text-aqua-primary px-3 py-1 rounded-full text-[10px] font-bold">LIVE</span>
                </div>

                {currentHistoryPage.length === 0 ? (
                    <div className="py-10 text-center">
                        <span className="material-symbols-outlined text-gray-200 text-5xl mb-2">history</span>
                        <p className="text-gray-400 text-xs italic">Belum ada data pengukuran</p>
                    </div>
                ) : (
                    <>
                        <div className="divide-y divide-gray-50">
                            {currentHistoryPage.map((r, idx) => (
                                <button
                                    key={r.timestamp || idx}
                                    onClick={() => setSelectedReading(r)}
                                    className="w-full py-3.5 flex items-center justify-between gap-4 text-left hover:bg-aqua-background/60 rounded-xl px-2 transition-colors cursor-pointer"
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: r.risk.color }}></span>
                                        <div className="min-w-0">
                                            <p className="text-sm font-bold text-aqua-text truncate">{r.risk.label}</p>
                                            <p className="text-[10px] text-aqua-text-muted">
                                                TDS {r.tds.toFixed(0)} ppm &middot; Turbidity {r.turbidity.toFixed(1)} NTU
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 flex-shrink-0">
                                        <span className="text-[10px] font-bold text-aqua-text-muted">
                                            {new Date(r.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                        </span>
                                        <span className="material-symbols-outlined text-gray-300 text-base">chevron_right</span>
                                    </div>
                                </button>
                            ))}
                        </div>

                        {totalItems > ITEMS_PER_PAGE && (
                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 mt-4 border-t border-gray-100 text-xs font-medium text-gray-500">
                                <div>
                                    Menampilkan <span className="font-bold text-aqua-text">{startIndex + 1}</span> - <span className="font-bold text-aqua-text">{Math.min(startIndex + ITEMS_PER_PAGE, totalItems)}</span> dari <span className="font-bold text-aqua-text">{totalItems}</span> riwayat
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={handlePrevPage}
                                        disabled={pageIndex <= 1}
                                        className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer text-aqua-text flex items-center gap-1"
                                    >
                                        <span className="material-symbols-outlined text-sm">chevron_left</span>
                                        Sebelumnya
                                    </button>
                                    <span className="px-2 font-bold text-aqua-text text-xs">
                                        {pageIndex} / {totalPages}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={handleNextPage}
                                        disabled={pageIndex >= totalPages}
                                        className="px-3.5 py-1.5 rounded-xl border border-gray-200 text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 cursor-pointer text-aqua-text flex items-center gap-1"
                                    >
                                        Selanjutnya
                                        <span className="material-symbols-outlined text-sm">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* PARAMETER DETAIL MODAL (TDS / TURBIDITY) */}
            <MetricModal
                activeParamModal={activeParamModal}
                onClose={() => setActiveParamModal(null)}
                paramDetails={paramDetails}
                getParamStats={getParamStats}
            />

            {/* DETAIL MODAL (HISTORICAL READING) */}
            {selectedReading && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-aqua-text/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-aqua-primary p-7 text-white relative">
                            <button
                                onClick={() => setSelectedReading(null)}
                                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all cursor-pointer"
                            >
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                            <span className="text-[9px] font-black text-white/60 uppercase tracking-widest">Detail Pengukuran</span>
                            <h2 className="text-2xl font-black mt-1">{selectedReading.risk.label}</h2>
                            <p className="text-[10px] text-white/60 mt-1">
                                {new Date(selectedReading.timestamp).toLocaleDateString('id-ID', {
                                    weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
                                })}
                            </p>
                        </div>
                        <div className="p-7 overflow-y-auto space-y-5">
                            <div className="grid grid-cols-3 gap-3">
                                {[
                                    ['opacity', 'TDS', `${selectedReading.tds.toFixed(0)} ppm`],
                                    ['blur_on', 'Turbidity', `${selectedReading.turbidity.toFixed(1)} NTU`],
                                    ['speed', 'ARS', selectedReading.ars],
                                ].map(([icon, label, val]) => (
                                    <div key={label} className="bg-aqua-background border border-gray-100 p-4 rounded-2xl text-center shadow-sm">
                                        <span className="material-symbols-outlined text-aqua-primary text-xl mb-1 block">{icon}</span>
                                        <p className="text-[8px] font-bold text-aqua-text-muted uppercase">{label}</p>
                                        <p className="text-sm font-black text-aqua-text">{val}</p>
                                    </div>
                                ))}
                            </div>
                            <div
                                className="p-4 rounded-2xl text-xs font-bold leading-relaxed"
                                style={{ backgroundColor: `${selectedReading.risk.color}14`, color: selectedReading.risk.color }}
                            >
                                <p className="font-black uppercase tracking-widest text-[9px] mb-2">Rekomendasi</p>
                                <ul className="space-y-1 list-disc list-inside">
                                    {(riskCopy[selectedReading.risk.level] || riskCopy.low).recommendations.map((r) => (
                                        <li key={r}>{r}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                        <div className="p-5 bg-aqua-background flex gap-3">
                            <button
                                onClick={() => setSelectedReading(null)}
                                className="flex-1 py-3 bg-aqua-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-aqua-primary-hover transition-all cursor-pointer"
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
