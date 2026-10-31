import { useState, useEffect, useRef } from 'react';

const BACKEND_API_URL = 'http://localhost:8000';

export function riskCategoryFromML(mlCategory, tds, turbidity) {
    const cat = String(mlCategory || '').toLowerCase();

    // 1. Prioritaskan hasil inferensi Edge AI Random Forest / Konsensus ESP32
    if (cat.includes('low')) {
        return { level: 'low', label: 'Low Risk', color: '#2DC653' };
    } else if (cat.includes('med') || cat.includes('moderate')) {
        return { level: 'moderate', label: 'Moderate Risk', color: '#F4A261' };
    } else if (cat.includes('high') || cat.includes('tercemar')) {
        return { level: 'high', label: 'High Risk', color: '#E63946' };
    }

    // 2. Fallback berdasarkan batas wilayah sebaran dataset resmi AquaSentry
    // Zone Low: TDS < 185 ppm, Turbidity < 120 NTU
    // Zone Med: TDS 185-260 ppm, Turbidity 120-350 NTU
    // Zone High: TDS > 260 ppm, Turbidity > 330 NTU
    if (tds > 260 || turbidity > 330) {
        return { level: 'high', label: 'High Risk', color: '#E63946' };
    } else if (tds > 185 || turbidity > 120) {
        return { level: 'moderate', label: 'Moderate Risk', color: '#F4A261' };
    } else {
        return { level: 'low', label: 'Low Risk', color: '#2DC653' };
    }
}

export function computeRiskScore(mlCategory, tds, turbidity) {
    const cat = String(mlCategory || '').toLowerCase();

    // Skala AquaSentry Risk Score (0 - 100):
    // Low Risk: 5 - 24%
    // Moderate Risk: 25 - 65%
    // High Risk: 66 - 98%
    if (cat.includes('low')) {
        const tFrac = Math.min(1.0, Math.max(0.0, (tds - 15) / 170));
        const turbFrac = Math.min(1.0, Math.max(0.0, turbidity / 120));
        const score = 8.0 + (0.5 * tFrac + 0.5 * turbFrac) * 14.0;
        return Math.round(score * 10) / 10;
    } else if (cat.includes('med') || cat.includes('moderate')) {
        const tFrac = Math.min(1.0, Math.max(0.0, (tds - 185) / 75));
        const turbFrac = Math.min(1.0, Math.max(0.0, (turbidity - 120) / 230));
        const score = 32.0 + (0.5 * tFrac + 0.5 * turbFrac) * 28.0;
        return Math.round(score * 10) / 10;
    } else if (cat.includes('high') || cat.includes('tercemar')) {
        const tFrac = Math.min(1.0, Math.max(0.0, (tds - 280) / 240));
        const turbFrac = Math.min(1.0, Math.max(0.0, (turbidity - 330) / 220));
        const score = 72.0 + (0.5 * tFrac + 0.5 * turbFrac) * 24.0;
        return Math.round(score * 10) / 10;
    }

    if (tds > 260 || turbidity > 330) {
        return 82.5;
    } else if (tds > 185 || turbidity > 120) {
        return 45.0;
    } else {
        return 14.2;
    }
}

const initialStandbyReading = {
    tds: 0,
    turbidity: 0,
    ars: 0,
    risk: { level: 'low', label: 'Standby (Menunggu Data)', color: '#64748b' },
    timestamp: null
};

