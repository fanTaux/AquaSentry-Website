export default function WifiScanModal({
    isOpen,
    onClose,
    wifiSSID,
    setWifiSSID,
    wifiPassword,
    setWifiPassword,
    isScanning,
    detectedNetworks,
    onScan,
    onSubmit,
    isSaving,
    statusMessage
}) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in">
            <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-5 border border-gray-100">
                <div className="text-center space-y-2">
                    <div className="w-14 h-14 bg-aqua-secondary/20 text-aqua-primary rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                        <span className="material-symbols-outlined text-3xl">sync</span>
                    </div>
                    <h3 className="text-xl font-black text-aqua-text tracking-tight">Konfigurasi Wi-Fi Baru</h3>
                    <p className="text-xs text-aqua-text-muted">Pilih jaringan yang tersedia di sekitar atau masukkan nama Wi-Fi secara manual.</p>
                </div>

                {/* Scan Results List */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs font-bold text-gray-500 px-1">
                        <span>JARINGAN TERDETEKSI TERIKUT</span>
                        <button
                            type="button"
                            onClick={onScan}
                            disabled={isScanning}
                            className="text-aqua-primary hover:underline flex items-center gap-1 text-[11px] cursor-pointer font-bold"
                        >
                            <span className={`material-symbols-outlined text-sm ${isScanning ? 'animate-spin' : ''}`}>refresh</span>
                            {isScanning ? 'Memindai...' : 'Scan Ulang (Real)'}
                        </button>
                    </div>

                    <div className="max-h-40 overflow-y-auto space-y-1.5 p-1">
                        {detectedNetworks.length === 0 ? (
                            <div className="text-center py-4 text-xs text-gray-400 font-medium">
                                {isScanning ? 'Memindai Wi-Fi fisik di sekitar...' : 'Tidak ada Wi-Fi terdeteksi'}
                            </div>
                        ) : (
                            detectedNetworks.map((net) => (
                                <button
                                    key={net.ssid}
                                    type="button"
                                    onClick={() => setWifiSSID(net.ssid)}
                                    className={`w-full text-left px-3.5 py-2.5 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${wifiSSID === net.ssid ? 'bg-aqua-primary/10 border-aqua-primary font-bold text-aqua-primary' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="material-symbols-outlined text-base text-gray-400">wifi</span>
                                        <span className="truncate">{net.ssid}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] text-gray-400">{net.security}</span>
                                        <span className="text-[10px] font-bold text-aqua-primary bg-white px-2 py-0.5 rounded border border-gray-100">{net.rssi} dBm</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Wi-Fi Input Form */}
                <form onSubmit={onSubmit} className="space-y-4 pt-1">
                    <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1">SSID (Nama Wi-Fi)</label>
                        <input
                            type="text"
                            placeholder="Masukkan SSID"
                            value={wifiSSID}
                            onChange={(e) => setWifiSSID(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-aqua-primary focus:ring-1 focus:ring-aqua-primary"
                            required
                        />
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1">Password Wi-Fi</label>
                        <input
                            type="password"
                            placeholder="Masukkan Password"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-aqua-primary focus:ring-1 focus:ring-aqua-primary"
                        />
                    </div>

                    {statusMessage && (
                        <p className="text-xs text-center font-bold text-aqua-primary animate-pulse py-1">
                            {statusMessage}
                        </p>
                    )}

                    <div className="flex items-center gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 cursor-pointer"
                        >
                            Batal
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-2.5 bg-aqua-primary text-white rounded-xl font-bold text-xs hover:bg-aqua-primary/90 shadow-sm transition-all cursor-pointer"
                        >
                            {isSaving ? 'Menyimpan...' : 'Update Wi-Fi'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
