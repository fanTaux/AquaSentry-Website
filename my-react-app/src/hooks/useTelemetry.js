import { useState, useEffect, useRef } from 'react';

const BACKEND_API_URL = 'http://localhost:8000';

function riskCategoryFromML(mlCategory, assScore, tds, turbidity) {
    const cat = String(mlCategory || '').toLowerCase();

    if (cat.includes('very high') || cat.includes('veryhigh') || tds > 600 || turbidity > 6.0) {
        return { level: 'veryhigh', label: 'Very High Risk', color: '#E63946' };
    } else if (cat.includes('high') || tds > 300 || turbidity > 3.0) {
        return { level: 'high', label: 'High Risk', color: '#F07A3C' };
    } else if (cat.includes('moderate') || tds > 150 || turbidity > 1.5) {
        return { level: 'moderate', label: 'Moderate Risk', color: '#F4A261' };
    } else {
        return { level: 'low', label: 'Low Risk', color: '#2DC653' };
    }
}

function computeASS(tds, turbidity) {
    const r_tds = tds / 300.0;
    const r_turb = turbidity / 3.0;
    const ari = 0.5 * r_tds + 0.5 * r_turb;
    const ass = 100.0 / (1.0 + ari);
    return Math.round(ass * 10) / 10;
}

const testProfiles = [
    { tds: 100.0, turb: 0.5, label: 'Low Risk' },
    { tds: 180.0, turb: 2.0, label: 'Moderate Risk' },
    { tds: 350.0, turb: 4.5, label: 'High Risk' },
    { tds: 800.0, turb: 7.5, label: 'Very High Risk' }
];

let simIndex = 0;
function buildInitialReading() {
    const profile = testProfiles[simIndex % testProfiles.length];
    simIndex++;
    const tds = profile.tds;
    const turbidity = profile.turb;
    const ass = computeASS(tds, turbidity);
    const risk = riskCategoryFromML(profile.label, ass, tds, turbidity);

    return {
        tds: Math.round(tds * 10) / 10,
        turbidity: Math.round(turbidity * 10) / 10,
        ars: ass,
        risk: risk,
        timestamp: Date.now()
    };
}

export function useTelemetry(setHasNewAlert) {
    const [reading, setReading] = useState(() => buildInitialReading());
    const [history, setHistory] = useState([]);
    const [isConnected, setIsConnected] = useState(true);
    const [isEspOnline, setIsEspOnline] = useState(false);
    const historyRef = useRef([]);

    useEffect(() => {
        const fetchLatestTelemetry = async () => {
            try {
                const res = await fetch(`${BACKEND_API_URL}/api/telemetry/latest`);
                if (res.ok) {
                    const json = await res.json();
                    if (json.ok && json.data) {
                        const isOnline = Boolean(json.is_esp_online);
                        setIsEspOnline(isOnline);
                        setIsConnected(isOnline);

                        if (isOnline) {
                            const d = json.data;
                            const ass = d.ass_score ?? computeASS(d.tds_mg_l, d.turbidity_ntu);
                            const risk = riskCategoryFromML(d.ml_risk_category || d.rule_category, ass, d.tds_mg_l, d.turbidity_ntu);

                            const next = {
                                tds: d.tds_mg_l,
                                turbidity: d.turbidity_ntu,
                                ars: ass,
                                risk: risk,
                                timestamp: d.timestamp || Date.now()
                            };

                            setReading(next);
                            historyRef.current = [...historyRef.current.slice(-49), next];
                            setHistory(historyRef.current);

                            if ((risk.level === 'high' || risk.level === 'veryhigh') && setHasNewAlert) {
                                setHasNewAlert(true);
                            }
                        }
                        return;
                    }
                }
            } catch (err) {
                setIsConnected(false);
                setIsEspOnline(false);
            }
        };

        // Seed initial history
        const seeded = Array.from({ length: 12 }).map((_, i) => {
            const prof = testProfiles[i % testProfiles.length];
            return {
                tds: prof.tds,
                turbidity: prof.turb,
                ars: computeASS(prof.tds, prof.turb),
                risk: riskCategoryFromML(prof.label, computeASS(prof.tds, prof.turb), prof.tds, prof.turb),
                timestamp: Date.now() - (12 - i) * 2000
            };
        });
        historyRef.current = seeded;
        setHistory(seeded);

        const timer = setInterval(fetchLatestTelemetry, 1000);
        return () => clearInterval(timer);
    }, [setHasNewAlert]);

    return {
        reading,
        history,
        isConnected,
        isEspOnline
    };
}
