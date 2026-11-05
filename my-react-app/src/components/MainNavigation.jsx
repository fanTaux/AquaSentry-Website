const tabs = [
  { id: 'preview', label: 'Preview', icon: <><path d="m12 3 8 4.5v9L12 21l-8-4.5v-9L12 3Z" /><path d="m4 7.5 8 4.5 8-4.5M12 12v9" /></> },
  { id: 'dashboard', label: 'Monitoring', icon: <path d="M12 2C10 7 5 10 5 15a7 7 0 0 0 14 0c0-5-5-8-7-13Zm-4 13a4 4 0 0 0 4 4" /> },
  { id: 'map', label: 'Peta Lokasi', icon: <><path d="m3 5 6-2 6 2 6-2v16l-6 2-6-2-6 2V5ZM9 3v16M15 5v16" /></> },
  { id: 'settings', label: 'Settings', icon: <><path d="m9 3-.5 2-2 1-2-.5-2 3 1.5 1.5v3L2.5 15l2 3 2-.5 2 1L9 21h6l.5-2.5 2-1 2 .5 2-3-1.5-2v-3L21.5 9l-2-3-2 .5-2-1L15 3H9Z" /><circle cx="12" cy="12" r="3" /></> },
];

export default function MainNavigation({ activeTab, onTabChange }) {
  return (
    <nav aria-label="Navigasi utama" className="grid grid-cols-4 gap-1 bg-aqua-surface p-1 sm:p-1.5 rounded-2xl sm:rounded-full border border-aqua-secondary/30 shadow-xs max-w-xl mx-auto">
      {tabs.map(({ id, label, icon }) => (
        <button
          key={id}
          type="button"
          aria-pressed={activeTab === id}
          onClick={() => onTabChange(id)}
          className={`min-w-0 min-h-11 py-2 px-1 sm:px-3 rounded-xl sm:rounded-full text-[10px] sm:text-xs font-bold sm:font-black tracking-normal sm:tracking-wide uppercase flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-1.5 transition-colors motion-reduce:transition-none cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-aqua-primary ${activeTab === id ? 'bg-aqua-primary text-white shadow-xs' : 'text-aqua-text-muted hover:bg-aqua-background'}`}
        >
          <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">{icon}</svg>
          <span className="whitespace-nowrap">{label}</span>
        </button>
      ))}
    </nav>
  );
}
