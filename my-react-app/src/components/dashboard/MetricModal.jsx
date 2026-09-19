export default function MetricModal({ activeParamModal, onClose, paramDetails, getParamStats }) {
    if (!activeParamModal) return null;

    const detail = paramDetails[activeParamModal];
    const stats = getParamStats(activeParamModal);

    return (
        <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-aqua-text/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-gray-100">
                {/* Header */}
                <div className="bg-gradient-to-r from-aqua-primary to-aqua-secondary p-6 text-white relative">
                    <button
                        onClick={onClose}
                        className="absolute top-5 right-5 w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-all cursor-pointer"
                    >
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0">
                            <span className="material-symbols-outlined text-2xl">{detail.icon}</span>
                        </div>
                        <div>
                            <span className="text-[10px] font-black text-white/80 uppercase tracking-widest">{detail.subtitle}</span>
                            <h2 className="text-xl font-black">{detail.title}</h2>
                        </div>
                    </div>
                </div>

                {/* Body Content */}
                <div className="p-6 overflow-y-auto space-y-6">
                    {/* Definition */}
                    <div className="bg-aqua-background p-4 rounded-2xl border border-aqua-secondary/20">
                        <div className="flex items-center gap-2 text-aqua-primary mb-1.5">
                            <span className="material-symbols-outlined text-lg">info</span>
                            <h3 className="text-xs font-black uppercase tracking-wider">Apa itu {activeParamModal.toUpperCase()}?</h3>
                        </div>
                        <p className="text-xs text-aqua-text leading-relaxed font-medium mb-2.5">{detail.description}</p>
                        <p className="text-[11px] text-aqua-text-muted leading-relaxed italic bg-white/80 p-3 rounded-xl border border-gray-100">
                            <strong className="not-italic text-aqua-text font-bold">Dampak: </strong>{detail.impact}
                        </p>
                    </div>

                    {/* Real-time Statistics */}
                    <div>
                        <h3 className="text-xs font-black text-aqua-text uppercase tracking-wider mb-3 flex items-center gap-2">
                            <span className="material-symbols-outlined text-aqua-primary text-base">analytics</span>
                            Statistik Pengukuran ({stats.count} Data)
                        </h3>
                        <div className="grid grid-cols-3 gap-3">
                            <div className="bg-white border border-gray-100 p-3.5 rounded-2xl text-center shadow-xs">
                                <p className="text-[9px] font-bold text-aqua-text-muted uppercase">Terkini</p>
                                <p className="text-base font-black text-aqua-primary mt-0.5">{detail.currentValue} <span className="text-[10px] text-aqua-text-muted">{detail.unit}</span></p>
                            </div>
                            <div className="bg-white border border-gray-100 p-3.5 rounded-2xl text-center shadow-xs">
                                <p className="text-[9px] font-bold text-aqua-text-muted uppercase">Rata-Rata</p>
                                <p className="text-base font-black text-aqua-text mt-0.5">{activeParamModal === 'tds' ? stats.avg.toFixed(0) : stats.avg.toFixed(1)} <span className="text-[10px] text-aqua-text-muted">{detail.unit}</span></p>
                            </div>
                            <div className="bg-white border border-gray-100 p-3.5 rounded-2xl text-center shadow-xs">
                                <p className="text-[9px] font-bold text-aqua-text-muted uppercase">Min / Maks</p>
                                <p className="text-xs font-black text-aqua-text mt-1">
                                    {activeParamModal === 'tds' ? `${stats.min.toFixed(0)} - ${stats.max.toFixed(0)}` : `${stats.min.toFixed(1)} - ${stats.max.toFixed(1)}`}
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Ambang Batas & Standard */}
                    <div>
                        <h3 className="text-xs font-black text-aqua-text uppercase tracking-wider mb-1 flex items-center gap-2">
                            <span className="material-symbols-outlined text-aqua-primary text-base">verified</span>
                            Ambang Batas & Kategori Kualitas
                        </h3>
                        <p className="text-[10px] text-aqua-text-muted mb-3 font-semibold">{detail.standards}</p>

                        <div className="space-y-2">
                            {detail.thresholds.map((t) => (
                                <div key={t.range} className="flex items-center justify-between p-3 rounded-xl border border-gray-100 bg-white text-xs shadow-2xs">
                                    <div className="flex items-center gap-2.5">
                                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: t.color }}></span>
                                        <div>
                                            <p className="font-black text-aqua-text">{t.range}</p>
                                            <p className="text-[10px] text-aqua-text-muted">{t.desc}</p>
                                        </div>
                                    </div>
                                    <span
                                        className="text-[9px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full shrink-0"
                                        style={{ backgroundColor: `${t.color}1A`, color: t.color }}
                                    >
                                        {t.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-gray-50 border-t border-gray-100 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 bg-aqua-primary text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-aqua-primary-hover transition-all cursor-pointer shadow-sm"
                    >
                        Tutup
                    </button>
                </div>
            </div>
        </div>
    );
}
