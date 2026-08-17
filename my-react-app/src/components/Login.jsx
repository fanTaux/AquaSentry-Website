import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function Login() {
    const { login } = useAppContext();
    const [username, setUsername] = useState('demo');
    const [password, setPassword] = useState('demo');
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const result = await login(username, password);
        if (!result.ok) {
            setError(result.error);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #F8FCFD 0%, #E6F6FA 100%)' }}>

            <div className="absolute bottom-10 right-10 w-24 h-24 rounded-full bg-white border-4 border-white shadow-xl flex items-center justify-center opacity-90">
                <span className="material-symbols-outlined text-aqua-primary text-3xl">water_drop</span>
            </div>

            <div className="bg-white/80 backdrop-blur-md border border-white/60 shadow-2xl w-full max-w-[400px] p-8 rounded-3xl text-center relative z-10">
                <div className="w-16 h-16 bg-gradient-to-br from-aqua-primary to-aqua-secondary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
                    <span className="material-symbols-outlined text-white text-3xl">water_drop</span>
                </div>

                <h2 className="text-2xl font-black text-aqua-text mb-1 tracking-tight">Aqua<span className="text-aqua-primary">Sentry</span></h2>
                <p className="text-xs text-gray-500 mb-2">Alat skrining dini kualitas air berbasis IoT dan AI.</p>
                <p className="text-[10px] text-aqua-primary font-bold mb-6 bg-aqua-secondary/15 inline-block px-3 py-1 rounded-full">Mode Demo &mdash; data sensor disimulasikan</p>

                <form onSubmit={handleSubmit} className="space-y-4 text-left animate-fade-in">

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Nama pengguna</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400 text-lg">person</span>
                            </div>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Masukkan nama pengguna"
                                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary focus:ring-1 focus:ring-aqua-primary transition-all"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1 ml-1">Password</label>
                        <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <span className="material-symbols-outlined text-gray-400 text-lg">lock</span>
                            </div>
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Masukkan password"
                                className="w-full bg-white border border-gray-200 rounded-xl pl-10 pr-10 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary focus:ring-1 focus:ring-aqua-primary transition-all"
                            />
                            <div
                                className="absolute inset-y-0 right-0 pr-3 flex items-center cursor-pointer"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <span className="material-symbols-outlined text-gray-400 text-lg hover:text-aqua-primary transition-colors">
                                    {showPassword ? "visibility" : "visibility_off"}
                                </span>
                            </div>
                        </div>
                    </div>

                    {error && <p className="text-red-500 text-xs text-center font-medium mt-2">{error}</p>}

                    <div className="pt-2">
                        <button type="submit" className="w-full bg-aqua-primary text-white py-3 rounded-xl text-sm font-semibold hover:bg-aqua-primary-hover transition-colors flex justify-center items-center gap-2 shadow-md">
                            Masuk Ke Sistem
                            <span className="material-symbols-outlined text-sm">login</span>
                        </button>
                    </div>

                </form>

                <div className="mt-8 text-center pt-4 border-t border-gray-100/50">
                    <div className="inline-flex items-center gap-1 bg-aqua-secondary/15 text-aqua-primary px-3 py-1 rounded-full text-[10px] font-medium mb-2 border border-aqua-secondary/30">
                        <span className="w-1.5 h-1.5 bg-aqua-primary rounded-full"></span>
                        Mode Demo &mdash; belum terhubung backend
                    </div>
                    <p className="text-[9px] text-gray-400">&copy; 2026 AquaSentry. [Nama Tim].</p>
                </div>

            </div>
        </div>
    );
}
