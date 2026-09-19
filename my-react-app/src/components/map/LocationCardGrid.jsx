import { useState } from 'react';
import { getBadgeStyle } from './MapCanvas';

export default function LocationCardGrid({ sites, filteredSites, selectedSite, onSelectSite }) {
    // Accordion expand/collapse state for each risk category group
    const [openGroups, setOpenGroups] = useState({
        low: true,
        moderate: true,
        veryhigh: true
    });

    const toggleGroup = (key) => {
        setOpenGroups(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (filteredSites.length === 0) {
        return (
            <div className="text-center py-10 px-4 bg-gray-50/80 rounded-2xl border border-dashed border-gray-200 text-xs text-gray-500 font-medium space-y-2">
                <span className="material-symbols-outlined text-3xl text-gray-300">map</span>
                <p className="font-bold text-gray-700">
                    {sites.length === 0 ? 'Belum Ada Titik Lokasi Tersimpan' : 'Tidak Ada Lokasi Sesuai Filter'}
                </p>
                <p className="text-[11px] text-gray-400">
                    {sites.length === 0 ? 'Klik "+ Tandai Lokasi Baru" untuk menambahkan titik lokasi pemantauan air GenZ.' : 'Coba ubah opsi Filter Status di atas.'}
                </p>
            </div>
        );
    }

    // Group sites by risk category
    const groups = [
        {
            key: 'low',
            title: 'Kumpulan Air Aman (Low Risk)',
            badgeBg: 'bg-emerald-500',
            borderBg: 'border-emerald-200 bg-emerald-50/40',
            textColor: 'text-emerald-700',
            sites: filteredSites.filter(s => s.riskLevel === 'low')
        },
        {
            key: 'moderate',
            title: 'Kumpulan Perlu Waspada (Medium Risk)',
            badgeBg: 'bg-amber-500',
            borderBg: 'border-amber-200 bg-amber-50/40',
            textColor: 'text-amber-700',
            sites: filteredSites.filter(s => s.riskLevel === 'moderate' || s.riskLevel === 'high')
        },
        {
            key: 'veryhigh',
            title: 'Kumpulan Risiko Bahaya (High Risk)',
            badgeBg: 'bg-rose-500',
            borderBg: 'border-rose-200 bg-rose-50/40',
            textColor: 'text-rose-700',
            sites: filteredSites.filter(s => s.riskLevel === 'veryhigh')
        }
    ];

    return (
        <div className="space-y-4">
            {groups.map(group => {
                if (group.sites.length === 0) return null;
                const isOpen = openGroups[group.key];

                return (
                    <div key={group.key} className="border border-gray-100 rounded-2xl overflow-hidden shadow-2xs">
                        {/* Group Accordion Header */}
                        <div
                            onClick={() => toggleGroup(group.key)}
                            className={`px-4 py-3 cursor-pointer flex items-center justify-between transition-all ${group.borderBg}`}
                        >
                            <div className="flex items-center gap-2">
                                <span className={`w-2.5 h-2.5 rounded-full ${group.badgeBg} animate-pulse`}></span>
                                <h4 className={`text-xs font-black tracking-tight ${group.textColor}`}>
                                    {group.title}
                                </h4>
                                <span className="bg-white/90 text-gray-600 px-2 py-0.5 rounded-full text-[10px] font-black border border-gray-200 shadow-2xs">
                                    {group.sites.length} Titik Lokasi
                                </span>
                            </div>

                            <div className="flex items-center gap-1 text-gray-400 text-xs font-bold">
                                <span>{isOpen ? 'Tutup' : 'Buka Dropdown'}</span>
                                <span className="material-symbols-outlined text-lg">
                                    {isOpen ? 'expand_less' : 'expand_more'}
                                </span>
                            </div>
                        </div>

                        {/* Group Cards Grid Dropdown Content */}
                        {isOpen && (
                            <div className="p-3 bg-white grid grid-cols-1 sm:grid-cols-2 gap-3 animate-fade-in border-t border-gray-100">
                                {group.sites.map(s => {
                                    const badge = getBadgeStyle(s.riskLevel);
                                    const isSelected = selectedSite?.id === s.id;

                                    return (
                                        <div
                                            key={s.id}
                                            onClick={() => onSelectSite(s)}
                                            className={`p-3.5 rounded-2xl border transition-all cursor-pointer space-y-2 text-left ${isSelected ? 'bg-gradient-to-r from-blue-50/90 via-indigo-50/40 to-white border-aqua-primary ring-2 ring-aqua-primary/20 shadow-md scale-[1.01]' : 'bg-gray-50/80 border-gray-100 hover:bg-gray-100/90 hover:border-gray-200'}`}
                                        >
                                            {/* Card Header: Status Badge & Keterangan */}
                                            <div className="flex items-center justify-between gap-1">
                                                <span className={`text-[10px] font-black px-2.5 py-0.5 rounded-full ${badge.bg} text-white flex items-center gap-1 shadow-xs`}>
                                                    <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse"></span>
                                                    {s.category}
                                                </span>
                                                <span className="text-[10px] font-bold text-aqua-primary bg-white px-2 py-0.5 rounded-md border border-gray-100 truncate max-w-[120px]">
                                                    {s.keterangan}
                                                </span>
                                            </div>

                                            {/* Location Name */}
                                            <h4 className="text-xs font-black text-aqua-text truncate tracking-tight">{s.name}</h4>

                                            {/* Live Metrics Grid */}
                                            <div className="grid grid-cols-3 gap-1 bg-white/90 p-2 rounded-xl border border-gray-100 text-center">
                                                <div>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase block">TDS</span>
                                                    <span className="text-xs font-black text-gray-800 block">{s.tds}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-bold text-gray-400 uppercase block">TURB</span>
                                                    <span className="text-xs font-black text-gray-800 block">{s.turbidity}</span>
                                                </div>
                                                <div>
                                                    <span className="text-[9px] font-bold text-aqua-primary uppercase block">ASS</span>
                                                    <span className="text-xs font-black text-aqua-primary block">{s.assScore}</span>
                                                </div>
                                            </div>

                                            {/* Method & Timestamp */}
                                            <div className="flex items-center justify-between text-[10px] text-gray-400 font-medium pt-0.5">
                                                <span className="truncate max-w-[140px]">{s.method}</span>
                                                <span className="shrink-0">{s.timestamp}</span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
}
