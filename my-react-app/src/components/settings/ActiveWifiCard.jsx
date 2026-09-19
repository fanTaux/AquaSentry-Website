export default function ActiveWifiCard({ activeWifi, getSignalBadge }) {
    const badge = getSignalBadge(activeWifi.rssi);

    return (
        <div className="bg-gradient-to-r from-blue-50/80 via-indigo-50/50 to-white border border-blue-100 p-6 rounded-3xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-aqua-primary text-white flex items-center justify-center shadow-xs">
                        <span className="material-symbols-outlined text-2xl">wifi</span>
                    </div>
                    <div>
                        <span className="text-[10px] font-black uppercase tracking-widest text-aqua-primary">Status Wi-Fi ESP32</span>
                        <h2 className="text-xl font-black text-aqua-text">
                            {activeWifi.isConnected ? activeWifi.ssid : 'Tidak Terhubung'}
                        </h2>
                    </div>
                </div>
                <span className={`text-xs font-black px-3 py-1.5 rounded-full ${badge.color}`}>
                    {activeWifi.isConnected && activeWifi.rssi ? `${badge.label} (${activeWifi.rssi} dBm)` : badge.label}
                </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-blue-100/60">
                <div className="bg-white/80 p-3.5 rounded-2xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Status Koneksi</span>
                    {activeWifi.isConnected ? (
                        <span className="text-sm font-black text-emerald-600 flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            Terhubung
                        </span>
                    ) : (
                        <span className="text-sm font-black text-rose-500 flex items-center gap-1.5 mt-0.5">
                            <span className="w-2 h-2 rounded-full bg-rose-500"></span>
                            Terputus / Offline
                        </span>
                    )}
                </div>

                <div className="bg-white/80 p-3.5 rounded-2xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">IP Address ESP32</span>
                    <span className="text-sm font-mono font-bold text-gray-700 mt-0.5 block">
                        {activeWifi.isConnected ? activeWifi.ip : '-'}
                    </span>
                </div>

                <div className="bg-white/80 p-3.5 rounded-2xl border border-gray-100">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Mode Operasi</span>
                    <span className="text-sm font-black text-aqua-primary mt-0.5 block">
                        {activeWifi.isConnected ? 'Dual-Mode (Edge AI + Web Sync)' : 'Offline / Tidak Terkoneksi'}
                    </span>
                </div>
            </div>
        </div>
    );
}

