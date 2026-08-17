import { useState, useEffect } from 'react';
import { useAppContext } from '../context/AppContext';

export default function SettingsPage() {
    const { logout, token, user, fetchDevices, state, sendCommand, devices } = useAppContext();
    const host = window.location.hostname || 'localhost';
    const API_URL = `http://${host}:3000`;

    // Data states
    const [usersList, setUsersList] = useState([]);
    const [devicesList, setDevicesList] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isScanning, setIsScanning] = useState(false);
    const [scanFallbackTimer, setScanFallbackTimer] = useState(null);

    // Modal states
    const [isAddUserOpen, setIsAddUserOpen] = useState(false);
    const [isAddDeviceOpen, setIsAddDeviceOpen] = useState(false);
    const [isChangeWifiOpen, setIsChangeWifiOpen] = useState(false);

    // Form states (Add User)
    const [newUserName, setNewUserName] = useState('');
    const [newUserUsername, setNewUserUsername] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserRole, setNewUserRole] = useState('ANGGOTA');

    // Form states (Add Device)
    const [newDeviceId, setNewDeviceId] = useState('');
    const [newDeviceName, setNewDeviceName] = useState('');

    // Form states (WiFi)
    const [newWifiSSID, setNewWifiSSID] = useState('');
    const [newWifiPass, setNewWifiPass] = useState('');

    // State for Dropdown and Action Modals
    const [openDropdownId, setOpenDropdownId] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [actionTarget, setActionTarget] = useState(null);

    const isAdmin = user?.role === 'ADMIN';

    const getSignalInfo = (rssi) => {
        if (!rssi || rssi === 0) return { text: 'N/A', icon: 'wifi_off', color: 'text-gray-400' };
        if (rssi > -50) return { text: 'Sangat Kuat', icon: 'wifi', color: 'text-[#667b68]' };
        if (rssi > -65) return { text: 'Kuat', icon: 'wifi', color: 'text-[#667b68]' };
        if (rssi > -75) return { text: 'Cukup', icon: 'wifi', color: 'text-orange-400' };
        return { text: 'Lemah', icon: 'wifi', color: 'text-red-400' };
    };
    const signal = getSignalInfo(state?.rssi);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${token}` };

            const resUsers = await fetch(`${API_URL}/api/users`, { headers });
            const dataUsers = await resUsers.json();
            if (dataUsers.ok) setUsersList(dataUsers.users);

            const resDevices = await fetch(`${API_URL}/api/devices`, { headers });
            const dataDevices = await resDevices.json();
            if (dataDevices.ok) setDevicesList(dataDevices.devices);
        } catch (err) {
            console.error('Fetch error:', err);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    // Reset isScanning when wifi_list changes (with at least 1 network)
    useEffect(() => {
        if (state?.wifi_list?.length > 0 && isScanning) {
            setIsScanning(false);
            setScanFallbackTimer(prev => { clearTimeout(prev); return null; });
        }
    }, [state?.wifi_list]);

    const handleAddUser = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    name: newUserName,
                    username: newUserUsername,
                    password: newUserPassword,
                    role: newUserRole
                })
            });
            const data = await res.json();
            if (data.ok) {
                setIsAddUserOpen(false);
                fetchData();
                setNewUserName(''); setNewUserUsername(''); setNewUserPassword('');
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert('Gagal menambah user');
        }
    };

    const handleDeleteUser = async (id) => {
        try {
            const res = await fetch(`${API_URL}/api/users/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) {
                setIsDeleteModalOpen(false);
                fetchData();
            }
        } catch (err) {
            alert('Gagal menghapus user');
        }
    };

    const handleAddDevice = async (e) => {
        e.preventDefault();
        try {
            const res = await fetch(`${API_URL}/api/devices`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ deviceId: newDeviceId, name: newDeviceName })
            });
            const data = await res.json();
            if (data.ok) {
                setIsAddDeviceOpen(false);
                fetchData();
                fetchDevices(); // Sync global room selector
                setNewDeviceId(''); setNewDeviceName('');
            } else {
                alert(data.error);
            }
        } catch (err) {
            alert('Gagal menambah perangkat');
        }
    };

    const handleDeleteDevice = async (id) => {
        try {
            const res = await fetch(`${API_URL}/api/devices/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (data.ok) {
                setIsDeleteModalOpen(false);
                fetchData();
                fetchDevices(); // Sync global room selector
            }
        } catch (err) {
            alert('Gagal menghapus perangkat');
        }
    };

    const handleUpdateWifi = async (e) => {
        e.preventDefault();
        if (!newWifiSSID) return;
        sendCommand({ command: 'change_wifi', ssid: newWifiSSID, password: newWifiPass });
        setIsChangeWifiOpen(false);
        setNewWifiSSID(''); setNewWifiPass('');
        alert('Perintah ganti WiFi terkirim! ESP32 sedang mencoba terhubung ke jaringan baru.');
    };

    const handleResetWifi = () => {
        if (confirm('Apakah Anda yakin ingin melupakan jaringan? ESP32 akan reset dan kembali ke mode Hotspot.')) {
            sendCommand({ command: 'reset_wifi' });
            alert('Perintah reset WiFi terkirim! ESP32 akan restart ke mode portal.');
        }
    };

    const handleScanWifi = () => {
        if (isScanning) return;
        setIsScanning(true);
        sendCommand({ command: 'scan_wifi' });
        // Fallback: hentikan loading setelah 20 detik jika tidak ada respon
        const fallbackTimer = setTimeout(() => setIsScanning(false), 20000);
        // Simpan timer agar bisa dibersihkan jika wifi_list sudah datang
        setScanFallbackTimer(prev => { clearTimeout(prev); return fallbackTimer; });
    };

    const handleOpenWifiModal = () => {
        setIsChangeWifiOpen(true);
        handleScanWifi(); // Langsung scan WiFi saat buka modal
    };

    const handleAction = (action, item) => {
        setActionTarget(item);
        setOpenDropdownId(null);
        if (action === 'edit') setIsEditModalOpen(true);
        if (action === 'delete') setIsDeleteModalOpen(true);
    };

    return (
        <div className="max-w-3xl mx-auto pb-12 space-y-8 animate-fade-in relative" onClick={() => setOpenDropdownId(null)}>

            {/* Header Pengaturan */}
            <div className="mb-8 flex justify-between items-end">
                <div>
                    <h2 className="text-2xl font-bold text-aqua-text mb-1">Pengaturan</h2>
                    <p className="text-sm text-gray-500">Kelola akun Anda dan konfigurasi perangkat FungiGuard.</p>
                </div>
                <div className="text-right">
                    <span className="text-[10px] font-bold text-gray-400 block mb-1 uppercase tracking-tighter">Login Sebagai</span>
                    <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${isAdmin ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600'}`}>
                            {user?.role}
                        </span>
                        <span className="text-sm font-bold text-aqua-text">{user?.name?.replace('SleepWell', 'FungiGuard')}</span>
                    </div>
                </div>
            </div>

            {/* PENGELOLAAN PENGGUNA */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-aqua-primary tracking-wider uppercase">PENGELOLAAN PENGGUNA</h3>
                    {isAdmin && (
                        <button
                            onClick={() => setIsAddUserOpen(true)}
                            className="bg-aqua-primary text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 hover:bg-aqua-primary-hover transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                            Tambah Anggota
                        </button>
                    )}
                </div>

                <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-visible flex flex-col gap-[1px] bg-gray-100/50">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-400 text-sm italic bg-white rounded-3xl">Memuat daftar anggota...</div>
                    ) : usersList.map((u) => (
                        <div key={u.id} className="bg-white p-4 flex items-center justify-between hover:bg-gray-50 transition-colors relative first:rounded-t-3xl last:rounded-b-3xl">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-bold shadow-sm ${u.color || 'bg-aqua-secondary/15 text-aqua-primary'}`}>
                                    {u.initials}
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-aqua-text text-sm">{u.name?.replace('SleepWell', 'FungiGuard')}</span>
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold ${u.role === 'ADMIN' ? 'bg-orange-50 text-orange-600 border border-aqua-secondary/30' : 'bg-gray-50 text-gray-500'}`}>{u.role}</span>
                                    </div>
                                    <p className="text-xs text-gray-500">@{u.username}</p>
                                </div>
                            </div>
                            {isAdmin && (
                                <div className="relative">
                                    <button
                                        onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `u-${u.id}` ? null : `u-${u.id}`); }}
                                        className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                    >
                                        <span className="material-symbols-outlined">more_vert</span>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {openDropdownId === `u-${u.id}` && (
                                        <div className="absolute right-0 top-10 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-fade-in">
                                            <button onClick={() => handleAction('edit', u)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-aqua-secondary/15 flex items-center gap-2 font-medium">
                                                <span className="material-symbols-outlined text-[16px] text-aqua-primary">edit</span> Edit
                                            </button>
                                            {u.username !== 'admin' && (
                                                <button onClick={() => handleAction('delete', u)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
                                                    <span className="material-symbols-outlined text-[16px]">delete</span> Hapus
                                                </button>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* MANAJEMEN PERANGKAT */}
            <div>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xs font-bold text-aqua-primary tracking-wider uppercase">MANAJEMEN PERANGKAT</h3>
                    {isAdmin && (
                        <button
                            onClick={() => setIsAddDeviceOpen(true)}
                            className="bg-aqua-primary text-white px-3 py-1.5 rounded-full text-xs font-semibold flex items-center gap-1 hover:bg-aqua-primary-hover transition-colors shadow-sm"
                        >
                            <span className="material-symbols-outlined text-[14px]">add</span>
                            Tambah Perangkat
                        </button>
                    )}
                </div>

                <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-visible flex flex-col gap-[1px] bg-gray-100/50">
                    {isLoading ? (
                        <div className="p-8 text-center text-gray-400 text-sm italic bg-white rounded-3xl">Memuat daftar perangkat...</div>
                    ) : devicesList.length === 0 ? (
                        <div className="p-8 text-center text-gray-400 text-sm italic bg-white rounded-3xl">Belum ada perangkat terdaftar</div>
                    ) : devicesList.map((device) => {
                        const isOnline = devices[device.deviceId]?.lastSeen && (Date.now() - devices[device.deviceId].lastSeen < 10000);
                        return (
                            <div key={device.id} className="bg-white p-4 flex items-center justify-between hover:bg-gray-50 transition-colors relative first:rounded-t-3xl last:rounded-b-3xl">
                                <div className="flex items-center gap-4">
                                    <div className={`w-12 h-12 rounded-full flex items-center justify-center ${device.color || 'bg-[#e6ceb3]/30 text-aqua-primary'}`}>
                                        <span className="material-symbols-outlined">{device.icon || 'router'}</span>
                                    </div>
                                    <div>
                                        <span className="font-bold text-aqua-text text-sm block">{device.name}</span>
                                        <div className="flex items-center gap-1 mt-0.5">
                                            <span className="text-[10px] text-gray-400 font-bold uppercase">{device.deviceId}</span>
                                            <span className="mx-1 text-gray-300">•</span>
                                            <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-[#52b788] shadow-[0_0_5px_rgba(34,197,94,0.5)]' : 'bg-gray-300'}`}></span>
                                            <p className={`text-[10px] font-medium ${isOnline ? 'text-[#52b788]' : 'text-gray-500'}`}>
                                                {isOnline ? 'Online' : 'Offline'}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                {isAdmin && (
                                    <div className="relative">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); setOpenDropdownId(openDropdownId === `d-${device.id}` ? null : `d-${device.id}`); }}
                                            className="text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-100 transition-colors"
                                        >
                                            <span className="material-symbols-outlined">more_vert</span>
                                        </button>

                                        {/* Dropdown Menu */}
                                        {openDropdownId === `d-${device.id}` && (
                                            <div className="absolute right-0 top-10 w-36 bg-white border border-gray-100 rounded-xl shadow-lg z-20 py-1 overflow-hidden animate-fade-in">
                                                <button onClick={() => handleAction('edit', device)} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-aqua-secondary/15 flex items-center gap-2 font-medium">
                                                    <span className="material-symbols-outlined text-[16px] text-aqua-primary">settings</span> Config
                                                </button>
                                                <button onClick={() => handleAction('delete', device)} className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2 font-medium">
                                                    <span className="material-symbols-outlined text-[16px]">link_off</span> Putus
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* JARINGAN WIFI */}
            <div className="bg-white border border-gray-100 rounded-3xl shadow-sm p-6 relative overflow-hidden">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-full bg-aqua-secondary/15 flex items-center justify-center text-aqua-primary">
                            <span className="material-symbols-outlined">wifi</span>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500">Jaringan Terhubung</p>
                            <h4 className="font-bold text-aqua-text text-sm">{state?.wifi_ssid || 'Disconnected'}</h4>
                        </div>
                    </div>
                    <div className="text-right flex flex-col items-end">
                        <span className={`material-symbols-outlined ${signal.color} text-lg`}>{signal.icon}</span>
                        <p className="text-[10px] text-gray-400 mt-1">{signal.text}</p>
                    </div>
                </div>

                <div className="flex gap-3">
                    <button
                        onClick={handleOpenWifiModal}
                        className="flex-1 bg-aqua-primary text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-[#4a5743] transition-colors flex items-center justify-center gap-2 shadow-sm"
                    >
                        <span className="material-symbols-outlined text-sm">sync</span> Ganti Jaringan
                    </button>
                    <button
                        onClick={handleResetWifi}
                        className="flex-1 bg-white text-red-500 border border-red-200 py-2.5 rounded-xl text-sm font-semibold hover:bg-red-50 transition-colors flex items-center justify-center gap-2"
                    >
                        <span className="material-symbols-outlined text-sm">wifi_off</span> Lupakan Jaringan
                    </button>
                </div>
            </div>

            {/* LAINNYA */}
            <div>
                <h3 className="text-xs font-bold text-aqua-primary tracking-wider uppercase mb-4">LAINNYA</h3>
                <div className="bg-white border border-gray-100 rounded-3xl shadow-sm overflow-hidden flex flex-col gap-[1px] bg-gray-100/50">

                    <button onClick={logout} className="w-full bg-white p-4 flex items-center justify-between hover:bg-red-50 transition-colors text-left group">
                        <div className="flex items-center gap-3 text-red-500 font-medium text-sm">
                            <span className="material-symbols-outlined text-red-400 group-hover:text-red-500">logout</span>
                            Keluar dari Akun
                        </div>
                        <span className="material-symbols-outlined text-gray-300 text-sm group-hover:text-red-300">arrow_forward_ios</span>
                    </button>

                </div>
            </div>

            {/* MODAL: TAMBAH ANGGOTA */}
            {isAddUserOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-[#e6eed8]/40 backdrop-blur-sm" onClick={() => setIsAddUserOpen(false)}></div>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[400px] p-8 text-center relative z-10 animate-fade-in">
                        <div className="w-16 h-16 bg-aqua-secondary/15 text-aqua-primary rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">person_add</span>
                        </div>
                        <h2 className="text-xl font-bold text-aqua-text mb-1">Tambah Anggota</h2>
                        <p className="text-xs text-gray-500 mb-6">Buat akun baru dengan memasukkan detail anggota.</p>

                        <form onSubmit={handleAddUser} className="space-y-4 text-left">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Nama Lengkap</label>
                                <input type="text" value={newUserName} onChange={e => setNewUserName(e.target.value)} required placeholder="misal: Ani Septiani" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Username</label>
                                <input type="text" value={newUserUsername} onChange={e => setNewUserUsername(e.target.value)} required placeholder="misal: ani123" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Password</label>
                                <input type="password" value={newUserPassword} onChange={e => setNewUserPassword(e.target.value)} required placeholder="Minimal 6 karakter" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary" />
                            </div>

                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Peran Pengguna</label>
                                <div className="flex gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setNewUserRole('ADMIN')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${newUserRole === 'ADMIN' ? 'bg-aqua-secondary/15 border-[#d8a878] text-aqua-primary' : 'bg-white border-gray-200 text-gray-500'}`}
                                    >
                                        Admin
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setNewUserRole('ANGGOTA')}
                                        className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm font-semibold transition-all ${newUserRole === 'ANGGOTA' ? 'bg-aqua-secondary/15 border-[#d8a878] text-aqua-primary' : 'bg-white border-gray-200 text-gray-500'}`}
                                    >
                                        Anggota
                                    </button>
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsAddUserOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-full text-sm font-bold hover:bg-gray-50">Batal</button>
                                <button type="submit" className="flex-1 bg-aqua-primary text-white py-2.5 rounded-full text-sm font-bold hover:bg-aqua-primary-hover">Tambah</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: TAMBAH PERANGKAT */}
            {isAddDeviceOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsAddDeviceOpen(false)}></div>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[480px] p-8 relative z-10 animate-fade-in">
                        <h2 className="text-xl font-bold text-aqua-text mb-1">Tambah Perangkat Baru</h2>
                        <p className="text-xs text-gray-500 mb-6 leading-relaxed">Masukkan detail perangkat FungiGuard Anda untuk mulai menghubungkannya.</p>

                        <form onSubmit={handleAddDevice} className="space-y-4">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 mb-1 ml-1">Nama Perangkat</label>
                                <input type="text" value={newDeviceName} onChange={e => setNewDeviceName(e.target.value)} required placeholder="misal: Lampu Kamar Utama" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-700 mb-1 ml-1">ID Perangkat (Harus Sama dengan Kode ESP32)</label>
                                <input type="text" value={newDeviceId} onChange={e => setNewDeviceId(e.target.value)} required placeholder="misal: esp32_nursery_01" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary" />
                            </div>

                            <div className="flex gap-3 justify-end pt-4">
                                <button type="button" onClick={() => setIsAddDeviceOpen(false)} className="bg-white border border-gray-200 text-gray-600 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-gray-50">Batal</button>
                                <button type="submit" className="bg-aqua-primary text-white px-6 py-2.5 rounded-full text-sm font-bold hover:bg-aqua-primary-hover">Hubungkan</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: HAPUS KONFIRMASI */}
            {isDeleteModalOpen && actionTarget && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsDeleteModalOpen(false)}></div>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[400px] p-8 text-center relative z-10 animate-fade-in">
                        <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className="material-symbols-outlined text-3xl">warning</span>
                        </div>
                        <h2 className="text-xl font-bold text-aqua-text mb-2">Konfirmasi Hapus</h2>
                        <p className="text-sm text-gray-600 mb-6 leading-relaxed">
                            Apakah Anda yakin ingin menghapus <span className="font-bold text-red-500">{actionTarget.name}</span>? Tindakan ini tidak dapat dibatalkan.
                        </p>

                        <div className="flex gap-3">
                            <button onClick={() => setIsDeleteModalOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50">Batal</button>
                            <button
                                onClick={() => actionTarget.username ? handleDeleteUser(actionTarget.id) : handleDeleteDevice(actionTarget.id)}
                                className="flex-1 bg-red-500 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-red-600 shadow-sm"
                            >
                                Ya, Hapus
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL: GANTI WIFI */}
            {isChangeWifiOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" onClick={() => setIsChangeWifiOpen(false)}></div>
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-[400px] p-8 text-center relative z-10 animate-fade-in">
                        <div className="w-16 h-16 bg-[#eef3ea] text-[#667b68] rounded-full flex items-center justify-center mx-auto mb-4">
                            <span className={`material-symbols-outlined text-3xl ${isScanning ? 'animate-spin' : ''}`}>
                                {isScanning ? 'sync' : 'wifi_find'}
                            </span>
                        </div>
                        <h2 className="text-xl font-bold text-aqua-text mb-1">Konfigurasi WiFi Baru</h2>
                        <p className="text-xs text-gray-500 mb-6">Pilih jaringan yang tersedia atau masukkan manual.</p>

                        <div className="mb-6">
                            <div className="flex justify-between items-center mb-2">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Jaringan Terdeteksi</span>
                                <button
                                    onClick={handleScanWifi}
                                    disabled={isScanning}
                                    className="text-[10px] font-bold text-blue-500 hover:underline flex items-center gap-1 disabled:text-gray-400"
                                >
                                    <span className={`material-symbols-outlined text-[12px] ${isScanning ? 'animate-spin' : ''}`}>sync</span>
                                    Scan Ulang
                                </button>
                            </div>
                            <div className="max-h-40 overflow-y-auto border border-gray-100 rounded-xl bg-gray-50/50 p-2 space-y-1">
                                {state.wifi_list?.length > 0 ? (
                                    state.wifi_list.map((net, idx) => (
                                        <button
                                            key={idx}
                                            onClick={() => setNewWifiSSID(net.ssid)}
                                            className="w-full text-left p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-gray-400 text-sm group-hover:text-[#667b68]">wifi</span>
                                                <span className="text-xs font-medium text-gray-700">{net.ssid}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {net.secure && <span className="material-symbols-outlined text-[10px] text-gray-400">lock</span>}
                                                <span className="text-[10px] font-bold text-gray-400">{net.rssi} dBm</span>
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="py-8 text-center">
                                        <p className="text-[10px] text-gray-400 italic">
                                            {isScanning ? 'Sedang memindai...' : 'Klik Scan untuk mencari jaringan'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>

                        <form onSubmit={handleUpdateWifi} className="space-y-4 text-left">
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">SSID (Nama WiFi)</label>
                                <input type="text" value={newWifiSSID} onChange={e => setNewWifiSSID(e.target.value)} required placeholder="Masukkan SSID" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary" />
                            </div>
                            <div>
                                <label className="block text-[10px] font-bold text-gray-500 mb-1 ml-1">Password WiFi</label>
                                <input type="password" value={newWifiPass} onChange={e => setNewWifiPass(e.target.value)} required placeholder="Masukkan Password" className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:border-aqua-primary" />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button type="button" onClick={() => setIsChangeWifiOpen(false)} className="flex-1 bg-white border border-gray-200 text-gray-600 py-2.5 rounded-xl text-sm font-bold hover:bg-gray-50">Batal</button>
                                <button type="submit" className="flex-1 bg-aqua-primary text-white py-2.5 rounded-xl text-sm font-bold hover:bg-[#4a5743]">Update WiFi</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

        </div>
    );
}
