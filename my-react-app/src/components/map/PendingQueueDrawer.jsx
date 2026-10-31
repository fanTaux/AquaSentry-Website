import React, { useState, useEffect } from 'react';

export default function PendingQueueDrawer({
    isOpen,
    onClose,
    queue = [],
    onTagTest,
    onDismissTest,
    onClearAll
}) {
    const hasItems = queue && queue.length > 0;

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 overflow-hidden animate-fade-in">
            {/* Backdrop Blur */}
            <div
                className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs transition-opacity duration-300"
                onClick={onClose}
                aria-hidden="true"
            />

            {/* Slide Drawer Panel (Slides in from the Right) */}
            <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
                <div className="w-screen max-w-md bg-white shadow-2xl flex flex-col border-l border-gray-100 animate-slide-left">
                    {/* Drawer Header */}
                    <div className="p-5 border-b border-gray-100 bg-gradient-to-r from-blue-50/60 to-white flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-2xl bg-aqua-primary/10 text-aqua-primary flex items-center justify-center shadow-2xs">
                                <span className="material-symbols-outlined text-xl">
                                    {hasItems ? 'notifications_active' : 'inbox'}
                                </span>
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <h2 className="text-base font-black text-aqua-text tracking-tight">
                                        Antrean Hasil Uji
                                    </h2>
                                    <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                                        hasItems 
                                            ? 'bg-aqua-primary text-white shadow-2xs' 
                                            : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {queue.length}
                                    </span>
                                </div>
                                <p className="text-xs text-gray-400 font-medium mt-0.5">
                                    Sampel ESP32 siap diplot ke peta
                                </p>
                            </div>
                        </div>

                        {/* Close Button */}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-800 flex items-center justify-center transition-colors cursor-pointer"
                            title="Tutup Antrean (Esc)"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                        </button>
                    </div>

                    {/* Toolbar / Actions Strip */}
                    <div className="px-5 py-2.5 bg-gray-50/80 border-b border-gray-100 flex items-center justify-between gap-2">
                        <div className="text-[11px] font-bold text-gray-500 flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span>Waktu RTC Lapangan Terkunci</span>
                        </div>

                        <div className="flex items-center gap-1.5">
                            {hasItems && onClearAll && (
                                <button
                                    type="button"
                                    onClick={onClearAll}
                                    className="text-gray-400 hover:text-rose-600 hover:bg-rose-50 text-[11px] font-bold px-2.5 py-1 rounded-lg transition-colors cursor-pointer flex items-center gap-1"
                                    title="Bersihkan semua hasil uji di antrean"
                                >
                                    <span className="material-symbols-outlined text-xs">delete_sweep</span>
                                    <span>Hapus Semua</span>
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Drawer Content (Scrollable List) */}
                    <div className="flex-1 overflow-y-auto p-5 space-y-3">
                        {hasItems ? (
                            queue.map((item, idx) => {
                                const isLow = item.final_verdict === 'Low' || item.final_verdict === 'Aman';
                                const isMed = item.final_verdict === 'Medium';

                                const badgeColor = isLow
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : isMed
                                    ? 'bg-amber-50 text-amber-700 border-amber-200'
                                    : 'bg-rose-50 text-rose-700 border-rose-200';

                                const badgeLabel = isLow
                                    ? '🟢 Aman'
                                    : isMed
                                    ? '🟡 Waspada'
                                    : '🔴 Bahaya';

                                return (
                                    <div
                                        key={item.test_id || idx}
                                        className="bg-white rounded-2xl border border-gray-200/80 p-4 shadow-2xs hover:shadow-xs hover:border-aqua-primary/40 transition-all flex flex-col justify-between gap-3 relative overflow-hidden group"
                                    >
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-aqua-primary"></div>

                                        <div className="space-y-2 pl-1.5">
                                            {/* Header Kartu: ID & Counter & Badge */}
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-1.5">
                                                    <span className="text-[10px] font-mono font-bold text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                        #{idx + 1}
                                                    </span>
                                                    <span className="text-xs font-mono font-bold text-gray-800 truncate" title={item.test_id}>
                                                        {item.test_id}
                                                    </span>
                                                </div>
                                                <span className={`text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                                    {badgeLabel}
                                                </span>
                                            </div>

                                            {/* Jam Lapangan (RTC ESP32) */}
                                            <div className="flex items-center gap-1.5 text-xs font-bold text-gray-700 bg-gray-50 px-2.5 py-1.5 rounded-xl border border-gray-100">
                                                <span className="material-symbols-outlined text-sm text-aqua-primary">schedule</span>
                                                <span>{item.timestamp_esp || 'Baru saja'}</span>
                                            </div>

                                            {/* Parameter 30 Detik (TDS & Kekeruhan) */}
                                            <div className="grid grid-cols-2 gap-2 pt-0.5">
                                                <div className="bg-sky-50/50 p-2 rounded-xl border border-sky-100 text-center">
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">TDS</span>
                                                    <span className="text-sm font-black text-aqua-text">
                                                        {item.avg_tds} <span className="text-[10px] font-semibold text-gray-400">ppm</span>
                                                    </span>
                                                </div>
                                                <div className="bg-sky-50/50 p-2 rounded-xl border border-sky-100 text-center">
                                                    <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider block">Kekeruhan</span>
                                                    <span className="text-sm font-black text-aqua-text">
                                                        {item.avg_turbidity} <span className="text-[10px] font-semibold text-gray-400">NTU</span>
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Buttons */}
                                        <div className="flex items-center gap-2 pt-2 border-t border-gray-100 pl-1.5">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    onTagTest(item);
                                                    onClose();
                                                }}
                                                className="flex-1 bg-aqua-primary hover:bg-aqua-primary/90 active:scale-95 text-white text-xs font-black py-2.5 px-3 rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">add_location_alt</span>
                                                <span>Tandai ke Peta Ini</span>
                                            </button>
                                            <button
                                                type="button"
                                                title="Abaikan hasil uji ini"
                                                onClick={() => onDismissTest(item.test_id)}
                                                className="p-2 text-gray-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
                                            >
                                                <span className="material-symbols-outlined text-base">close</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            /* Empty State */
                            <div className="h-full flex flex-col items-center justify-center text-center p-8 space-y-3">
                                <div className="w-16 h-16 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
                                    <span className="material-symbols-outlined text-3xl">inbox</span>
                                </div>
                                <div className="space-y-1">
                                    <h3 className="text-sm font-black text-gray-700">Antrean Masih Kosong</h3>
                                    <p className="text-xs text-gray-400 max-w-xs leading-relaxed">
                                        Tekan tombol fisik pada alat ESP32 atau tombol Mulai Uji. Setelah 30 detik selesai, hasil ringkasan akan otomatis mendarat di sini.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Drawer Footer */}
                    <div className="p-4 border-t border-gray-100 bg-gray-50/60 text-center text-[11px] text-gray-400 font-medium">
                        AquaSentry Edge AI • Otomatis sinkron dari HiveMQ Cloud
                    </div>
                </div>
            </div>
        </div>
    );
}
