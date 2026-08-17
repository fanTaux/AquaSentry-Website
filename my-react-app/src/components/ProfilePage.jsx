import { useAppContext } from '../context/AppContext';

export default function ProfilePage() {
    const { user } = useAppContext();

    return (
        <div className="max-w-3xl mx-auto pb-12 space-y-6 animate-fade-in">
            {/* Header */}
            <div className="mb-8">
                <h2 className="text-2xl font-bold text-aqua-text mb-1">Profil Saya</h2>
                <p className="text-sm text-gray-500">Kelola informasi personal dan preferensi akun Anda.</p>
            </div>

            {/* Profile Identity Card */}
            <section className="bg-white rounded-3xl p-8 border border-gray-100 shadow-sm flex flex-col md:flex-row items-center gap-8 relative overflow-hidden">
                {/* Background decorative element */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-aqua-secondary/10 to-transparent rounded-bl-full pointer-events-none opacity-50"></div>

                <div className="relative z-10">
                    <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-aqua-secondary/20 shadow-lg relative bg-aqua-primary flex items-center justify-center">
                        {user?.avatar ? (
                            <img
                                alt="Profile"
                                className="w-full h-full object-cover"
                                src={user.avatar}
                            />
                        ) : (
                            <span className="text-4xl font-black text-white">{user?.name?.substring(0, 2).toUpperCase()}</span>
                        )}
                        <button className="absolute bottom-0 left-0 right-0 bg-black/40 text-white text-[10px] font-bold py-1 backdrop-blur-sm hover:bg-black/60 transition-colors">
                            Ubah Foto
                        </button>
                    </div>
                </div>

                <div className="relative z-10 flex-1 text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-1">
                        <h3 className="text-3xl font-black text-aqua-text">{user?.name || 'Pengguna AquaSentry'}</h3>
                        <span className="material-symbols-outlined text-aqua-primary text-xl" title="Akun Terverifikasi">verified</span>
                    </div>
                    <p className="text-sm font-semibold text-aqua-primary mb-4">@{user?.username || 'username'}</p>

                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-4">
                        <div className="inline-flex items-center gap-1.5 bg-aqua-secondary/15 text-aqua-text px-3 py-1.5 rounded-full text-xs font-bold border border-aqua-secondary/40">
                            <span className="material-symbols-outlined text-sm">
                                {user?.role === 'ADMIN' ? 'admin_panel_settings' : 'person'}
                            </span>
                            {user?.role === 'ADMIN' ? 'Administrator' : 'Anggota Tim'}
                        </div>
                        <div className="inline-flex items-center gap-1.5 bg-gray-50 text-gray-600 px-3 py-1.5 rounded-full text-xs font-bold border border-gray-200">
                            <span className="material-symbols-outlined text-sm">calendar_today</span>
                            Bergabung sejak 2026
                        </div>
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-6">
                {/* App Preferences */}
                <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm flex flex-col h-full">
                    <div className="flex items-center gap-2 mb-6">
                        <div className="w-8 h-8 rounded-full bg-aqua-secondary/15 flex items-center justify-center text-aqua-primary">
                            <span className="material-symbols-outlined text-sm">palette</span>
                        </div>
                        <h3 className="font-bold text-aqua-text">Preferensi Aplikasi</h3>
                    </div>

                    <div className="space-y-4 flex-1">
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div>
                                <p className="text-sm font-bold text-aqua-text">Bahasa Aplikasi</p>
                                <p className="text-[10px] text-gray-500">Pilih bahasa antarmuka</p>
                            </div>
                            <select className="bg-white border border-gray-200 text-xs font-bold text-aqua-primary py-1.5 px-3 rounded-lg focus:outline-none focus:border-aqua-primary">
                                <option value="id">Indonesia</option>
                                <option value="en">English</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div>
                                <p className="text-sm font-bold text-aqua-text">Notifikasi Push</p>
                                <p className="text-[10px] text-gray-500">Terima peringatan langsung</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" defaultChecked className="sr-only peer" />
                                <div className="w-9 h-5 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-aqua-primary"></div>
                            </label>
                        </div>

                    </div>
                </section>
            </div>

            {/* Recent Activity */}
            <section className="bg-white rounded-3xl p-6 border border-gray-100 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-aqua-secondary/15 flex items-center justify-center text-aqua-primary">
                            <span className="material-symbols-outlined text-sm">history</span>
                        </div>
                        <h3 className="font-bold text-aqua-text">Aktivitas Terakhir Anda</h3>
                    </div>
                </div>

                <div className="space-y-0 relative before:absolute before:inset-0 before:ml-[19px] before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-gray-200 before:to-transparent pl-8 md:pl-0">

                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group py-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-aqua-secondary/15 text-aqua-primary absolute left-0 md:left-1/2 -translate-x-1/2 shadow-sm z-10">
                            <span className="material-symbols-outlined text-sm">login</span>
                        </div>
                        <div className="w-full md:w-[calc(50%-2.5rem)] bg-gray-50 p-3 rounded-2xl border border-gray-100 shadow-sm ml-4 md:ml-0 md:group-odd:mr-4 md:group-even:ml-4">
                            <p className="text-xs font-bold text-aqua-text">Login Berhasil</p>
                            <p className="text-[10px] text-gray-500">Anda masuk ke sistem melalui Chrome (Windows)</p>
                            <p className="text-[9px] font-bold text-gray-400 mt-1">Hari ini, 08:30 AM</p>
                        </div>
                    </div>

                    <div className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group py-3">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-aqua-secondary/15 text-aqua-primary absolute left-0 md:left-1/2 -translate-x-1/2 shadow-sm z-10">
                            <span className="material-symbols-outlined text-sm">history</span>
                        </div>
                        <div className="w-full md:w-[calc(50%-2.5rem)] bg-gray-50 p-3 rounded-2xl border border-gray-100 shadow-sm ml-4 md:ml-0 md:group-odd:mr-4 md:group-even:ml-4">
                            <p className="text-xs font-bold text-aqua-text">Melihat Riwayat Pengukuran</p>
                            <p className="text-[10px] text-gray-500">Membuka detail riwayat pengukuran AquaSentry Unit #1</p>
                            <p className="text-[9px] font-bold text-gray-400 mt-1">Kemarin, 20:15</p>
                        </div>
                    </div>

                </div>
            </section>

        </div>
    );
}
