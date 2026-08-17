import { useState } from 'react';
import TopNavBar from './components/TopNavBar';
import SensorErrorBanner from './components/SensorErrorBanner';
import DashboardMetrics from './components/DashboardMetrics';
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

      <div className="pt-20 px-margin max-w-7xl mx-auto mb-6">
        <div className="flex justify-between items-center bg-aqua-surface p-1.5 rounded-full border border-aqua-secondary/30 shadow-sm max-w-sm mx-auto">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'dashboard' ? 'bg-aqua-primary text-white shadow-sm' : 'text-aqua-text-muted hover:bg-aqua-background'}`}
          >
            <span className="material-symbols-outlined text-[18px]">water_drop</span>
            Monitoring
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`flex-1 py-2.5 rounded-full text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2 transition-all ${activeTab === 'settings' ? 'bg-aqua-primary text-white shadow-sm' : 'text-aqua-text-muted hover:bg-aqua-background'}`}
          >
            <span className="material-symbols-outlined text-[18px]">settings</span>
            Settings
          </button>
        </div>
      </div>

      <main className="px-margin max-w-7xl mx-auto space-y-lg pb-12">
        <SensorErrorBanner />

        {activeTab === 'dashboard' && (
          <div className="animate-fade-in">
            <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4 bg-gradient-to-r from-aqua-secondary/15 to-transparent p-6 rounded-3xl border border-aqua-secondary/30">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <span className="material-symbols-outlined text-aqua-primary">sensors</span>
                  <span className="text-[10px] font-black text-aqua-primary tracking-widest uppercase">Skrining Aktif</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-black text-aqua-text tracking-tight">
                  {formatDeviceName(activeDeviceId)}
                </h1>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="relative flex items-center justify-center w-2.5 h-2.5">
                    {isDeviceOnline && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-aqua-success opacity-75"></span>}
                    <span className={`relative inline-flex rounded-full w-2 h-2 ${isDeviceOnline ? 'bg-aqua-success' : 'bg-aqua-danger'}`}></span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isDeviceOnline ? 'text-aqua-success' : 'text-aqua-danger'}`}>
                    Alat: {isDeviceOnline ? 'Online' : 'Offline'}
                  </span>
                </div>

                <div className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-gray-100 shadow-sm">
                  <div className="relative flex items-center justify-center w-2.5 h-2.5">
                    <span className={`relative inline-flex rounded-full w-2 h-2 ${isConnected ? 'bg-aqua-primary' : 'bg-aqua-danger'}`}></span>
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-widest ${isConnected ? 'text-aqua-primary' : 'text-aqua-danger'}`}>
                    Sinkronisasi: {isConnected ? 'Tersambung' : 'Terputus'}
                  </span>
                </div>
              </div>
            </div>

            <DashboardMetrics />
          </div>
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
