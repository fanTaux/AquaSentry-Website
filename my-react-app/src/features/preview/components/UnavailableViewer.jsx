import Icon from './Icon';

export default function UnavailableViewer() {
  return (
    <section className="viewer scene-fallback" role="alert" aria-label="Viewer 3D tidak tersedia">
      <Icon name="info" size={32} />
      <h3>Model 3D belum dapat ditampilkan</h3>
      <p>Periksa koneksi dan dukungan WebGL 2 browser. Daftar komponen dan menu Monitoring tetap bisa digunakan.</p>
      <button type="button" className="button secondary" onClick={() => window.location.reload()}>Muat ulang halaman</button>
    </section>
  );
}
