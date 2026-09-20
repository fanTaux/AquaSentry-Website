export default function RiskAdviceCard({ copy, lastUpdateLabel, isDeviceOnline }) {
    return (
        <div className="mt-6 pt-6 border-t border-gray-100">
            <p className="text-[10px] font-black text-aqua-text-muted uppercase tracking-widest mb-2">Rekomendasi</p>
            <ul className="space-y-1.5">
                {copy.recommendations.map((r) => (
                    <li key={r} className="text-xs text-aqua-text font-medium flex items-start gap-2">
                        <span className="material-symbols-outlined text-aqua-primary text-sm mt-0.5">check_circle</span>
                        {r}
                    </li>
                ))}
            </ul>
            <p className="text-[10px] text-aqua-text-muted italic mt-4">
                AquaSentry adalah alat skrining dini berbasis parameter fisika-kimia, bukan pengganti pengujian laboratorium
                atau penentu kelayakan air minum secara mutlak.
            </p>
        </div>
    );
}
