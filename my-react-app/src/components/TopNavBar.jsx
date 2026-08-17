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
                <div className="hidden md:flex items-center gap-gutter">
                    <span className="text-primary font-bold border-b-2 border-primary font-label-lg text-label-lg py-1">Alat Terpasang</span>
                </div>

                <div className="relative group">
                    <select
                        value={activeDeviceId || ''}
                        onChange={(e) => setActiveDeviceId(e.target.value)}
                        className="appearance-none bg-white border-2 border-aqua-secondary/40 pl-5 pr-12 py-2 rounded-2xl cursor-pointer hover:border-aqua-primary hover:shadow-md transition-all font-black text-[11px] uppercase tracking-wider text-aqua-text focus:outline-none focus:ring-4 focus:ring-aqua-primary/10"
                    >
                        {deviceIds.length === 0 && <option value="">Tidak ada alat</option>}
                        {deviceIds.map(id => (
                            <option key={id} value={id}>
                                {devices[id].name || (id)}
                            </option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-aqua-primary">
                        <span className="material-symbols-outlined text-xl">unfold_more</span>
                    </div>
                </div>

                <div className="flex items-center gap-sm">
                    <div className="relative" ref={notifRef}>
                        <button
                            onClick={toggleNotif}
                            className={`p-2 rounded-full transition-colors relative ${showNotifications ? 'bg-surface-container-high' : 'hover:bg-surface-container-low'}`}
                        >
                            <span className="material-symbols-outlined text-on-surface-variant">notifications</span>
                            {hasNewAlert && <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>}
                        </button>

                        {showNotifications && (
                            <div className="absolute right-0 mt-3 w-[400px] max-h-[80vh] overflow-y-auto bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 animate-fade-in origin-top-right">
                                <div className="p-1">
                                    <AlertHistory isDropdown={true} />
                                </div>
                            </div>
                        )}
                    </div>
                    <button
                        onClick={onProfileClick}
                        className="w-10 h-10 rounded-full overflow-hidden border-2 border-aqua-secondary shadow-sm hover:opacity-80 transition-opacity cursor-pointer bg-aqua-primary flex items-center justify-center"
                    >
                        {user?.avatar ? (
                            <img alt={user.name} className="w-full h-full object-cover" src={user.avatar} />
                        ) : (
                            <span className="text-xs font-black text-white">{user?.name?.substring(0, 2).toUpperCase()}</span>
                        )}
                    </button>
                </div>
            </div>
        </header>
    );
}
