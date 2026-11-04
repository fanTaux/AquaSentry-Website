import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Vector3 } from 'three';
import DeviceModel from './DeviceModel';
import Icon from './Icon';
import SceneBoundary from './SceneBoundary';
import UnavailableViewer from './UnavailableViewer';

function CameraRig({ command, reducedMotion }) {
  const controls = useRef();
  const get = useThree((state) => state.get);
  const size = useThree((state) => state.size);
  const baseZoom = Math.min(size.width / 12.5, size.height / 8.4);
  useEffect(() => {
    const orbit = controls.current;
    if (!orbit) return;
    // Three.js cameras are imperative scene objects, not immutable React state.
    const { camera, invalidate } = get();
    const target = new Vector3(-0.65, 1.65, 0);
    const action = command?.type || 'reset';
    if (action === 'reset' || action === 'isometric') {
      orbit.target.copy(target);
      camera.position.set(10, 9, 13);
      camera.zoom = baseZoom;
    } else if (action === 'top') {
      orbit.target.copy(target);
      camera.position.copy(target).add(new Vector3(0.01, 18, 0.01));
      camera.zoom = baseZoom;
    } else if (action === 'front') {
      orbit.target.copy(target);
      camera.position.copy(target).add(new Vector3(0, 2, 18));
      camera.zoom = baseZoom;
    } else if (action === 'zoom-in' || action === 'zoom-out') {
      camera.zoom = Math.max(baseZoom * 0.55, Math.min(baseZoom * 3, camera.zoom * (action === 'zoom-in' ? 1.2 : 1 / 1.2)));
    } else if (action === 'rotate-left' || action === 'rotate-right') {
      const offset = camera.position.clone().sub(orbit.target);
      offset.applyAxisAngle(new Vector3(0, 1, 0), action === 'rotate-left' ? -Math.PI / 8 : Math.PI / 8);
      camera.position.copy(orbit.target).add(offset);
    } else if (action === 'focus' && command.target) {
      const offset = camera.position.clone().sub(orbit.target);
      orbit.target.fromArray(command.target);
      camera.position.copy(orbit.target).add(offset);
      camera.zoom = baseZoom * 1.65;
    }
    camera.updateProjectionMatrix();
    orbit.update();
    invalidate();
  }, [command, get, baseZoom]);
  return <OrbitControls ref={controls} makeDefault enableDamping={!reducedMotion} dampingFactor={0.1} minZoom={baseZoom * 0.55} maxZoom={baseZoom * 3} minPolarAngle={0.02} maxPolarAngle={Math.PI * 0.82} target={[-0.65, 1.65, 0]} />;
}

function SceneStatus({ onReady }) {
  useEffect(() => { onReady(); }, [onReady]);
  return null;
}

