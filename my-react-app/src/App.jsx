import { useState } from 'react';
import TopNavBar from './components/TopNavBar';
import SensorErrorBanner from './components/SensorErrorBanner';
import DashboardMetrics from './components/DashboardMetrics';
import LocationMap from './components/LocationMap';
import Login from './components/Login';
import SettingsPage from './components/SettingsPage';
import ProfilePage from './components/ProfilePage';
import { AppProvider, useAppContext } from './context/AppContext';

function MainApp() {
  const { token, logout, activeDeviceId, isConnected, devices, isDeviceOnline } = useAppContext();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (!token) {
    return <Login />;
  }

  const formatDeviceName = (id) => {
    if (!id) return 'Tidak ada alat terhubung';
    if (devices[id]?.name) return devices[id].name;
    return `Alat: ${id}`;
  };

  return (
    <>
      <TopNavBar onLogout={logout} onProfileClick={() => setActiveTab('profile')} />

      <div className="pt-16 sm:pt-20 px-3 sm:px-6 max-w-7xl mx-auto mb-4 sm:mb-6">
        <div className="flex justify-between items-center bg-aqua-surface p-1 sm:p-1.5 rounded-2xl sm:rounded-full border border-aqua-secondary/30 shadow-xs max-w-md mx-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-[11px] sm:text-xs font-bold sm:font-black tracking-normal sm:tracking-widest uppercase flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${activeTab === 'dashboard' ? 'bg-aqua-primary text-white shadow-xs' : 'text-aqua-text-muted hover:bg-aqua-background'}`}
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">water_drop</span>
            <span>Monitoring</span>
          </button>
          <button
            onClick={() => setActiveTab('map')}
            className={`flex-1 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-[11px] sm:text-xs font-bold sm:font-black tracking-normal sm:tracking-widest uppercase flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${activeTab === 'map' ? 'bg-aqua-primary text-white shadow-xs' : 'text-aqua-text-muted hover:bg-aqua-background'}`}
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">map</span>
            <span>Peta Lokasi</span>
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2 sm:py-2.5 rounded-xl sm:rounded-full text-[11px] sm:text-xs font-bold sm:font-black tracking-normal sm:tracking-widest uppercase flex items-center justify-center gap-1 sm:gap-1.5 transition-all cursor-pointer ${activeTab === 'settings' ? 'bg-aqua-primary text-white shadow-xs' : 'text-aqua-text-muted hover:bg-aqua-background'}`}
          >
            <span className="material-symbols-outlined text-[16px] sm:text-[18px]">settings</span>
            <span>Settings</span>
          </button>
        </div>
      </div>

      <main className="px-3 sm:px-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-12">
        <SensorErrorBanner />

        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <div className="mb-4 sm:mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-4 sm:p-6 rounded-2xl sm:rounded-3xl border border-gray-100 shadow-xs">
              <div>
                <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-1.5 flex-wrap">
                  <span className="material-symbols-outlined text-aqua-primary text-base">sensors</span>
                  <span className="text-[10px] sm:text-[11px] font-bold text-gray-500 uppercase tracking-wider">Status Perangkat</span>
                  <span className="text-gray-300">•</span>
                  <span className="text-[10px] sm:text-[11px] font-semibold text-aqua-primary">{activeDeviceId}</span>
                </div>
                <h1 className="text-xl sm:text-2xl md:text-3xl font-black text-aqua-text tracking-tight">
                  {formatDeviceName(activeDeviceId)}
                </h1>
              </div>
              <div className="grid grid-cols-2 gap-2 w-full md:w-auto md:flex md:items-center md:gap-2.5">
                <div className="flex items-center justify-center md:justify-start gap-2 bg-aqua-surface/90 px-3 py-2 rounded-xl border border-aqua-secondary/20 shadow-2xs">
                  <div className="relative flex items-center justify-center w-2 h-2 shrink-0">
                    {isDeviceOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-500 opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full w-2 h-2 ${isDeviceOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                  </div>
                  <span className={`text-[11px] sm:text-xs font-bold truncate ${isDeviceOnline ? 'text-emerald-700' : 'text-rose-600'}`}>
                    {isDeviceOnline ? 'ESP32 Online' : 'ESP32 Offline'}
                  </span>
                </div>

                <div className="flex items-center justify-center md:justify-start gap-2 bg-aqua-surface/90 px-3 py-2 rounded-xl border border-aqua-secondary/20 shadow-2xs">
                  <div className="relative flex items-center justify-center w-2 h-2 shrink-0">
                    <span className={`relative inline-flex rounded-full w-2 h-2 ${isConnected ? 'bg-aqua-primary' : 'bg-rose-500'}`}></span>
                  </div>
                  <span className={`text-[11px] sm:text-xs font-bold truncate ${isConnected ? 'text-aqua-primary' : 'text-rose-600'}`}>
                    {isConnected ? 'Cloud Terhubung' : 'Cloud Terputus'}
                  </span>
                </div>
              </div>
            </div>

            <DashboardMetrics />
          </div>
        )}

        {activeTab === 'map' && (
          <LocationMap />
        )}

        {activeTab === 'settings' && (
          <SettingsPage />
        )}
        {activeTab === 'profile' && (
          <ProfilePage />
        )}

      </main>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <MainApp />
    </AppProvider>
  );
}
