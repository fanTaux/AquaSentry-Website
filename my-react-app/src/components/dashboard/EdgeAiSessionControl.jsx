import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';

export default function EdgeAiSessionControl() {
    const {
        isDeviceOnline,
        isTesting,
        testElapsedSec,
        finalVerdict,
        sendCommand
    } = useAppContext();

    const [isActionLoading, setIsActionLoading] = useState(false);
    const [actionFeedback, setActionFeedback] = useState('');

    const elapsed = Math.min(Math.max(testElapsedSec || 0, 0), 30);
    const progressPercent = Math.round((elapsed / 30) * 100);
    const remainingSec = Math.max(0, 30 - elapsed);

    const handleStartTest = async () => {
        setIsActionLoading(true);
        setActionFeedback('Mengirim sinyal mulai ke ESP32...');
        try {
            await sendCommand({ command: 'START_TEST' });
            setTimeout(() => setActionFeedback(''), 3000);
        } catch (err) {
            setActionFeedback('Gagal: ' + err.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    const handleCancelTest = async () => {
        setIsActionLoading(true);
        setActionFeedback('Membatalkan pengujian...');
        try {
            await sendCommand({ command: 'CANCEL_TEST' });
            setTimeout(() => setActionFeedback(''), 3000);
        } catch (err) {
            setActionFeedback('Gagal: ' + err.message);
        } finally {
            setIsActionLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-3xl p-5 md:p-6 border border-gray-100 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                {/* Minimal Header: Icon + Title + Status */}
                <div className="flex items-center gap-3.5">
                    <div className="w-11 h-11 rounded-2xl bg-aqua-secondary/15 flex items-center justify-center flex-shrink-0 text-aqua-primary">
                        <span className="material-symbols-outlined text-2xl">science</span>
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base md:text-lg font-black text-aqua-text tracking-tight">
                                Pengujian Sensor & Klasifikasi Air
                            </h2>
                            {finalVerdict && !isTesting && (
                                <span className="px-2.5 py-0.5 rounded-full text-xs font-black bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-2xs">
                                    Hasil: {finalVerdict} Risk
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs font-bold">
                            <span className={`w-2 h-2 rounded-full ${
                                !isDeviceOnline ? 'bg-gray-400' : isTesting ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                            }`}></span>
                            <span className={
                                !isDeviceOnline ? 'text-gray-400' : isTesting ? 'text-amber-600' : 'text-emerald-700'
                            }>
                                {!isDeviceOnline ? 'ESP32 Offline' : isTesting ? `Sedang Menguji (${elapsed}s / 30s)` : 'ESP32 Siap Uji (Standby)'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Direct Action Button (Mulai Pengujian) */}
                <div className="flex items-center self-start sm:self-auto w-full sm:w-auto">
                    {!isTesting ? (
                        <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={handleStartTest}
                            className="w-full sm:w-auto bg-aqua-primary hover:bg-aqua-primary-hover active:scale-95 text-white text-xs font-black uppercase tracking-wider py-3.5 px-8 rounded-2xl shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            <span className="material-symbols-outlined text-lg">play_arrow</span>
                            <span>Mulai Pengujian (30 Detik)</span>
                        </button>
                    ) : (
                        <button
                            type="button"
                            disabled={isActionLoading}
                            onClick={handleCancelTest}
                            className="w-full sm:w-auto bg-rose-50 hover:bg-rose-100 active:scale-95 text-rose-700 border border-rose-200 text-xs font-black uppercase tracking-wider py-3.5 px-8 rounded-2xl transition-all flex items-center justify-center gap-2 cursor-pointer"
                        >
                            <span className="material-symbols-outlined text-lg">close</span>
                            <span>Batalkan Pengujian ({remainingSec}s)</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Progress Bar (Hanya tampil saat pengujian sedang berjalan) */}
            {isTesting && (
                <div className="space-y-1.5 pt-1 animate-fade-in">
                    <div className="flex justify-between items-center text-xs text-aqua-text-muted font-bold">
                        <span>Progres Uji 30 Detik</span>
                        <span>{elapsed}s / 30s (sisa {remainingSec}s)</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                        <div
                            className="h-full bg-aqua-primary rounded-full transition-all duration-300"
                            style={{ width: `${progressPercent}%` }}
                        ></div>
                    </div>
                </div>
            )}

            {actionFeedback && (
                <div className="text-xs font-semibold text-aqua-primary bg-aqua-secondary/15 px-3 py-2 rounded-xl">
                    {actionFeedback}
                </div>
            )}
        </div>
    );
}
