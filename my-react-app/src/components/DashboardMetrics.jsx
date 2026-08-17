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

function RiskGauge({ ars, color, label }) {
    const value = Math.min(100, Math.max(0, ars));
    const radius = 75;
    const strokeWidth = 16;
    const cx = 100;
    const cy = 95;
    const circumference = Math.PI * radius; // ~235.6
    const strokeDashoffset = circumference * (1 - value / 100);

    // Calculate position for indicator dot at current arc tip
    const angleRad = Math.PI * (1 - value / 100);
    const dotX = cx + radius * Math.cos(angleRad);
    const dotY = cy - radius * Math.sin(angleRad);

    return (
        <div className="flex flex-col items-center select-none">
            <div className="relative w-56 h-32 flex items-center justify-center">
                <svg viewBox="0 0 200 115" className="w-full h-full overflow-visible">
                    <defs>
                        <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={color} floodOpacity="0.4" />
                        </filter>
                        <linearGradient id="gauge-track-grad" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stopColor="#E2E8F0" />
                            <stop offset="100%" stopColor="#CBD5E1" />
                        </linearGradient>
                    </defs>

                    {/* Track Background - High Contrast Slate/Grey */}
                    <path
                        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                        fill="none"
                        stroke="url(#gauge-track-grad)"
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                    />

                    {/* Active Filled Arc */}
                    <path
                        d={`M ${cx - radius} ${cy} A ${radius} ${radius} 0 0 1 ${cx + radius} ${cy}`}
                        fill="none"
                        stroke={color}
                        strokeWidth={strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        filter="url(#gauge-glow)"
                        className="transition-all duration-1000 ease-out"
                    />

                    {/* Indicator Dot at current value */}
                    {value > 0 && (
                        <circle
                            cx={dotX}
                            cy={dotY}
                            r={strokeWidth / 3.2}
                            fill="#FFFFFF"
                            stroke={color}
                            strokeWidth="3.5"
                            className="transition-all duration-1000 ease-out"
                        />
                    )}

                    {/* Ticks at 0, 25, 50, 75, 100 */}
                    {[0, 25, 50, 75, 100].map((tick) => {
                        const tickRad = Math.PI * (1 - tick / 100);
                        const innerR = radius - strokeWidth / 2 - 7;
                        const outerR = radius - strokeWidth / 2 - 3;
                        const x1 = cx + innerR * Math.cos(tickRad);
                        const y1 = cy - innerR * Math.sin(tickRad);
                        const x2 = cx + outerR * Math.cos(tickRad);
                        const y2 = cy - outerR * Math.sin(tickRad);
                        return (
                            <line
                                key={tick}
                                x1={x1}
                                y1={y1}
                                x2={x2}
                                y2={y2}
                                stroke="#94A3B8"
                                strokeWidth="1.5"
                                strokeLinecap="round"
                            />
                        );
                    })}
                </svg>
            </div>

            {/* Score & Label */}
            <div className="flex flex-col items-center -mt-6">
                <p className="text-4xl font-black text-aqua-text tracking-tight">{ars}</p>
                <span
                    className="text-[11px] font-black uppercase tracking-widest py-1 px-4 rounded-full mt-1 border shadow-xs"
                    style={{
                        backgroundColor: `${color}1F`,
                        color: color,
                        borderColor: `${color}40`
                    }}
                >
                    {label}
                </span>
                <p className="text-[10px] text-aqua-text-muted font-bold uppercase tracking-widest mt-2">AquaSentry Risk Score</p>
            </div>
        </div>
    );
}

function ReadingCard({ icon, label, sublabel, value, unit, hint, onClick }) {
    return (
        <button
            onClick={onClick}
            type="button"
            className="w-full bg-white border border-gray-100 p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-aqua-primary/40 transition-all flex items-center justify-between gap-3 text-left group cursor-pointer"
        >
            <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-aqua-secondary/15 group-hover:bg-aqua-primary group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <span className="material-symbols-outlined text-aqua-primary group-hover:text-white text-2xl transition-colors">{icon}</span>
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-aqua-text uppercase tracking-wider">{label}</span>
                        <span className="text-[10px] font-bold text-aqua-primary bg-aqua-secondary/15 px-2 py-0.5 rounded-md">
                            {sublabel}
                        </span>
                    </div>
                    <p className="text-xl font-black text-aqua-text mt-0.5">
                        {value} <span className="text-sm font-bold text-aqua-text-muted">{unit}</span>
                    </p>
                    {hint && <p className="text-[10px] text-aqua-text-muted mt-0.5 font-medium">{hint}</p>}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-aqua-text-muted group-hover:text-aqua-primary transition-colors">
                <span className="text-[10px] font-black uppercase tracking-wider hidden md:inline">Detail</span>
                <span className="material-symbols-outlined text-lg">info</span>
            </div>
        </button>
    );
}

export default function DashboardMetrics() {
    const { state, history, isDeviceOnline } = useAppContext();
    const [selectedReading, setSelectedReading] = useState(null);
    const [activeParamModal, setActiveParamModal] = useState(null);

    const { tds, turbidity, ars, risk, lastUpdate } = state;
    const copy = riskCopy[risk.level] || riskCopy.low;

    const lastUpdateLabel = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '-';

    const recentHistory = [...history].reverse().slice(0, 10);

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

                <div className="mt-6 pt-6 border-t border-gray-100">
                    <p className="text-[10px] font-black text-aqua-text-muted uppercase tracking-widest mb-2">Rekomendasi</p>
                    <ul className="space-y-1.5">
                        {copy.recommendations.map((r) => (
                            <li key={r} className="text-xs text-aqua-text font-medium flex items-start gap-2">
                                <span className="material-symbols-outlined text-aqua-primary text-sm mt-0.5">check_circle</span>
                                {r}
                            </li>
                        ))}
                    </ul>
                    <p className="text-[10px] text-aqua-text-muted italic mt-4">
                        AquaSentry adalah alat skrining dini berbasis parameter fisika-kimia, bukan pengganti pengujian laboratorium
                        atau penentu kelayakan air minum secara mutlak.
                    </p>
                </div>
            </section>

            {/* HISTORY */}
            <div className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="font-bold text-aqua-text text-xl">Riwayat Pengukuran</h2>
                    <span className="bg-aqua-secondary/15 text-aqua-primary px-3 py-1 rounded-full text-[10px] font-bold">LIVE</span>
                </div>

                {recentHistory.length === 0 ? (
                    <div className="py-10 text-center">
                        <span className="material-symbols-outlined text-gray-200 text-5xl mb-2">history</span>
                        <p className="text-gray-400 text-xs italic">Belum ada data pengukuran</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {recentHistory.map((r) => (
                            <button
                                key={r.timestamp}
                                onClick={() => setSelectedReading(r)}
                                className="w-full py-4 flex items-center justify-between gap-4 text-left hover:bg-aqua-background/60 rounded-xl px-2 transition-colors cursor-pointer"
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
                )}
            </div>

            {/* PARAMETER DETAIL MODAL (TDS / TURBIDITY) */}
            {activeParamModal && (() => {
                const detail = paramDetails[activeParamModal];
                const stats = getParamStats(activeParamModal);
                return (
                    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-aqua-text/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-gray-100">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-aqua-primary to-aqua-secondary p-6 text-white relative">
                                <button
                                    onClick={() => setActiveParamModal(null)}
                                    className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
                                >
                                    <span className="material-symbols-outlined text-base">close</span>
                                </button>
                                <div className="flex items-center gap-3">
                                    <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                                        <span className="material-symbols-outlined text-2xl">{detail.icon}</span>
                                    </div>
                                    <div>
                                        <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">{detail.subtitle}</span>
                                        <h2 className="text-xl font-black">{detail.title}</h2>
                                    </div>
                                </div>
                            </div>

                            {/* Body Content */}
                            <div className="p-6 overflow-y-auto space-y-6">
                                {/* Definition */}
                                <div className="bg-aqua-background p-4 rounded-2xl border border-aqua-secondary/20">
                                    <div className="flex items-center gap-2 text-aqua-primary mb-1.5">
                                        <span className="material-symbols-outlined text-lg">info</span>
                                        <h3 className="text-xs font-black uppercase tracking-wider">Apa itu {activeParamModal.toUpperCase()}?</h3>
                                    </div>
                                    <p className="text-xs text-aqua-text leading-relaxed font-medium mb-2.5">{detail.description}</p>
                                    <p className="text-[11px] text-aqua-text-muted leading-relaxed italic bg-white/80 p-3 rounded-xl border border-gray-100">
                                        <strong className="not-italic text-aqua-text font-bold">Dampak: </strong>{detail.impact}
                                    </p>
                                </div>

                                {/* Real-time Statistics */}
                                <div>
                                    <h3 className="text-xs font-black text-aqua-text uppercase tracking-wider mb-3 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-aqua-primary text-base">analytics</span>
                                        Statistik Pengukuran ({stats.count} Data)
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div className="bg-white border border-gray-100 p-3.5 rounded-2xl text-center shadow-xs">
                                            <p className="text-[9px] font-bold text-aqua-text-muted uppercase">Terkini</p>
                                            <p className="text-base font-black text-aqua-primary mt-0.5">{detail.currentValue} <span className="text-[10px] text-aqua-text-muted">{detail.unit}</span></p>
                                        </div>
                                        <div className="bg-white border border-gray-100 p-3.5 rounded-2xl text-center shadow-xs">
                                            <p className="text-[9px] font-bold text-aqua-text-muted uppercase">Rata-Rata</p>
                                            <p className="text-base font-black text-aqua-text mt-0.5">{activeParamModal === 'tds' ? stats.avg.toFixed(0) : stats.avg.toFixed(1)} <span className="text-[10px] text-aqua-text-muted">{detail.unit}</span></p>
                                        </div>
                                        <div className="bg-white border border-gray-100 p-3.5 rounded-2xl text-center shadow-xs">
                                            <p className="text-[9px] font-bold text-aqua-text-muted uppercase">Min / Maks</p>
                                            <p className="text-xs font-black text-aqua-text mt-1">
                                                {activeParamModal === 'tds' ? `${stats.min.toFixed(0)} - ${stats.max.toFixed(0)}` : `${stats.min.toFixed(1)} - ${stats.max.toFixed(1)}`}
                                            </p>
                                        </div>
                                    </div>
                                </div>

                                {/* Ambang Batas & Standard */}
                                <div>
                                    <h3 className="text-xs font-black text-aqua-text uppercase tracking-wider mb-1 flex items-center gap-2">
                                        <span className="material-symbols-outlined text-aqua-primary text-base">verified</span>
                                        Ambang Batas & Kategori Kualitas
                                    </h3>
                                    <p className="text-[10px] text-aqua-text-muted mb-3 font-semibold">{detail.standards}</p>

                                    <div className="space-y-2">
                                        {detail.thresholds.map((t) => (
                                            <div key={t.range} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white text-xs shadow-2xs">
                                                <div className="flex items-center gap-2.5">
                                                    <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }}></span>
                                                    <div>
                                                        <p className="font-black text-aqua-text">{t.range}</p>
                                                        <p className="text-[10px] text-aqua-text-muted">{t.desc}</p>
                                                    </div>
                                                </div>
                                                <span
                                                    className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0"
                                                    style={{ backgroundColor: `${t.color}1A`, color: t.color }}
                                                >
                                                    {t.status}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                                <button
                                    onClick={() => setActiveParamModal(null)}
                                    className="px-6 py-2.5 bg-aqua-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-aqua-primary-hover transition-all cursor-pointer shadow-sm"
                                >
                                    Tutup
                                </button>
                            </div>
                        </div>
                    </div>
                );
            })()}

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
