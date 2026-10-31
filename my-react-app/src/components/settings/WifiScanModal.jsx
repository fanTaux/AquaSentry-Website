import { useEffect } from 'react';

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
    onOpenPortal,
    isSaving,
    statusMessage
}) {
    // Tutup modal saat tombol Escape ditekan
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div 
            className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-fade-in"
            onClick={(e) => {
                if (e.target === e.currentTarget) {
                    onClose();
                }
            }}
        >
            <div className="relative bg-white rounded-2xl sm:rounded-3xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 border border-gray-100 max-h-[92vh] overflow-y-auto">
                {/* Tombol Close 'X' di Pojok Kanan Atas */}
                <button
                    type="button"
                    onClick={onClose}
                    className="absolute top-3.5 right-3.5 sm:top-4 sm:right-4 w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 active:scale-95 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-all cursor-pointer z-20 shadow-xs"
                    title="Tutup (Esc)"
                    aria-label="Tutup"
                >
                    <span className="material-symbols-outlined text-xl">close</span>
                </button>

                <div className="text-center space-y-1.5 sm:space-y-2 pr-6">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 bg-aqua-secondary/20 text-aqua-primary rounded-xl sm:rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                        <span className="material-symbols-outlined text-2xl sm:text-3xl">wifi_password</span>
                    </div>
                    <h3 className="text-lg sm:text-xl font-black text-aqua-text tracking-tight">Konfigurasi Wi-Fi ESP32</h3>
                    <p className="text-[11px] sm:text-xs text-aqua-text-muted">Sambungkan perangkat ESP32 ke Hotspot HP atau Wi-Fi yang Anda gunakan.</p>
                </div>

                {/* Scan Results List */}
                <div className="space-y-1.5 sm:space-y-2">
                    <div className="flex items-center justify-between text-[11px] sm:text-xs font-bold text-gray-500 px-1">
                        <span>JARINGAN TERDETEKSI (REAL)</span>
                        <button
                            type="button"
                            onClick={onScan}
                            disabled={isScanning}
                            className="text-aqua-primary hover:underline flex items-center gap-1 text-[10px] sm:text-[11px] cursor-pointer font-bold"
                        >
                            <span className={`material-symbols-outlined text-xs sm:text-sm ${isScanning ? 'animate-spin' : ''}`}>refresh</span>
                            {isScanning ? 'Memindai...' : 'Scan Ulang'}
                        </button>
                    </div>

                    <div className="max-h-36 overflow-y-auto space-y-1 p-0.5">
                        {detectedNetworks.length === 0 ? (
                            <div className="text-center py-3 text-xs text-gray-400 font-medium bg-gray-50/80 rounded-xl border border-dashed border-gray-200">
                                {isScanning ? 'Memindai Wi-Fi fisik di sekitar...' : 'Tidak ada Wi-Fi terdeteksi. Silakan ketik nama Hotspot/SSID di bawah.'}
                            </div>
                        ) : (
                            detectedNetworks.map((net) => (
                                <button
                                    key={net.ssid}
                                    type="button"
                                    onClick={() => setWifiSSID(net.ssid)}
                                    className={`w-full text-left px-3 py-2 rounded-xl border text-xs flex items-center justify-between transition-all cursor-pointer ${wifiSSID === net.ssid ? 'bg-aqua-primary/10 border-aqua-primary font-bold text-aqua-primary' : 'bg-gray-50 border-gray-100 hover:bg-gray-100'}`}
                                >
                                    <div className="flex items-center gap-2 min-w-0">
                                        <span className="material-symbols-outlined text-base text-gray-400">wifi</span>
                                        <span className="truncate">{net.ssid}</span>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-[10px] text-gray-400 hidden xs:inline">{net.security}</span>
                                        <span className="text-[10px] font-bold text-aqua-primary bg-white px-2 py-0.5 rounded border border-gray-100">{net.rssi} dBm</span>
                                    </div>
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* Wi-Fi Input Form */}
                <form onSubmit={onSubmit} className="space-y-3 pt-1">
                    <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1">SSID / Nama Hotspot HP</label>
                        <input
                            type="text"
                            placeholder="Ketik nama Hotspot HP Anda (contoh: HP_Saya)"
                            value={wifiSSID}
                            onChange={(e) => setWifiSSID(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-aqua-primary focus:ring-1 focus:ring-aqua-primary"
                            required
                        />
                        <span className="text-[10px] text-gray-400 mt-1 block">
                            Ketik nama Hotspot HP Anda secara manual jika tidak muncul pada daftar scan di atas.
                        </span>
                    </div>

                    <div>
                        <label className="text-[11px] font-bold text-gray-600 block mb-1">Password Wi-Fi / Hotspot</label>
                        <input
                            type="password"
                            placeholder="Masukkan Password (kosongkan jika tanpa password)"
                            value={wifiPassword}
                            onChange={(e) => setWifiPassword(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 text-xs font-medium focus:outline-none focus:border-aqua-primary focus:ring-1 focus:ring-aqua-primary"
                        />
                    </div>

                    {statusMessage && (
                        <p className="text-xs text-center font-bold text-aqua-primary animate-pulse py-1">
                            {statusMessage}
                        </p>
                    )}

                    <div className="flex items-center gap-2.5 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-200 text-gray-600 rounded-xl font-bold text-xs hover:bg-gray-50 active:scale-98 transition-all cursor-pointer"
                        >
                            Tutup
                        </button>
                        <button
                            type="submit"
                            disabled={isSaving}
                            className="flex-1 py-2.5 bg-aqua-primary text-white rounded-xl font-bold text-xs hover:bg-aqua-primary-hover active:scale-98 shadow-xs transition-all cursor-pointer disabled:opacity-50"
                        >
                            {isSaving ? 'Menyimpan...' : 'Kirim ke ESP32'}
                        </button>
                    </div>
                </form>

                {/* Option 2: Captive Portal Direct AP Trigger */}
                <div className="pt-3 border-t border-gray-100 space-y-2">
                    <div className="flex items-start gap-2 bg-amber-50/70 border border-amber-200/80 p-2.5 rounded-xl text-amber-800">
                        <span className="material-symbols-outlined text-base shrink-0 mt-0.5">help</span>
                        <p className="text-[10px] sm:text-[11px] leading-relaxed">
                            <strong>Mode Darurat (Captive Portal):</strong> Jika ESP32 belum terhubung sama sekali, Anda bisa mengaktifkan Hotspot mandiri ESP32:
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onOpenPortal}
                        disabled={isSaving}
                        className="w-full py-2.5 bg-amber-500 hover:bg-amber-600 active:scale-98 text-white rounded-xl font-bold text-xs shadow-xs transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                    >
                        <span className="material-symbols-outlined text-base">cell_tower</span>
                        <span>Buka Hotspot Setup (ESP32_WaterAI)</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
