import { createContext, useContext, useEffect, useState, useRef } from 'react';

const AppContext = createContext();

// ---- AquaSentry Risk Score (ARS) helper -----------------------------------
// Demo-only scoring so the dashboard has believable numbers without a real
// backend/model. Ranges follow the abstrak: TDS 0-1500 ppm (WHO/Permenkes),
// turbidity 0-10 NTU. Category thresholds: Low 0-25, Moderate 26-50,
// High 51-75, Very High 76-100.
function computeARS(tds, turbidity) {
    const tdsScore = Math.min(100, (tds / 1500) * 100);
    const turbScore = Math.min(100, (turbidity / 10) * 100);
    // demo weighting only — real weighting comes from trained model feature
    // importance, not a fixed assumption (see abstrak revision notes)
    const ars = tdsScore * 0.55 + turbScore * 0.45;
    return Math.round(ars);
}

function riskCategoryFromARS(ars) {
    if (ars <= 25) return { level: 'low', label: 'Low Risk', color: '#2DC653' };
    if (ars <= 50) return { level: 'moderate', label: 'Moderate Risk', color: '#F4A261' };
    if (ars <= 75) return { level: 'high', label: 'High Risk', color: '#F07A3C' };
    return { level: 'veryhigh', label: 'Very High Risk', color: '#E63946' };
}

function randomWalk(value, min, max, step) {
    const delta = (Math.random() - 0.5) * step;
    return Math.min(max, Math.max(min, value + delta));
}

const DEMO_DEVICE_ID = 'aquasentry-demo-01';
const DEMO_DEVICE_NAME = 'AquaSentry Unit #1';

function buildReading(prevTds, prevTurbidity) {
    const tds = randomWalk(prevTds ?? 320, 20, 1500, 60);
    const turbidity = randomWalk(prevTurbidity ?? 2.5, 0, 10, 1.2);
    const ars = computeARS(tds, turbidity);
    const risk = riskCategoryFromARS(ars);
    return { tds, turbidity, ars, risk, timestamp: Date.now() };
}

export function AppProvider({ children }) {
    const [token, setToken] = useState(sessionStorage.getItem('aquasentry_token') || null);
    const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('aquasentry_user') || 'null'));

    const [activeDeviceId, setActiveDeviceId] = useState(DEMO_DEVICE_ID);
    const [hasNewAlert, setHasNewAlert] = useState(false);
    const [now, setNow] = useState(Date.now());

    // rolling reading history for charts / alert history (demo, in-memory only)
    const historyRef = useRef([]);
    const [history, setHistory] = useState([]);
    const [reading, setReading] = useState(() => buildReading());

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 2000);
        return () => clearInterval(timer);
    }, []);

    // simulate a device reporting a new reading every 8s — this is where a
    // real MQTT/WebSocket handler would plug in later when the AquaSentry
    // backend exists; the rest of the app only depends on `state`/`history`
    // shapes below, so swapping this block for a real connection later
    // shouldn't require touching the components.
    useEffect(() => {
        const timer = setInterval(() => {
            setReading(prev => {
                const next = buildReading(prev.tds, prev.turbidity);
                historyRef.current = [...historyRef.current.slice(-49), next];
                setHistory(historyRef.current);
                if (next.risk.level === 'high' || next.risk.level === 'veryhigh') {
                    setHasNewAlert(true);
                }
                return next;
            });
        }, 8000);
        // seed initial history
        const seeded = Array.from({ length: 12 }).map((_, i) => {
            const r = buildReading(300 + i * 5, 2 + i * 0.2);
            r.timestamp = Date.now() - (12 - i) * 8000;
            return r;
        });
        historyRef.current = seeded;
        setHistory(seeded);
        return () => clearInterval(timer);
    }, []);

    const devices = {
        [DEMO_DEVICE_ID]: {
            id: DEMO_DEVICE_ID,
            name: DEMO_DEVICE_NAME,
            isRegistered: true,
        },
    };

    const isConnected = true; // demo mode: always "connected" locally
    const espLastSeen = now; // pretend the device just reported
    const isDeviceOnline = true;

    const login = async (username, _password) => {
        // Demo-mode login: no backend, any non-empty username signs in locally.
        if (!username) return { ok: false, error: 'Masukkan nama pengguna' };
        const demoUser = { name: username, role: 'demo' };
        const demoToken = 'demo-token';
        setToken(demoToken);
        setUser(demoUser);
        sessionStorage.setItem('aquasentry_token', demoToken);
        sessionStorage.setItem('aquasentry_user', JSON.stringify(demoUser));
        return { ok: true };
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        sessionStorage.removeItem('aquasentry_token');
        sessionStorage.removeItem('aquasentry_user');
    };

    // AquaSentry has no actuators (read-only screening device) — kept as a
    // no-op so any leftover call sites don't crash, but there is intentionally
    // nothing to control.
    const sendCommand = async () => { };
    const fetchDevices = async () => { };

    const state = {
        tds: reading.tds,
        turbidity: reading.turbidity,
        ars: reading.ars,
        risk: reading.risk,
        lastUpdate: reading.timestamp,
    };

    return (
        <AppContext.Provider value={{
            devices,
            activeDeviceId,
            setActiveDeviceId,
            state,
            history,
            isConnected,
            espLastSeen,
            isDeviceOnline,
            token,
            user,
            login,
            logout,
            sendCommand,
            fetchDevices,
            hasNewAlert,
            setHasNewAlert,
        }}>
            {children}
        </AppContext.Provider>
    );
}

export function useAppContext() {
    return useContext(AppContext);
}
