import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import ComponentPanel from './components/ComponentPanel';
import Icon from './components/Icon';
import SceneBoundary from './components/SceneBoundary';
import { componentMap, components } from './data/components';
import useReducedMotion from './hooks/useReducedMotion';
import { getPartPosition } from './lib/model';
import './preview.css';

const Viewer = lazy(() => import('./components/Viewer'));

export default function PreviewPage({ onMonitoring }) {
  const [explosion, setExplosion] = useState(0.82);
  const [selected, setSelected] = useState(null);
  const [hidden, setHidden] = useState(() => new Set());
  const [showLabels, setShowLabels] = useState(false);
  const [command, setCommand] = useState(null);
  const [ready, setReady] = useState(false);
  const sequence = useRef(0);
  const guide = useRef(null);
  const reducedMotion = useReducedMotion();
  const handleReady = useCallback(() => setReady(true), []);
  const handleUnavailable = useCallback(() => setReady(false), []);

  function sendCommand(type, target) {
    setCommand({ type, target, sequence: ++sequence.current });
  }

  function toggleHidden(id) {
    setHidden((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <section className="aquasentry-preview" aria-labelledby="preview-title">
      <div className="page-intro">
        <div>
          <h1 id="preview-title">Di balik AquaSentry.</h1>
          <p>Putar, pisahkan, dan kenali teknologi di balik skrining kualitas air.</p>
        </div>
        <button type="button" className="guide-button" onClick={() => guide.current.showModal()}>
          <Icon name="help" size={18} />Panduan
        </button>
      </div>

      <div className="explorer-layout">
        <SceneBoundary onFailure={handleUnavailable}>
          <Suspense fallback={<div className="viewer viewer-placeholder" role="status"><span className="loader" />Memuat viewer 3D…</div>}>
            <Viewer explosion={explosion} setExplosion={setExplosion} selected={selected} hidden={hidden} onSelect={setSelected} showLabels={showLabels} setShowLabels={setShowLabels} reducedMotion={reducedMotion} command={command} sendCommand={sendCommand} onReady={handleReady} onUnavailable={handleUnavailable} ready={ready} />
          </Suspense>
        </SceneBoundary>
        <ComponentPanel selected={selected} onSelect={setSelected} hidden={hidden} toggleHidden={toggleHidden} showAll={() => setHidden(new Set())} canFocus={ready} onFocus={(id) => sendCommand('focus', getPartPosition(componentMap[id], explosion))} />
      </div>

      <div className="illustration-note">
        <Icon name="info" size={18} />
        <p>Model ilustratif dengan {components.length} bagian, bukan model CAD atau data sensor langsung. Untuk melakukan skrining kualitas air, buka Monitoring.</p>
      </div>
      <div className="preview-footer">
        <button type="button" className="guide-button" onClick={() => guide.current.showModal()}>Cara menggunakan<Icon name="help" size={16} /></button>
        <button type="button" className="button primary" onClick={onMonitoring}>Buka Monitoring<Icon name="arrow" size={17} /></button>
      </div>

      <dialog ref={guide} className="guide-dialog" aria-labelledby="preview-guide-title" onClick={(event) => { if (event.target === event.currentTarget) guide.current.close(); }}>
        <div className="guide-content">
          <div className="guide-dialog-heading"><span className="intro-icon"><Icon name="rotate" size={25} /></span><button type="button" className="icon-button" aria-label="Tutup panduan" onClick={() => guide.current.close()}><Icon name="close" /></button></div>
          <h2 id="preview-guide-title">Jelajahi dari setiap sudut.</h2>
          <p className="guide-lead">Mulai dengan memutar model, lalu pilih bagian yang ingin kamu kenali.</p>
          <dl className="guide-steps">
            <div><dt><Icon name="rotate" />Putar & perbesar</dt><dd>Drag dengan mouse atau satu jari untuk memutar. Scroll atau cubit dengan dua jari untuk zoom. Klik kanan + drag untuk menggeser.</dd></div>
            <div><dt><Icon name="layers" />Pisahkan susunannya</dt><dd>Geser pengatur jarak di bawah model, atau pilih tombol Exploded dan Terakit.</dd></div>
            <div><dt><Icon name="target" />Kenali setiap komponen</dt><dd>Klik bagian pada model atau daftar. Gunakan Fokus ke komponen untuk melihat lebih dekat dan ikon mata untuk menyembunyikannya.</dd></div>
          </dl>
          <div className="keyboard-guide"><strong>Dengan keyboard</strong><p>Tab ke area model, lalu gunakan <kbd>←</kbd> <kbd>→</kbd> untuk memutar, <kbd>+</kbd> <kbd>−</kbd> untuk zoom, dan <kbd>Home</kbd> untuk reset kamera. Semua kontrol juga tersedia sebagai tombol.</p></div>
          <p className="guide-disclaimer">Preview tidak mengirim perintah ke perangkat fisik dan tidak menampilkan hasil pengukuran air.</p>
          <button type="button" className="button primary" onClick={() => guide.current.close()}>Mulai menjelajah<Icon name="arrow" size={17} /></button>
        </div>
      </dialog>
    </section>
  );
}
