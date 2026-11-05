import { lazy, Suspense, useState } from 'react';
import TopNavBar from './components/TopNavBar';
import MainNavigation from './components/MainNavigation';
import SensorErrorBanner from './components/SensorErrorBanner';
import DashboardMetrics from './components/DashboardMetrics';
import LocationMap from './components/LocationMap';
import Login from './components/Login';
import SettingsPage from './components/SettingsPage';
import ProfilePage from './components/ProfilePage';
import { AppProvider, useAppContext } from './context/AppContext';

const PreviewPage = lazy(() => import('./features/preview/PreviewPage'));

function MainApp() {
  const { token } = useAppContext();

  if (!token) {
    return <Login />;
  }

  return <AuthenticatedApp />;
}

function AuthenticatedApp() {
  const { logout, activeDeviceId, isConnected, devices, isDeviceOnline } = useAppContext();
  // Unmount on logout so every new login starts at Preview, without changing auth.
  const [activeTab, setActiveTab] = useState('preview');

  const formatDeviceName = (id) => {
    if (!id) return 'Tidak ada alat terhubung';
    if (devices[id]?.name) return devices[id].name;
    return `Alat: ${id}`;
  };

  return (
    <>
      <TopNavBar onLogout={logout} onProfileClick={() => setActiveTab('profile')} />

      <div className="pt-16 sm:pt-20 px-3 sm:px-6 max-w-7xl mx-auto mb-4 sm:mb-6">
        <MainNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      <main className="px-3 sm:px-6 max-w-7xl mx-auto space-y-4 sm:space-y-6 pb-12">
        {activeTab !== 'preview' && <SensorErrorBanner />}

        {activeTab === 'preview' && (
          <Suspense fallback={<div className="py-16 text-center text-sm text-aqua-text-muted" role="status">Memuat Preview AquaSentry…</div>}>
            <PreviewPage onMonitoring={() => setActiveTab('dashboard')} />
          </Suspense>
        )}

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
