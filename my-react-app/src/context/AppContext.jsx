import { createContext, useContext, useEffect, useState } from 'react';
import { useTelemetry } from '../hooks/useTelemetry';
import { sendEspCommand } from '../services/api';

const AppContext = createContext();

const BACKEND_API_URL = 'http://localhost:8000';
const DEMO_DEVICE_ID = 'ESP32_AquaSentry';
const DEMO_DEVICE_NAME = 'AquaSentry Device';

export function AppProvider({ children }) {
    const [token, setToken] = useState(sessionStorage.getItem('aquasentry_token') || null);
    const [user, setUser] = useState(JSON.parse(sessionStorage.getItem('aquasentry_user') || 'null'));

    const [activeDeviceId, setActiveDeviceId] = useState(DEMO_DEVICE_ID);
    const [hasNewAlert, setHasNewAlert] = useState(false);
    const [now, setNow] = useState(Date.now());

    // Use custom telemetry hook
    const {
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
    } = useTelemetry(setHasNewAlert);

    useEffect(() => {
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, []);

    const devices = {
        [DEMO_DEVICE_ID]: {
            id: DEMO_DEVICE_ID,
            name: DEMO_DEVICE_NAME,
            isRegistered: true,
        },
    };

    const isDeviceOnline = isEspOnline;

    const login = async (username, _password) => {
        if (!username) return { ok: false, error: 'Masukkan nama pengguna' };

        try {
            const res = await fetch(`${BACKEND_API_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });
            if (res.ok) {
                const json = await res.json();
                if (json.ok) {
                    setToken(json.token);
                    setUser(json.user);
                    sessionStorage.setItem('aquasentry_token', json.token);
                    sessionStorage.setItem('aquasentry_user', JSON.stringify(json.user));
                    return { ok: true };
                }
            }
        } catch (e) {
            // Demo fallback login
        }

        const demoUser = { name: username, role: 'operator' };
        const demoToken = 'aquasentry-demo-token';
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

    const sendCommand = async (commandData) => {
        try {
            return await sendEspCommand(commandData);
        } catch (err) {
            console.error('Error sending command to ESP32:', err);
            return { ok: false, error: err.message };
        }
    };

    const fetchDevices = async () => { };

    const state = {
        tds: reading.tds,
        turbidity: reading.turbidity,
        ars: reading.ars,
        risk: reading.risk,
        lastUpdate: reading.timestamp,
    };

    const espLastSeen = isEspOnline ? 'Baru saja' : 'Offline';

    return (
        <AppContext.Provider value={{
            devices,
            activeDeviceId,
            setActiveDeviceId,
            state,
            reading,
            history,
            clearHistory,
            isConnected,
            espLastSeen,
            isDeviceOnline,
            deviceStatus,
            isTesting,
            testElapsedSec,
            preset,
            aiPrediction,
            finalVerdict,
            voteCounts,
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