export function useTelemetry(setHasNewAlert) {
    const [reading, setReading] = useState(initialStandbyReading);
    const [history, setHistory] = useState(() => {
        try {
            const saved = localStorage.getItem('aquasentry_telemetry_history');
            if (saved !== null) {
                const parsed = JSON.parse(saved);
                if (Array.isArray(parsed)) return parsed;
            }
        } catch (e) {}
        return [];
    });
    const [isConnected, setIsConnected] = useState(true);
    const [isEspOnline, setIsEspOnline] = useState(false);
    const [deviceStatus, setDeviceStatus] = useState('offline');
    const [isTesting, setIsTesting] = useState(false);
    const [testElapsedSec, setTestElapsedSec] = useState(0);
    const [preset, setPreset] = useState('LOW');
    const [aiPrediction, setAiPrediction] = useState('Standby');
    const [finalVerdict, setFinalVerdict] = useState(null);
    const [voteCounts, setVoteCounts] = useState({ low: 0, medium: 0, high: 0 });

    const wasTestingRef = useRef(false);
    const historyLengthRef = useRef(history.length);

    const refreshBackendHistory = async () => {
        try {
            const res = await fetch(`${BACKEND_API_URL}/api/telemetry/history?limit=50`);
            if (res.ok) {
                const json = await res.json();
                if (json.ok && Array.isArray(json.data)) {
                    const formatted = json.data.map(d => {
                        const tdsVal = d.tds_ppm ?? d.tds_mg_l ?? 0.0;
                        const turbVal = d.turbidity_ntu ?? 0.0;
                        const eff = d.ml_risk_category || d.ai_prediction || 'Low';
                        return {
                            tds: tdsVal,
                            turbidity: turbVal,
                            ars: d.ass_score ?? computeRiskScore(eff, tdsVal, turbVal),
                            risk: riskCategoryFromML(eff, tdsVal, turbVal),
                            timestamp: d.timestamp || Date.now(),
                            is_testing: Boolean(d.is_testing),
                            edge_ai_prediction: d.ai_prediction
                        };
                    });
                    setHistory(formatted);
                    historyLengthRef.current = formatted.length;
                    try {
                        localStorage.setItem('aquasentry_telemetry_history', JSON.stringify(formatted));
                    } catch (e) {}
                }
            }
        } catch (e) {}
    };

    // Initial load: sync from backend history if available
    useEffect(() => {
        refreshBackendHistory();
    }, []);

    useEffect(() => {
        const fetchLatestTelemetry = async () => {
            try {
                const res = await fetch(`${BACKEND_API_URL}/api/telemetry/latest`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok) {
                        const isOnline = Boolean(json.is_esp_online);
                        setIsEspOnline(isOnline);
                        setIsConnected(true);

                        const testingNow = Boolean(json.is_testing);
                        if (wasTestingRef.current && !testingNow) {
                            // Pengujian 30 detik selesai -> ambil 1 baris hasil ringkasan resmi dari backend
                            refreshBackendHistory();
                        }
                        wasTestingRef.current = testingNow;

                        // Jika backend mendeteksi adanya data riwayat baru
                        if (typeof json.history_count === 'number' && json.history_count !== historyLengthRef.current) {
                            refreshBackendHistory();
                        }

                        if (json.device_status) setDeviceStatus(json.device_status);
                        if (typeof json.is_testing === 'boolean') setIsTesting(json.is_testing);
                        if (typeof json.test_elapsed_sec === 'number') setTestElapsedSec(json.test_elapsed_sec);
                        if (json.preset) setPreset(json.preset);
                        if (json.ai_prediction) setAiPrediction(json.ai_prediction);
                        if (json.final_verdict !== undefined) setFinalVerdict(json.final_verdict);
                        if (json.vote_counts) setVoteCounts(json.vote_counts);

                        if (json.data) {
                            const d = json.data;
                            const tdsVal = d.tds_ppm ?? d.tds_mg_l ?? 0.0;
                            const turbVal = d.turbidity_ntu ?? 0.0;

                            // Prioritaskan konsensus hasil akhir atau klasifikasi Edge AI Random Forest
                            const effectiveCategory = json.final_verdict || json.ai_prediction || d.ml_risk_category || d.ai_prediction || 'Low';
                            const risk = riskCategoryFromML(effectiveCategory, tdsVal, turbVal);
                            const arsScore = computeRiskScore(effectiveCategory, tdsVal, turbVal);

                            const packetTimestamp = d.timestamp;

                            const next = {
                                tds: tdsVal,
                                turbidity: turbVal,
                                ars: arsScore,
                                risk: risk,
                                timestamp: packetTimestamp || Date.now(),
                                is_testing: Boolean(json.is_testing),
                                edge_ai_prediction: json.ai_prediction || d.ai_prediction
                            };

                            // Update live gauge / metrics display
                            setReading(next);

                            if ((risk.level === 'high' || risk.level === 'veryhigh') && setHasNewAlert) {
                                setHasNewAlert(true);
                            }
                        } else if (!json.data) {
                            // Belum ada data pengukuran masuk dari ESP32
                            setReading(initialStandbyReading);
                        }
                        return;
                    }
                }
            } catch (err) {
                setIsConnected(false);
                setIsEspOnline(false);
                setDeviceStatus('offline');
            }
        };

        const timer = setInterval(fetchLatestTelemetry, 1000);
        return () => clearInterval(timer);
    }, [setHasNewAlert]);

    const clearHistory = async () => {
        setHistory([]);
        historyLengthRef.current = 0;
        setReading(initialStandbyReading);
        try {
            localStorage.setItem('aquasentry_telemetry_history', JSON.stringify([]));
            await fetch(`${BACKEND_API_URL}/api/telemetry/history`, { method: 'DELETE' });
        } catch (e) {}
    };

    return {
        reading,
        history,
        clearHistory,
        isConnected,
        isEspOnline,
        deviceStatus,
        isTesting,
        testElapsedSec,
        preset,
        aiPrediction,
        finalVerdict,
        voteCounts
    };
}
