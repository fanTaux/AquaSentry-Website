// Illustrative scene units, not manufacturing measurements or live telemetry.
export const components = [
  {
    id: 'lid', name: 'Tutup casing', category: 'Struktur', icon: 'layers', color: '#a1b4c6',
    position: [0, 1.15, 0], offset: [0, 3.35, 0], label: [2.85, 0.12, -0.2],
    description: 'Panel atas yang melindungi rangkaian elektronik dan menutup ruang komponen AquaSentry.',
    facts: [['Peran', 'Pelindung bagian atas'], ['Posisi', 'Di atas casing utama']],
    note: 'Bentuk dan detail pengunci disederhanakan dari gambar referensi.',
  },
  {
    id: 'esp32', name: 'ESP32', category: 'Elektronik', icon: 'chip', color: '#ae8950',
    position: [0.05, 0.72, -0.5], offset: [0, 2.1, 0], label: [1.5, 0.16, -0.1],
    description: 'Mikrokontroler yang mengolah pembacaan sensor dan mendukung komunikasi nirkabel pada perangkat.',
    facts: [['Jenis', 'Mikrokontroler'], ['Konektivitas', 'Wi-Fi & Bluetooth']],
    note: 'Varian modul dan susunan pin pada model ini bersifat ilustratif.',
  },
  {
    id: 'pcb', name: 'PCB', category: 'Elektronik', icon: 'board', color: '#249777',
    position: [0, 0.35, -0.25], offset: [0, 1.08, 0], label: [2.15, 0, 0.1],
    description: 'Papan rangkaian yang menghubungkan ESP32, sensor, indikator, dan kontrol perangkat.',
    facts: [['Jenis', 'Papan prototipe'], ['Peran', 'Penghubung rangkaian']],
    note: 'Jalur, kabel, dan komponen kecil tidak mewakili skema kelistrikan final.',
  },
  {
    id: 'switch', name: 'Switch merah', category: 'Kontrol', icon: 'power', color: '#e15050',
    position: [1.75, 0.78, -1.1], offset: [0.6, 1.8, 0], label: [0.52, 0.3, 0],
    description: 'Sakelar fisik untuk menghubungkan atau memutus daya pada perangkat.',
    facts: [['Jenis', 'Rocker switch'], ['Peran', 'Kontrol daya']],
    note: 'Sakelar pada viewer hanya berupa model visual, bukan kontrol perangkat nyata.',
  },
  {
    id: 'case', name: 'Casing utama', category: 'Struktur', icon: 'box', color: '#4a5563',
    position: [0, 0, 0], offset: [0, 0, 0], label: [2.8, -0.35, 0.8],
    description: 'Rumah utama perangkat yang menyangga rangkaian, port sensor, dan panel indikator.',
    facts: [['Peran', 'Struktur perangkat'], ['Bentuk', 'Enclosure terbuka']],
    note: 'Ukuran, material, dan ketahanan air tidak dapat dipastikan dari gambar saja.',
  },
  {
    id: 'button', name: 'Pushbutton', category: 'Kontrol', icon: 'button', color: '#1683df',
    position: [1.75, 0.48, 1.38], offset: [0.7, 0.45, 0.6], label: [0.5, 0.15, 0],
    description: 'Tombol tekan sebagai masukan manual untuk menjalankan fungsi perangkat sesuai firmware.',
    facts: [['Jenis', 'Tombol tekan'], ['Posisi', 'Panel depan']],
    note: 'Tombol pada viewer tidak memulai atau membatalkan pengujian perangkat fisik.',
  },
  {
    id: 'water-led', name: 'Indikator kondisi air', category: 'Elektronik', icon: 'light', color: '#31a46a',
    position: [-0.9, 0.46, 1.38], offset: [0, 0.4, 0.55], label: [-0.35, 0.2, 0.35],
    description: 'Tiga LED berwarna merah, kuning, dan hijau untuk menampilkan kategori kondisi air.',
    facts: [['Warna', 'Merah, kuning, hijau'], ['Peran', 'Indikator visual']],
    note: 'Warna pada model bersifat ilustratif. Hasil skrining aktual tersedia di Monitoring.',
  },
  {
    id: 'power-led', name: 'Indikator alat aktif', category: 'Elektronik', icon: 'light', color: '#3578ed',
    position: [0.88, 0.46, 1.38], offset: [0.2, 0.4, 0.55], label: [0.25, 0.2, 0.35],
    description: 'LED biru sebagai penanda visual bahwa perangkat sedang aktif.',
    facts: [['Warna', 'Biru'], ['Peran', 'Indikator aktivitas']],
    note: 'Nyala LED di viewer tidak menunjukkan status koneksi atau daya perangkat nyata.',
  },
  {
    id: 'tds-port', name: 'Port sensor TDS', category: 'Konektor', icon: 'plug', color: '#6a7685',
    position: [-2.6, 0.12, -0.7], offset: [-0.5, 0.05, 0], label: [-0.1, 0.55, 0],
    description: 'Titik masuk kabel probe TDS menuju rangkaian di dalam casing.',
    facts: [['Terhubung ke', 'Probe TDS'], ['Posisi', 'Sisi kiri casing']],
    note: 'Model konektor tidak menentukan pinout maupun spesifikasi konektor sebenarnya.',
  },
  {
    id: 'turbidity-port', name: 'Port sensor turbidity', category: 'Konektor', icon: 'plug', color: '#6a7685',
    position: [-2.6, 0.12, 0.48], offset: [-0.5, 0.05, 0], label: [-0.1, 0.55, 0],
    description: 'Titik masuk kabel sensor kekeruhan menuju rangkaian pengolah di dalam casing.',
    facts: [['Terhubung ke', 'Probe turbidity'], ['Posisi', 'Sisi kiri casing']],
    note: 'Kabel dan konektor digambarkan secara sederhana untuk memperjelas susunan.',
  },
  {
    id: 'tds-probe', name: 'Probe TDS', category: 'Sensor', icon: 'water', color: '#57b9cf',
    position: [-4.45, 0.05, -0.7], offset: [-0.65, 0.3, -0.35], label: [-0.3, 0.5, 0],
    description: 'Probe untuk mengestimasi total padatan terlarut (TDS) berdasarkan konduktivitas air.',
    facts: [['Parameter', 'Estimasi TDS'], ['Satuan umum', 'ppm']],
    note: 'Viewer tidak melakukan pembacaan, kalibrasi, atau penilaian kualitas air.',
  },
  {
    id: 'turbidity-probe', name: 'Probe turbidity', category: 'Sensor', icon: 'water', color: '#75b9bf',
    position: [-4.4, -0.05, 1.25], offset: [-0.65, 0.25, 0.5], label: [-0.25, 0.65, 0],
    description: 'Sensor optik untuk mendeteksi kekeruhan air melalui perubahan cahaya yang melewati sampel.',
    facts: [['Parameter', 'Kekeruhan air'], ['Prinsip', 'Pengukuran optik']],
    note: 'Konversi ke NTU memerlukan kalibrasi dan karakteristik sensor sebenarnya.',
  },
];

export const componentMap = Object.fromEntries(components.map((part) => [part.id, part]));
export const categories = ['Semua', 'Struktur', 'Elektronik', 'Kontrol', 'Sensor', 'Konektor'];
