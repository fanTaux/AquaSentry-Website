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
        <header className="fixed top-0 w-full z-50 flex justify-between items-center px-3.5 sm:px-6 h-14 sm:h-16 bg-white/80 backdrop-blur-md border-b border-gray-100/80 shadow-xs transition-all">
            <div className="flex items-center">
                <img 
                    src="/logo-full.png" 
                    alt="AquaSentry" 
                    className="h-7 sm:h-9 w-auto object-contain cursor-pointer transition-transform hover:scale-105 drop-shadow-xs" 
                />
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
                <button
                    onClick={onProfileClick}
                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full overflow-hidden border-2 border-aqua-secondary shadow-xs hover:opacity-85 transition-opacity cursor-pointer bg-aqua-primary flex items-center justify-center shrink-0"
                    title="Profil Pengguna"
                >
                    {user?.avatar ? (
                        <img alt={user.name} className="w-full h-full object-cover" src={user.avatar} />
                    ) : (
                        <span className="text-[11px] sm:text-xs font-black text-white">{user?.name?.substring(0, 2).toUpperCase() || 'OP'}</span>
                    )}
                </button>
            </div>
        </header>
    );
}
