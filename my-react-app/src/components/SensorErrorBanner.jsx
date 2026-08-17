import { useState } from 'react';

export default function SensorErrorBanner() {
    const [isVisible, setIsVisible] = useState(false);

    if (!isVisible) return null;

    return (
        <div className="bg-error-container text-on-error-container p-md rounded-xl flex items-start gap-md border border-error/20 shadow-sm" id="sensor-error-banner">
            <div className="w-10 h-10 rounded-full bg-error/10 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-error">warning</span>
            </div>
            <div className="flex-1">
                <h3 className="font-headline-md text-headline-md mb-1 text-error">Peringatan Sensor!</h3>
                <p className="text-body-md mb-2 text-on-error-container">Pemeriksaan tahunan mendeteksi anomali. Beberapa sensor mungkin perlu diganti untuk performa yang optimal.</p>
                <ul className="list-disc list-inside text-sm font-label-lg space-y-1 mb-4 text-on-error-container/80">
                    <li>Sensor TDS - Akurasi menurun (Perlu dikalibrasi ulang)</li>
                    <li>Sensor Turbidity - Berfungsi normal</li>
                </ul>
                <button className="bg-error text-on-error px-4 py-2 rounded-lg font-label-lg text-label-lg hover:bg-error/90 transition-colors shadow-sm">
                    Jadwalkan Perawatan
                </button>
            </div>
            <button className="text-error hover:bg-error/10 p-1 rounded-full transition-colors shrink-0" onClick={() => setIsVisible(false)}>
                <span className="material-symbols-outlined">close</span>
            </button>
        </div>
    );
}
