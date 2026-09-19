export default function RiskGauge({ ars, color, label }) {
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
