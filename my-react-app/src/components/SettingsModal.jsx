import { useState } from 'react';
import { useAppContext } from '../context/AppContext';

export default function SettingsModal({ isOpen, onClose }) {
    const { sendCommand } = useAppContext();
    const [activeTab, setActiveTab] = useState('wifi'); // 'wifi' or 'password'

    // WiFi Form
    const [ssid, setSsid] = useState('');
    const [wifiPass, setWifiPass] = useState('');

    // Password Form
    const [oldPass, setOldPass] = useState('');
    const [newPass, setNewPass] = useState('');

    if (!isOpen) return null;

    const handleWifiSubmit = (e) => {
        e.preventDefault();
        if (confirm(`Ganti WiFi ESP32 ke: "${ssid}"?\nAlat akan restart otomatis.`)) {
            sendCommand({ command: 'update_wifi', wifi_ssid: ssid, wifi_pass: wifiPass });
            alert('Perintah ganti WiFi terkirim!');
            onClose();
        }
    };

    const handlePasswordSubmit = async (e) => {
        e.preventDefault();
        const host = window.location.hostname || 'localhost';
        try {
            const res = await fetch(`http://${host}:3000/api/password`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ oldPassword: oldPass, newPassword: newPass })
            });
            const data = await res.json();
            if (data.ok) {
                alert('Password berhasil diubah!');
                onClose();
            } else {
                alert('Gagal: ' + data.error);
            }
        } catch (e) {
            alert('Error koneksi ke server.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm">
            <div className="glass-card w-full max-w-lg rounded-2xl overflow-hidden shadow-2xl border border-white/10">

                {/* Header */}
                <div className="bg-surface-variant/30 p-4 border-b border-white/10 flex justify-between items-center">
                    <h3 className="font-headline-sm text-on-surface">Pengaturan Sistem</h3>
                    <button onClick={onClose} className="text-on-surface-variant hover:text-white">
                        <span className="material-symbols-outlined">close</span>
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-white/10">
                    <button
                        className={`flex-1 py-3 font-medium transition-colors ${activeTab === 'wifi' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:bg-white/5'}`}
                        onClick={() => setActiveTab('wifi')}
                    >
                        Koneksi WiFi ESP32
                    </button>
                    <button
                        className={`flex-1 py-3 font-medium transition-colors ${activeTab === 'password' ? 'text-primary border-b-2 border-primary bg-primary/5' : 'text-on-surface-variant hover:bg-white/5'}`}
                        onClick={() => setActiveTab('password')}
                    >
                        Password Web
                    </button>
                </div>

                {/* Content */}
                <div className="p-6">
                    {activeTab === 'wifi' ? (
                        <form onSubmit={handleWifiSubmit} className="space-y-4">
                            <p className="text-sm text-on-surface-variant mb-4">Ubah koneksi WiFi alat (ESP32) dari jarak jauh.</p>
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1">Nama WiFi (SSID)</label>
                                <input required type="text" value={ssid} onChange={e => setSsid(e.target.value)} className="w-full bg-surface-variant/50 border border-outline rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1">Password WiFi</label>
                                <input type="password" value={wifiPass} onChange={e => setWifiPass(e.target.value)} className="w-full bg-surface-variant/50 border border-outline rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-primary" />
                            </div>
                            <button type="submit" className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 mt-4">Kirim ke ESP32</button>

                            <hr className="border-white/10 my-4" />
                            <button type="button" onClick={() => {
                                if (confirm("Alat akan menghapus memori WiFi dan jadi Hotspot. Yakin?")) {
                                    sendCommand({ command: 'reset_wifi' }); alert('Perintah Reset terkirim!'); onClose();
                                }
                            }} className="w-full bg-red-500/20 text-red-400 border border-red-500/30 py-2 rounded-xl font-bold hover:bg-red-500/40">
                                RESET WIFI ESP32 (Kembali ke Mode Setup)
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handlePasswordSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1">Password Lama</label>
                                <input required type="password" value={oldPass} onChange={e => setOldPass(e.target.value)} className="w-full bg-surface-variant/50 border border-outline rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-primary" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-on-surface mb-1">Password Baru</label>
                                <input required type="password" value={newPass} onChange={e => setNewPass(e.target.value)} className="w-full bg-surface-variant/50 border border-outline rounded-xl px-4 py-2 text-on-surface focus:outline-none focus:border-primary" />
                            </div>
                            <button type="submit" className="w-full bg-primary text-on-primary py-3 rounded-xl font-bold hover:opacity-90 mt-4">Simpan Password</button>
                        </form>
                    )}
                </div>

            </div>
        </div>
    );
}
