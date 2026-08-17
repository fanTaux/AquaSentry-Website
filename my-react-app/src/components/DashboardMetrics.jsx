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

function ReadingCard({ icon, label, value, unit, hint }) {
    return (
        <div className="bg-white border border-gray-100 p-5 rounded-2xl shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-aqua-secondary/15 flex items-center justify-center flex-shrink-0">
                <span className="material-symbols-outlined text-aqua-primary text-2xl">{icon}</span>
            </div>
            <div className="min-w-0">
                <p className="text-[10px] font-black text-aqua-text-muted uppercase tracking-widest">{label}</p>
                <p className="text-xl font-black text-aqua-text">
                    {value} <span className="text-sm font-bold text-aqua-text-muted">{unit}</span>
                </p>
                {hint && <p className="text-[10px] text-aqua-text-muted mt-0.5">{hint}</p>}
            </div>
        </div>
    );
}

export default function DashboardMetrics() {
    const { state, history, isDeviceOnline } = useAppContext();
    const [selectedReading, setSelectedReading] = useState(null);

    const { tds, turbidity, ars, risk, lastUpdate } = state;
    const copy = riskCopy[risk.level] || riskCopy.low;

    const lastUpdateLabel = lastUpdate
        ? new Date(lastUpdate).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        : '-';

    const recentHistory = [...history].reverse().slice(0, 10);

    return (
        <div className="space-y-6 pb-8 animate-fade-in">
            {/* HERO: current reading + ARS gauge */}
            <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm">
                <div className="flex flex-col md:flex-row items-center gap-8">
                    <RiskGauge ars={ars} color={risk.color} label={risk.label} />

                    <div className="flex-1 w-full">
                        <h2 className="text-xl font-black text-aqua-text mb-1">{copy.title}</h2>
                        <p className="text-sm text-aqua-text-muted mb-4 leading-relaxed">{copy.advice}</p>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                            <ReadingCard icon="opacity" label="TDS" value={tds.toFixed(0)} unit="ppm" hint="Ambang WHO/Permenkes: 1.500 ppm" />
                            <ReadingCard icon="blur_on" label="Turbidity" value={turbidity.toFixed(1)} unit="NTU" hint="Ambang WHO/Permenkes: 10 NTU" />
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
                                className="w-full py-4 flex items-center justify-between gap-4 text-left hover:bg-aqua-background/60 rounded-xl px-2 transition-colors"
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

            {/* DETAIL MODAL */}
            {selectedReading && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-aqua-text/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-aqua-primary p-7 text-white relative">
                            <button
                                onClick={() => setSelectedReading(null)}
                                className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all"
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
                                className="flex-1 py-3 bg-aqua-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-aqua-primary-hover transition-all"
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
