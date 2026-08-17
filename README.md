# 💧 AquaSentry

**Alat skrining dini kualitas air portabel berbasis IoT & AI**, dirancang untuk pekerja lapangan (pekerja hutan, pekerja tambang) dan petualang outdoor yang sering mengandalkan sumber air yang belum diketahui kualitasnya — mata air, sungai, tandon umum, atau penampungan di lokasi transit.

Repo ini berisi **frontend/dashboard** AquaSentry — bagian backend & firmware ESP32 dikembangkan terpisah.

---

## 🌊 Tentang AquaSentry

Air terlihat jernih bukan berarti aman digunakan. Di lapangan, pengujian laboratorium tidak praktis dibawa — berukuran besar, mahal, dan prosesnya tidak instan. AquaSentry hadir sebagai jalan tengah: perangkat kecil berbasis **ESP32** dengan dua sensor utama, **TDS** (Total Dissolved Solids) dan **turbidity** (kekeruhan), yang mengubah pembacaan sensor menjadi skor risiko yang mudah dipahami — **AquaSentry Risk Score (ARS)**.

ARS dihitung dari normalisasi TDS & turbidity terhadap ambang batas WHO dan Peraturan Menteri Kesehatan RI, lalu diklasifikasikan lewat model machine learning (ensemble tree-based) ke empat kategori risiko:

| Kategori | Warna | Arti |
|---|---|---|
| 🟢 Low Risk | Hijau | Relatif aman untuk kebutuhan dasar |
| 🟡 Moderate Risk | Kuning | Gunakan dengan hati-hati |
| 🟠 High Risk | Oranye | Tidak disarankan tanpa penanganan lebih lanjut |
| 🔴 Very High Risk | Merah | Sebaiknya dihindari |

⚠️ **Penting:** AquaSentry adalah alat **skrining dini (triase)**, bukan pengganti pengujian laboratorium atau penentu kelayakan air minum secara mutlak — parameter yang diukur bersifat fisika-kimia dan belum mencakup aspek mikrobiologi.

---

## 🏆 Latar Belakang Lomba

AquaSentry dikembangkan untuk **ITCC (Information Technology Creative Competition) 2026** — kompetisi Internet of Things yang diselenggarakan oleh **Himpunan Mahasiswa Teknologi Informasi (HMTI), Fakultas Teknik, Universitas Udayana**.

- 🎯 **Tema besar:** *Empowering Society Through Smart and Sustainable IoT Innovations*
- 📌 **Subtema:** Smart Health & Accessible Care
- 🧭 **Fokus solusi:** mendekatkan pemantauan kualitas air dasar ke masyarakat/pekerja yang secara struktural tidak punya akses ke fasilitas pengujian air

Repo ini adalah bagian dari purwarupa yang diajukan tim untuk babak seleksi hingga final ITCC 2026.

---

## 🛠️ Tech Stack

| Layer | Teknologi |
|---|---|
| Framework | [React 19](https://react.dev/) |
| Build tool | [Vite](https://vite.dev/) |
| Styling | [Tailwind CSS 3](https://tailwindcss.com/) + PostCSS/Autoprefixer |
| Ikon | [Material Symbols Outlined](https://fonts.google.com/icons) |
| Font | Plus Jakarta Sans (Google Fonts) |
| State management | React Context API (`AppContext.jsx`) |
| Linting | oxlint |

> 🧪 **Mode saat ini: Demo/Mock.** Dashboard menampilkan data sensor simulasi (bukan koneksi live ke perangkat), karena backend & firmware ESP32 AquaSentry masih dalam pengembangan terpisah. Titik integrasi ada di satu file: `src/context/AppContext.jsx` — ganti fungsi `buildReading()` di sana dengan pemanggilan API/WebSocket asli begitu backend siap; komponen lain tidak perlu disentuh.

### ✂️ Fitur yang sengaja tidak ada

Repo ini adalah hasil adaptasi dari proyek IoT sebelumnya (FungiGuard). Fitur kontrol aktuator (kontrol lampu, master power, penjadwalan otomatis) **sengaja dihapus** karena AquaSentry adalah perangkat baca-saja (skrining pasif), bukan alat yang mengendalikan perangkat lain.

---

## 🚀 Cara Menjalankan (Replikasi Lokal)

### Prasyarat
- [Node.js](https://nodejs.org/) versi 18 ke atas
- npm (terpasang otomatis bersama Node.js)

### Langkah-langkah

```bash
# 1. Clone repo ini
git clone https://github.com/fanTaux/AquaSentry-Website.git
cd AquaSentry-Website

# 2. Masuk ke folder project React (bukan di root repo!)
cd my-react-app

# 3. Install dependency
npm install

# 4. Jalankan mode development
npm run dev
```

Buka URL yang muncul di terminal (biasanya `http://localhost:5173`). Login menggunakan username/password apa saja — ini mode demo, tidak ada autentikasi ke server manapun.

### Build untuk produksi

```bash
npm run build
```

Hasil build statis akan ada di folder `my-react-app/dist/` — folder ini yang di-deploy ke hosting statis (Vercel, Netlify, GitHub Pages, dll).

---

## 📁 Struktur Folder Penting

```
my-react-app/
├── public/
│   └── favicon.svg          # Ikon tab browser
├── src/
│   ├── components/
│   │   ├── DashboardMetrics.jsx   # Tampilan utama: ARS gauge, TDS/turbidity, riwayat
│   │   ├── AlertHistory.jsx       # Riwayat peringatan risiko tinggi
│   │   ├── SettingsPage.jsx       # Manajemen pengguna & perangkat
│   │   ├── TopNavBar.jsx          # Navigasi atas + notifikasi
│   │   ├── Login.jsx              # Halaman login (mode demo)
│   │   └── ProfilePage.jsx        # Profil pengguna
│   ├── context/
│   │   └── AppContext.jsx    # 🔌 Sumber data — titik integrasi backend nanti
│   └── index.css             # Entry point Tailwind
├── tailwind.config.js        # Design system / warna AquaSentry
└── vite.config.js
```

---

## 🎨 Design System

| Warna | Hex | Fungsi |
|---|---|---|
| Primary Ocean Blue | `#0077B6` | Header, tombol utama |
| Secondary Aqua Blue | `#48CAE4` | Aksen, tombol sekunder |
| Success Emerald Green | `#2DC653` | Status air aman |
| Warning Amber | `#F4A261` | Status perlu waspada |
| Danger Coral Red | `#E63946` | Status berbahaya |
| Background Ice White | `#F8FCFD` | Latar aplikasi |

---

## 👥 Tim

Dikembangkan untuk ITCC 2026 — HMTI Universitas Udayana.

---

## 📄 Lisensi

Belum ditentukan — tambahkan lisensi sesuai kebutuhan tim sebelum repo bersifat publik permanen.