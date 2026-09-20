export default function LocationFilterBar({ sites, riskFilter, setRiskFilter, countFiltered }) {
    return (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
                <h3 className="text-sm font-black text-aqua-text flex items-center gap-2">
                    <span className="material-symbols-outlined text-aqua-primary text-base">place</span>
                    Daftar Titik Lokasi Terpantau ({countFiltered})
                </h3>
                <p className="text-[11px] text-gray-400">Pilih filter status kondisi air untuk memperbarui titik lokasi di bawah dan di peta.</p>
            </div>

            {/* Dropdown Filter Condition (All, Low, Moderate/High, VeryHigh) */}
            <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-gray-500 shrink-0">Filter Status:</label>
                <select
                    value={riskFilter}
                    onChange={(e) => setRiskFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-200 text-aqua-text font-bold text-xs px-3 py-2 rounded-xl focus:outline-none focus:border-aqua-primary cursor-pointer"
                >
                    <option value="all">Semua Status ({sites.length})</option>
                    <option value="low">Air Aman / Low Risk ({sites.filter(s => s.riskLevel === 'low').length})</option>
                    <option value="moderate">Perlu Waspada / Medium ({sites.filter(s => s.riskLevel === 'moderate' || s.riskLevel === 'high').length})</option>
                    <option value="veryhigh">Risiko Bahaya / High ({sites.filter(s => s.riskLevel === 'veryhigh').length})</option>
                </select>
            </div>
        </div>
    );
}
