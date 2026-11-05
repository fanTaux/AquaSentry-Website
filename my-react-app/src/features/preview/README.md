# Preview AquaSentry

Modul exploded view diadaptasi dari proyek `Testing Exploded View`. Geometri,
posisi, dan kontrol model dipertahankan. Header, font, warna, dan navigasi mengikuti
website utama; CSS hanya berlaku di dalam `.aquasentry-preview`.

- Login tetap memakai `AppContext`. Tampilan yang sudah login memiliki state tab
  tersendiri, sehingga login baru dan refresh dimulai dari Preview.
- `App.jsx` memuat halaman secara lazy; `PreviewPage.jsx` memuat viewer 3D secara
  lazy. Canvas di-unmount saat meninggalkan Preview, termasuk saat logout.
- Tidak ada impor layanan API atau telemetri di modul ini. Tombol model hanya
  memanipulasi scene lokal, bukan mengirim perintah ke ESP32.
- Model berisi 12 komponen ilustratif, bukan CAD, hasil sensor, atau indikator
  kondisi perangkat nyata. Skrining tetap dilakukan melalui Monitoring.
- Kontrol kamera tersedia lewat mouse, sentuhan, tombol, dan keyboard. Preferensi
  reduced motion dihormati. Jika WebGL gagal, informasi komponen dan navigasi
  tetap tersedia.

## Validasi

```powershell
npm test
npm run lint
npm run build
```

Smoke test browser memakai Microsoft Edge yang sudah terinstal. Tidak perlu
menambah dependensi pengujian ke website utama: berikan path ke instalasi
Playwright yang sudah ada di proyek demo, atau instalasi lokal lain yang tersedia.

```powershell
npm run test:browser -- "D:\@Kuliah\Lomba\Unity_14\Testing Exploded View\node_modules\playwright\index.mjs"
```

Jalankan build terlebih dahulu. Test membuka server preview lokal dan browser
headless lalu menutup keduanya. Semua request backend dimock dan request eksternal
diblokir; test tidak mengakses ESP32 atau memodifikasi data backend. Screenshot
lokal disimpan di `tests/artifacts/` (diabaikan oleh Git).
