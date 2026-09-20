import { useState, useRef, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';
import AlertHistory from './AlertHistory';

export default function TopNavBar({ onProfileClick }) {
    const { devices, activeDeviceId, setActiveDeviceId, user, hasNewAlert, setHasNewAlert } = useAppContext();
    const [showNotifications, setShowNotifications] = useState(false);
    const notifRef = useRef(null);
    // Filter hanya tampilkan perangkat yang sudah didaftarkan (ada di database)
    const deviceIds = Object.keys(devices).filter(id => devices[id].isRegistered);

    const toggleNotif = () => {
        if (!showNotifications && hasNewAlert) {
            setHasNewAlert(false);
            localStorage.setItem('last_alert_time', new Date().toISOString());
        }
        setShowNotifications(!showNotifications);
    };

    useEffect(() => {
        function handleClickOutside(event) {
            if (notifRef.current && !notifRef.current.contains(event.target)) {
                setShowNotifications(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    return (
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-margin h-16 bg-surface/60 backdrop-blur-md shadow-sm">
            <div className="flex items-center gap-base">
                <div className="w-10 h-10 bg-gradient-to-br from-aqua-primary to-aqua-secondary rounded-xl flex items-center justify-center shadow-lg">
                    <span className="material-symbols-outlined text-white text-2xl">water_drop</span>
                </div>
                <span className="font-headline-lg text-headline-lg font-black text-aqua-text tracking-tight">Aqua<span className="text-aqua-primary">Sentry</span></span>
            </div>
            <div className="flex items-center gap-md">
                <button
                    onClick={onProfileClick}
                    className="w-10 h-10 rounded-full overflow-hidden border-2 border-aqua-secondary shadow-sm hover:opacity-80 transition-opacity cursor-pointer bg-aqua-primary flex items-center justify-center"
                >
                    {user?.avatar ? (
                        <img alt={user.name} className="w-full h-full object-cover" src={user.avatar} />
                    ) : (
                        <span className="text-xs font-black text-white">{user?.name?.substring(0, 2).toUpperCase() || 'OP'}</span>
                    )}
                </button>
            </div>
        </header>
    );
}