export default function Viewer({ explosion, setExplosion, selected, hidden, onSelect, showLabels, setShowLabels, reducedMotion, command, sendCommand, onReady, onUnavailable, ready }) {
  const [view, setView] = useState('isometric');
  const [failed, setFailed] = useState(false);
  const handleUnavailable = useCallback(() => {
    setFailed(true);
    onUnavailable();
  }, [onUnavailable]);
  function changeView(value) {
    setView(value);
    sendCommand(value);
  }
  function handleKey(event) {
    if (event.target !== event.currentTarget) return;
    const shortcuts = { ArrowLeft: 'rotate-left', ArrowRight: 'rotate-right', '+': 'zoom-in', '=': 'zoom-in', '-': 'zoom-out', Home: 'reset' };
    if (shortcuts[event.key]) { event.preventDefault(); sendCommand(shortcuts[event.key]); }
  }
  if (failed) return <UnavailableViewer />;

  return <section className="viewer" aria-label="Viewer 3D AquaSentry">
    <div className="stage-topbar">
      <div className="mode-switch" aria-label="Kondisi susunan model">
        <button type="button" className={explosion > 0 ? 'active' : ''} aria-pressed={explosion > 0} onClick={() => setExplosion(1)}><Icon name="layers" size={17} />Exploded</button>
        <button type="button" className={explosion === 0 ? 'active' : ''} aria-pressed={explosion === 0} onClick={() => setExplosion(0)}><Icon name="box" size={17} />Terakit</button>
      </div>
      <button type="button" className={`label-toggle ${showLabels ? 'active' : ''}`} aria-label="Label komponen" aria-pressed={showLabels} onClick={() => setShowLabels(!showLabels)}><Icon name="tag" size={17} /><span>Label komponen</span></button>
    </div>

    <div className="canvas-region" role="region" tabIndex={0} aria-label="Model 3D interaktif. Panah kiri dan kanan untuk memutar, plus dan minus untuk zoom, Home untuk reset." onKeyDown={handleKey}>
      <SceneBoundary onFailure={handleUnavailable}>
        <Suspense fallback={<div className="scene-loading" role="status"><span className="loader" />Menyiapkan model AquaSentry…</div>}>
          <Canvas orthographic frameloop="demand" camera={{ position: [10, 9, 13], zoom: 65, near: 0.1, far: 100 }} dpr={[1, 1.75]} shadows gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }} fallback={<UnavailableViewer />} onPointerMissed={(event) => { if (event.type === 'click') onSelect(null); }}>
            <ambientLight intensity={1.1} />
            <hemisphereLight args={['#effaff', '#91a2a9', 1.7]} />
            <directionalLight position={[2, 10, 5]} intensity={3.2} castShadow shadow-mapSize={[1024, 1024]} shadow-camera-left={-9} shadow-camera-right={9} shadow-camera-top={9} shadow-camera-bottom={-9} shadow-bias={-0.001} />
            <directionalLight position={[-6, 4, -5]} intensity={1.9} color="#d6edff" />
            <DeviceModel explosion={explosion} selected={selected} hidden={hidden} onSelect={onSelect} showLabels={showLabels} reducedMotion={reducedMotion} />
            <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1.4, 0]} receiveShadow><planeGeometry args={[50, 50]} /><shadowMaterial transparent opacity={0.13} /></mesh>
            <CameraRig command={command} reducedMotion={reducedMotion} />
            <SceneStatus onReady={onReady} />
          </Canvas>
        </Suspense>
      </SceneBoundary>
    </div>

    <div className="scene-caption"><span className={`status-dot ${ready ? 'ready' : ''}`} /><span role="status">{ready ? 'Model 3D interaktif' : 'Menyiapkan tampilan 3D'}</span><span className="caption-divider" />Rekonstruksi ilustratif</div>

    <div className="camera-tools" aria-label="Kontrol kamera">
      <button type="button" title="Perbesar" aria-label="Perbesar model" onClick={() => sendCommand('zoom-in')}><Icon name="plus" /></button>
      <button type="button" title="Perkecil" aria-label="Perkecil model" onClick={() => sendCommand('zoom-out')}><Icon name="minus" /></button>
      <span />
      <button type="button" title="Putar ke kiri" aria-label="Putar model ke kiri" onClick={() => sendCommand('rotate-left')}><Icon name="rotate" /></button>
      <button type="button" title="Putar ke kanan" aria-label="Putar model ke kanan" onClick={() => sendCommand('rotate-right')}><Icon name="rotate" style={{ transform: 'scaleX(-1)' }} /></button>
      <span />
      <button type="button" title="Reset kamera" aria-label="Reset kamera" onClick={() => { setView('isometric'); sendCommand('reset'); }}><Icon name="reset" /></button>
    </div>

    <div className="view-presets" aria-label="Sudut pandang kamera">
      {[['isometric', 'Perspektif'], ['front', 'Depan'], ['top', 'Atas']].map(([id, label]) => <button type="button" key={id} className={view === id ? 'active' : ''} aria-pressed={view === id} onClick={() => changeView(id)}>{label}</button>)}
    </div>

    <div className="explosion-control">
      <div className="explosion-heading"><label htmlFor="preview-explosion">Jarak antarkomponen</label><output htmlFor="preview-explosion">{Math.round(explosion * 100)}<span>%</span></output></div>
      <input id="preview-explosion" type="range" min="0" max="100" step="1" value={Math.round(explosion * 100)} onChange={(event) => setExplosion(Number(event.target.value) / 100)} style={{ '--progress': `${explosion * 100}%` }} aria-valuetext={`${Math.round(explosion * 100)} persen terpisah`} />
      <div className="range-labels"><span>Terakit</span><span>Terpisah sepenuhnya</span></div>
    </div>
    <div className="viewer-hint"><Icon name="rotate" size={15} /><span>Drag untuk memutar</span><span className="hint-dot" /><span>Scroll untuk zoom</span><span className="hint-dot" /><span>Klik untuk mengenali</span></div>
  </section>;
}
