export default function ReadingCard({ icon, label, sublabel, value, unit, hint, onClick }) {
    return (
        <button
            onClick={onClick}
            type="button"
            className="w-full bg-white border border-gray-100 p-4 sm:p-5 rounded-2xl shadow-sm hover:shadow-md hover:border-aqua-primary/40 transition-all flex items-center justify-between gap-3 text-left group cursor-pointer"
        >
            <div className="flex items-center gap-3.5 min-w-0">
                <div className="w-12 h-12 rounded-2xl bg-aqua-secondary/15 group-hover:bg-aqua-primary group-hover:text-white flex items-center justify-center flex-shrink-0 transition-colors">
                    <span className="material-symbols-outlined text-aqua-primary group-hover:text-white text-2xl transition-colors">{icon}</span>
                </div>
                <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-black text-aqua-text uppercase tracking-wider">{label}</span>
                        <span className="text-[10px] font-bold text-aqua-primary bg-aqua-secondary/15 px-2 py-0.5 rounded-md">
                            {sublabel}
                        </span>
                    </div>
                    <p className="text-xl font-black text-aqua-text mt-0.5">
                        {value} <span className="text-sm font-bold text-aqua-text-muted">{unit}</span>
                    </p>
                    {hint && <p className="text-[10px] text-aqua-text-muted mt-0.5 font-medium">{hint}</p>}
                </div>
            </div>
            <div className="flex items-center gap-1 shrink-0 text-aqua-text-muted group-hover:text-aqua-primary transition-colors">
                <span className="text-[10px] font-black uppercase tracking-wider hidden md:inline">Detail</span>
                <span className="material-symbols-outlined text-lg">info</span>
            </div>
        </button>
    );
}
