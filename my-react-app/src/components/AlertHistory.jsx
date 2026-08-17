import { useAppContext } from '../context/AppContext';

export default function AlertHistory({ isDropdown = false }) {
    const { history } = useAppContext();

    // Derive alerts from readings where risk is high/very high — in a real
    // deployment this would come from the backend's alert log instead.
    const alerts = [...history]
        .reverse()
        .filter(r => r.risk.level === 'high' || r.risk.level === 'veryhigh')
        .slice(0, 10);

    const getStyle = (level) => {
        if (level === 'veryhigh') return { icon: 'error', color: 'text-aqua-danger', bg: 'bg-aqua-danger/10' };
        return { icon: 'warning', color: 'text-[#F07A3C]', bg: 'bg-[#F07A3C]/10' };
    };

    return (
        <section className={isDropdown ? "p-4" : "bg-white rounded-3xl p-8 border border-gray-100 shadow-sm overflow-hidden"}>
            <div className={`flex items-center justify-between ${isDropdown ? 'mb-4' : 'mb-8'}`}>
                <h2 className="font-bold text-aqua-text text-xl">Riwayat Peringatan</h2>
                {!isDropdown && <span className="bg-aqua-secondary/15 text-aqua-primary px-3 py-1 rounded-full text-[10px] font-bold">LIVE</span>}
            </div>

            <div className="space-y-1">
                {alerts.length === 0 ? (
                    <div className="py-10 text-center">
                        <span className="material-symbols-outlined text-gray-200 text-5xl mb-2">notifications_off</span>
                        <p className="text-gray-400 text-xs italic">Belum ada peringatan risiko tinggi tercatat</p>
                    </div>
                ) : alerts.map((alert) => {
                    const style = getStyle(alert.risk.level);
                    const time = new Date(alert.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
                    const date = new Date(alert.timestamp).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });

                    return (
                        <div key={alert.timestamp} className="py-4 flex items-start gap-4 group transition-all">
                            <div className={`w-10 h-10 rounded-2xl ${style.bg} flex-shrink-0 flex items-center justify-center border border-white shadow-sm`}>
                                <span className={`material-symbols-outlined ${style.color} text-xl`}>{style.icon}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-baseline mb-1">
                                    <p className="font-bold text-aqua-text text-sm truncate uppercase tracking-tight">
                                        {alert.risk.label}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 whitespace-nowrap">{date}, {time}</p>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed line-clamp-2">
                                    TDS {alert.tds.toFixed(0)} ppm &middot; Turbidity {alert.turbidity.toFixed(1)} NTU &middot; ARS {alert.ars}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </section>
    );
}
