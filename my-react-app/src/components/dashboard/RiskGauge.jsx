import React from 'react';

export default function RiskGauge({ level, label, color }) {
    // Normalisasi kategori risiko: 'low' | 'moderate' | 'high'
    const activeZone = (() => {
        const l = (level || label || '').toLowerCase();
        if (l.includes('high') || l.includes('tinggi') || l.includes('buruk')) return 'high';
        if (l.includes('med') || l.includes('moderate') || l.includes('sedang')) return 'moderate';
        return 'low';
    })();

    const zoneConfigs = {
        low: {
            color: '#10B981',
            label: 'LOW RISK',
            sublabel: 'Kualitas Air Baik & Aman',
            needleAngle: -60, // Menghadap ke zona hijau (kiri)
        },
        moderate: {
            color: '#F59E0B',
            label: 'MODERATE RISK',
            sublabel: 'Kualitas Air Cukup / Perhatian',
            needleAngle: 0, // Menghadap ke zona kuning (tengah)
        },
        high: {
            color: '#EF4444',
            label: 'HIGH RISK',
            sublabel: 'Kualitas Air Buruk / Berisiko',
            needleAngle: 60, // Menghadap ke zona merah (kanan)
        }
    };

    const currentConfig = zoneConfigs[activeZone] || zoneConfigs.low;
    const activeColor = color || currentConfig.color;

    // Geometri Gauge SVG
    const cx = 120;
    const cy = 115;
    const radius = 82;
    const strokeWidth = 14;
    const needleLength = 58;

    // Utilitas konversi sudut polar ke kartesian SVG
    // Sudut dihitung dari sumbu X positif, berlawanan arah jarum jam (180° = kiri, 90° = atas, 0° = kanan)
    const polarToCartesian = (angleDeg) => {
        const rad = (angleDeg * Math.PI) / 180.0;
        return {
            x: cx + radius * Math.cos(rad),
            y: cy - radius * Math.sin(rad)
        };
    };

    // Fungsi menggambar kurva busur SVG (clockwise dari kiri ke kanan)
    const createArcPath = (startAngle, endAngle) => {
        const p1 = polarToCartesian(startAngle);
        const p2 = polarToCartesian(endAngle);
        return `M ${p1.x.toFixed(2)} ${p1.y.toFixed(2)} A ${radius} ${radius} 0 0 1 ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
    };

    // 3 Zona Pembagian Busur:
    // Zona 1 (Hijau/Rendah): 176° s/d 124°
    // Zona 2 (Kuning/Sedang): 116° s/d 64°
    // Zona 3 (Merah/Tinggi): 56° s/d 4°
    const arcLow = createArcPath(176, 124);
    const arcMed = createArcPath(116, 64);
    const arcHigh = createArcPath(56, 4);

    return (
        <div className="flex flex-col items-center select-none w-full max-w-[280px]">
            <div className="relative w-full h-36 flex items-center justify-center">
                <svg viewBox="0 0 240 135" className="w-full h-full overflow-visible">
                    <defs>
                        <filter id="gauge-glow" x="-20%" y="-20%" width="140%" height="140%">
                            <feDropShadow dx="0" dy="2" stdDeviation="3" floodColor={activeColor} floodOpacity="0.5" />
                        </filter>
                    </defs>

                    {/* Zona 1: Hijau / Rendah */}
                    <path
                        d={arcLow}
                        fill="none"
                        stroke="#10B981"
                        strokeWidth={activeZone === 'low' ? strokeWidth + 2 : strokeWidth}
                        strokeLinecap="round"
                        opacity={activeZone === 'low' ? 1.0 : 0.25}
                        filter={activeZone === 'low' ? "url(#gauge-glow)" : undefined}
                        className="transition-all duration-700 ease-out"
                    />

                    {/* Zona 2: Kuning / Sedang */}
                    <path
                        d={arcMed}
                        fill="none"
                        stroke="#F59E0B"
                        strokeWidth={activeZone === 'moderate' ? strokeWidth + 2 : strokeWidth}
                        strokeLinecap="round"
                        opacity={activeZone === 'moderate' ? 1.0 : 0.25}
                        filter={activeZone === 'moderate' ? "url(#gauge-glow)" : undefined}
                        className="transition-all duration-700 ease-out"
                    />

                    {/* Zona 3: Merah / Tinggi */}
                    <path
                        d={arcHigh}
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth={activeZone === 'high' ? strokeWidth + 2 : strokeWidth}
                        strokeLinecap="round"
                        opacity={activeZone === 'high' ? 1.0 : 0.25}
                        filter={activeZone === 'high' ? "url(#gauge-glow)" : undefined}
                        className="transition-all duration-700 ease-out"
                    />

                    {/* Label Teks Busur di Atas Tiap Zona */}
                    <text
                        x="42"
                        y="52"
                        textAnchor="middle"
                        className={`text-[9px] font-black uppercase tracking-wider transition-opacity duration-500 ${
                            activeZone === 'low' ? 'fill-emerald-600 font-extrabold' : 'fill-slate-400 opacity-60'
                        }`}
                    >
                        Rendah
                    </text>

                    <text
                        x="120"
                        y="18"
                        textAnchor="middle"
                        className={`text-[9px] font-black uppercase tracking-wider transition-opacity duration-500 ${
                            activeZone === 'moderate' ? 'fill-amber-600 font-extrabold' : 'fill-slate-400 opacity-60'
                        }`}
                    >
                        Sedang
                    </text>

                    <text
                        x="198"
                        y="52"
                        textAnchor="middle"
                        className={`text-[9px] font-black uppercase tracking-wider transition-opacity duration-500 ${
                            activeZone === 'high' ? 'fill-rose-600 font-extrabold' : 'fill-slate-400 opacity-60'
                        }`}
                    >
                        Tinggi
                    </text>

                    {/* Jarum / Needle Penunjuk Dinamis */}
                    <g
                        style={{
                            transformOrigin: `${cx}px ${cy}px`,
                            transform: `rotate(${currentConfig.needleAngle}deg)`,
                            transition: 'transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1)'
                        }}
                    >
                        {/* Batang jarum dengan ketebalan meruncing */}
                        <polygon
                            points={`${cx - 3.5},${cy} ${cx},${cy - needleLength} ${cx + 3.5},${cy}`}
                            fill={activeColor}
                            opacity="0.95"
                        />
                        {/* Ujung titik jarum bercahaya */}
                        <circle
                            cx={cx}
                            cy={cy - needleLength}
                            r="3.5"
                            fill="#FFFFFF"
                            stroke={activeColor}
                            strokeWidth="2.5"
                        />
                    </g>

                    {/* Poros Pivot Tengah Jarum */}
                    <circle cx={cx} cy={cy} r="7" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="2.5" />
                    <circle cx={cx} cy={cy} r="3.5" fill={activeColor} className="transition-colors duration-500" />
                </svg>
            </div>

            {/* Status Kualitas Air di Bagian Tengah (Tanpa Angka Skor) */}
            <div className="flex flex-col items-center -mt-5 text-center">
                <div
                    className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full font-black text-xs tracking-wider border shadow-xs transition-all duration-500"
                    style={{
                        backgroundColor: `${activeColor}18`,
                        color: activeColor,
                        borderColor: `${activeColor}45`
                    }}
                >
                    <span className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: activeColor }} />
                    <span>{label || currentConfig.label}</span>
                </div>

                <p className="text-xs font-semibold text-slate-700 mt-1.5 transition-all duration-500">
                    {currentConfig.sublabel}
                </p>

                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">
                    Klasifikasi Kualitas Air
                </p>
            </div>
        </div>
    );
}
