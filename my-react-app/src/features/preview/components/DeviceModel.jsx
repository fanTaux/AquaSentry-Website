import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Html, Line, RoundedBox, useCursor } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { CanvasTexture, MathUtils, Object3D, SRGBColorSpace } from 'three';
import { components } from '../data/components';
import { getPartPosition } from '../lib/model';

const PartContext = createContext({ selected: false, hovered: false });
const dark = '#242c34';
const metal = '#b4bec5';

function Finish({ color = dark, metalness = 0.15, roughness = 0.48, ...props }) {
  const { selected, hovered } = useContext(PartContext);
  return <meshStandardMaterial color={color} metalness={metalness} roughness={roughness} emissive={selected ? '#008bdb' : '#279bc5'} emissiveIntensity={selected ? 0.3 : hovered ? 0.12 : 0} {...props} />;
}

function Block({ size, position = [0, 0, 0], color, rounded = false, ...props }) {
  if (rounded) return <RoundedBox args={size} position={position} radius={Math.min(...size) * 0.2} smoothness={3} castShadow receiveShadow><Finish color={color} {...props} /></RoundedBox>;
  return <mesh position={position} castShadow receiveShadow><boxGeometry args={size} /><Finish color={color} {...props} /></mesh>;
}

function Cylinder({ radius = 0.1, height = 0.2, position = [0, 0, 0], color = metal, rotation, ...props }) {
  return <mesh position={position} rotation={rotation} castShadow receiveShadow><cylinderGeometry args={[radius, radius, height, 24]} /><Finish color={color} {...props} /></mesh>;
}

function Screw({ position }) {
  return <group position={position}>
    <Cylinder radius={0.085} height={0.025} color="#79848c" metalness={0.85} />
    <Block size={[0.08, 0.028, 0.015]} color="#38404a" position={[0, 0.01, 0]} />
    <Block size={[0.015, 0.028, 0.08]} color="#38404a" position={[0, 0.01, 0]} />
  </group>;
}

function PrintedMark({ type = 'brand', width = 2.4, depth = 0.7, position = [0, 0, 0] }) {
  const texture = useMemo(() => {
    const canvas = document.createElement('canvas');
    canvas.width = 768;
    canvas.height = 192;
    const context = canvas.getContext('2d');
    context.clearRect(0, 0, 768, 192);
    context.fillStyle = type === 'brand' ? '#173348' : '#f4f5f0';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = type === 'brand' ? 'bold 88px sans-serif' : 'bold 43px monospace';
    context.fillText(type === 'brand' ? 'AquaSentry' : 'ESP32  /  Wi-Fi + BT', 384, 95);
    const result = new CanvasTexture(canvas);
    result.colorSpace = SRGBColorSpace;
    return result;
  }, [type]);
  // R3F disposes scene geometry/materials; this locally generated texture is ours.
  useLayoutEffect(() => () => texture.dispose(), [texture]);
  return <mesh position={position} rotation={[-Math.PI / 2, 0, 0]}>
    <planeGeometry args={[width, depth]} />
    <meshBasicMaterial map={texture} transparent depthWrite={false} polygonOffset polygonOffsetFactor={-1} />
  </mesh>;
}

function Casing() {
  return <group>
    <Block size={[5.4, 0.23, 4.1]} position={[0, -0.53, 0]} rounded />
    <Block size={[5.4, 1.6, 0.18]} position={[0, 0.25, -1.96]} rounded />
    {[-2.6, 2.6].map((x) => <group key={x}>
      <Block size={[0.2, 1.6, 3.04]} position={[x, 0.25, -0.48]} rounded />
      <Block size={[0.2, 0.6, 1.08]} position={[x, -0.25, 1.5]} rounded />
    </group>)}
    <Block size={[5.4, 0.6, 0.18]} position={[0, -0.25, 1.96]} rounded />
    <Block size={[5.03, 0.18, 1.14]} position={[0, 0, 1.45]} rounded color="#343d46" />
    {[-2.24, 2.24].flatMap((x) => [-1.6, 0.72].map((z) => <group key={`${x}-${z}`}>
      <Cylinder position={[x, -0.11, z]} radius={0.16} height={0.64} color="#333d47" />
      <Cylinder position={[x, 0.22, z]} radius={0.062} height={0.018} color="#141b20" />
    </group>))}
    {[-2.35, 2.35].map((x) => <Screw key={x} position={[x, 0.103, 1.68]} />)}
    <PrintedMark width={1.15} depth={0.3} position={[-1.75, 0.102, 1.43]} />
  </group>;
}

function Lid() {
  return <group>
    <Block size={[5.4, 0.18, 3.08]} position={[0, 0, -0.48]} color="#f1f4f7" rounded roughness={0.28} />
    {[-2.65, 2.65].map((x) => <Block key={x} size={[0.12, 0.22, 3.15]} position={[x, 0, -0.48]} color="#303841" rounded />)}
    <Block size={[0.95, 0.07, 0.12]} position={[0, 0.115, -1.87]} color="#fafcfe" rounded />
    <PrintedMark position={[0, 0.096, -0.48]} width={3.05} depth={0.77} />
    {[-2.35, 2.35].flatMap((x) => [-1.7, 0.7].map((z) => <Screw key={`${x}-${z}`} position={[x, 0.1, z]} />))}
  </group>;
}

function BoardHoles() {
  const ref = useRef();
  const { selected, hovered } = useContext(PartContext);
  useLayoutEffect(() => {
    const dummy = new Object3D();
    let index = 0;
    for (let x = 0; x < 19; x++) {
      for (let z = 0; z < 11; z++) {
        dummy.position.set((x - 9) * 0.185, 0.058, (z - 5) * 0.185);
        dummy.rotation.set(Math.PI / 2, 0, 0);
        dummy.updateMatrix();
        ref.current.setMatrixAt(index++, dummy.matrix);
      }
    }
    ref.current.instanceMatrix.needsUpdate = true;
  }, []);
  return <instancedMesh ref={ref} args={[null, null, 209]}>
    <torusGeometry args={[0.035, 0.009, 5, 10]} />
    <meshStandardMaterial color="#dbc485" metalness={0.65} roughness={0.35} emissive="#168ecb" emissiveIntensity={selected ? 0.35 : hovered ? 0.15 : 0} />
  </instancedMesh>;
}

function PCB() {
  return <group>
    <Block size={[3.75, 0.1, 2.25]} color="#137553" rounded />
    <BoardHoles />
    {[-0.75, 0.78].flatMap((z) => [-1.0, 0.9].map((x) => <group key={`${x}-${z}`}>
      <Block size={[1.05, 0.18, 0.18]} position={[x, 0.14, z]} color="#1a242d" />
      {Array.from({ length: 6 }, (_, i) => <Block key={i} size={[0.065, 0.018, 0.065]} position={[x - 0.42 + i * 0.17, 0.235, z]} color="#6b777c" metalness={0.7} />)}
    </group>))}
    <Line points={[[-1.3, 0.24, 0.5], [-0.8, 0.45, 0.2], [0.1, 0.3, -0.5], [0.95, 0.24, -0.5]]} color="#ef9753" lineWidth={3} />
    <Line points={[[0.95, 0.24, 0.7], [0.6, 0.55, 0.3], [1, 0.56, -0.3], [1.3, 0.24, -0.6]]} color="#c186c2" lineWidth={3} />
    {[-1.65, 1.65].flatMap((x) => [-0.9, 0.9].map((z) => <Screw key={`${x}-${z}`} position={[x, 0.065, z]} />))}
  </group>;
}

function ESP32() {
  return <group>
    <Block size={[3.0, 0.095, 1.38]} color="#20292b" rounded />
    <Block size={[1.5, 0.23, 1.07]} position={[-0.1, 0.16, 0]} color="#c2bcae" metalness={0.8} roughness={0.29} rounded />
    <PrintedMark type="chip" width={1.23} depth={0.4} position={[-0.1, 0.282, 0]} />
    <Block size={[0.34, 0.22, 0.52]} position={[-1.4, 0.13, 0]} color="#bbc4c7" metalness={0.9} />
    <Block size={[0.02, 0.09, 0.34]} position={[-1.58, 0.13, 0]} color="#35414a" />
    {[-0.61, 0.61].map((z) => <group key={z}>
      <Block size={[2.68, 0.14, 0.13]} position={[0, -0.11, z]} color="#0e161d" />
      {Array.from({ length: 17 }, (_, i) => <Block key={i} size={[0.045, 0.32, 0.045]} position={[-1.25 + i * 0.155, -0.17, z]} color="#d4ad56" metalness={0.8} />)}
    </group>)}
    {Array.from({ length: 4 }, (_, i) => <group key={i}>
      <Block size={[0.04, 0.008, 0.8]} position={[0.92 + i * 0.13, 0.054, 0]} color="#ad9356" metalness={0.7} />
      <Block size={[0.14, 0.008, 0.04]} position={[0.98 + i * 0.13, 0.054, i % 2 ? 0.38 : -0.38]} color="#ad9356" />
    </group>)}
    {[-0.37, 0.35].map((z) => <Block key={z} size={[0.18, 0.065, 0.12]} position={[-1, 0.095, z]} color="#b5ad91" />)}
  </group>;
}

function PowerSwitch() {
  return <group>
    <Block size={[0.65, 0.47, 0.73]} color="#171d23" rounded />
    <Block size={[0.78, 0.09, 0.83]} position={[0, 0.23, 0]} color="#30353a" rounded />
    <group rotation={[0.15, 0, 0]} position={[0, 0.32, 0]}>
      <Block size={[0.54, 0.12, 0.62]} color="#e32c34" rounded roughness={0.25} />
      <Block size={[0.025, 0.005, 0.12]} position={[0, 0.062, -0.12]} color="#fff6ef" />
    </group>
    {[-0.16, 0.16].map((x, index) => <Line key={x} points={[[x, -0.2, 0], [x, -0.55, 0.15], [x - 0.3, -0.85, 0.15]]} color={index ? '#1e252c' : '#e94444'} lineWidth={4} />)}
  </group>;
}

function LED({ color }) {
  return <group>
    <Cylinder radius={0.14} height={0.25} position={[0, -0.16, 0]} color="#171f26" />
    <Cylinder radius={0.22} height={0.055} position={[0, -0.015, 0]} color="#78838b" metalness={0.8} />
    <Cylinder radius={0.145} height={0.16} position={[0, 0.06, 0]} color={color} roughness={0.2} />
    <mesh position={[0, 0.13, 0]} castShadow><sphereGeometry args={[0.145, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2]} /><Finish color={color} roughness={0.18} /></mesh>
    {[-0.045, 0.045].map((x) => <Cylinder key={x} radius={0.014} height={0.22} position={[x, -0.35, 0]} color={metal} metalness={0.85} />)}
  </group>;
}

function WaterLEDs() {
  return <group>{['#f13645', '#ffc928', '#23c76b'].map((color, i) => <group key={color} position={[(i - 1) * 0.62, 0, 0]}><LED color={color} /></group>)}</group>;
}

function Pushbutton() {
  return <group>
    <Cylinder radius={0.25} height={0.51} position={[0, -0.18, 0]} color="#252c34" />
    <Cylinder radius={0.38} height={0.09} color="#8b9499" metalness={0.8} />
    <Cylinder radius={0.34} height={0.11} position={[0, 0.06, 0]} color="#1d2630" />
    <Cylinder radius={0.265} height={0.17} position={[0, 0.17, 0]} color="#0087ec" roughness={0.21} />
  </group>;
}

function Port() {
  return <group rotation={[0, 0, Math.PI / 2]}>
    <Cylinder radius={0.29} height={0.49} color="#171e24" />
    <Cylinder radius={0.36} height={0.13} position={[0, -0.08, 0]} color="#303940" />
    <Cylinder radius={0.21} height={0.15} position={[0, 0.29, 0]} color="#12191e" />
    {Array.from({ length: 4 }, (_, i) => <Cylinder key={i} radius={0.299} height={0.025} position={[0, -0.17 + i * 0.075, 0]} color="#485159" />)}
  </group>;
}

function TDSProbe() {
  return <group rotation={[0, 0, Math.PI / 2]}>
    <Cylinder radius={0.22} height={0.9} color="#edf1ef" roughness={0.32} />
    <Cylinder radius={0.27} height={0.23} position={[0, -0.17, 0]} color="#f9faf8" />
    <Cylinder radius={0.14} height={0.28} position={[0, 0.5, 0]} color="#f5f7f6" />
    {[-0.1, 0.1].map((x) => <Cylinder key={x} radius={0.037} height={0.29} position={[x, 0.74, 0]} color="#b2b7b6" metalness={0.9} />)}
  </group>;
}

function TurbidityProbe() {
  return <group>
    <Cylinder radius={0.44} height={0.24} color="#252e35" />
    <Cylinder radius={0.34} height={0.6} position={[0, -0.36, 0]} color="#c2e7e7" transparent opacity={0.55} depthWrite={false} roughness={0.17} />
    <Block size={[0.16, 0.47, 0.28]} position={[-0.2, -0.72, 0]} color="#b8d6db" transparent opacity={0.7} depthWrite={false} />
    <Block size={[0.16, 0.47, 0.28]} position={[0.2, -0.72, 0]} color="#b8d6db" transparent opacity={0.7} depthWrite={false} />
    {[-0.2, 0.2].map((x) => <mesh key={x} position={[x, -0.65, 0]}><sphereGeometry args={[0.085, 12, 8]} /><Finish color="#30464e" /></mesh>)}
    <Block size={[0.65, 0.1, 0.16]} position={[0, -0.95, 0]} color="#b8d6db" transparent opacity={0.7} depthWrite={false} />
  </group>;
}

const geometries = {
  lid: Lid, case: Casing, pcb: PCB, esp32: ESP32, switch: PowerSwitch,
  button: Pushbutton, 'water-led': WaterLEDs,
  'power-led': () => <LED color="#1767ff" />,
  'tds-port': Port, 'turbidity-port': Port,
  'tds-probe': TDSProbe, 'turbidity-probe': TurbidityProbe,
};

function Part({ part, explosion, selected, hidden, onSelect, showLabels, reducedMotion }) {
  const ref = useRef();
  const [hovered, setHovered] = useState(false);
  const invalidate = useThree((state) => state.invalidate);
  useCursor(hovered && !hidden);
  const target = getPartPosition(part, explosion);
  const Shape = geometries[part.id];
  useEffect(() => { invalidate(); }, [explosion, hidden, invalidate]);
  useFrame((_, delta) => {
    if (!ref.current) return;
    const alpha = reducedMotion ? 1 : 1 - Math.exp(-9 * Math.min(delta, 0.1));
    let moving = false;
    target.forEach((coordinate, axis) => {
      const key = ['x', 'y', 'z'][axis];
      const current = ref.current.position[key];
      if (Math.abs(current - coordinate) > 0.0001) {
        ref.current.position[key] = MathUtils.lerp(current, coordinate, alpha);
        moving = !reducedMotion;
      } else ref.current.position[key] = coordinate;
    });
    if (moving) invalidate();
  });
  if (hidden) return null;
  return <group ref={ref} position={part.position}>
    <PartContext.Provider value={{ selected, hovered }}>
      <group
        onClick={(event) => { event.stopPropagation(); if (event.delta < 5) onSelect(part.id); }}
        onPointerOver={(event) => { event.stopPropagation(); setHovered(true); }}
        onPointerOut={() => setHovered(false)}
      ><Shape /></group>
      {(showLabels || selected) && <Html position={part.label} center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <button type="button" className={`model-label ${selected ? 'is-selected' : ''}`} onClick={() => onSelect(part.id)} tabIndex={-1} style={{ pointerEvents: 'auto' }}>
          <span className="label-pin" />{part.name}
        </button>
      </Html>}
    </PartContext.Provider>
  </group>;
}

function SensorCables({ explosion, hidden }) {
  const tdsStart = getPartPosition(components.find((part) => part.id === 'tds-port'), explosion);
  const tdsEnd = getPartPosition(components.find((part) => part.id === 'tds-probe'), explosion);
  const turbidityStart = getPartPosition(components.find((part) => part.id === 'turbidity-port'), explosion);
  const turbidityEnd = getPartPosition(components.find((part) => part.id === 'turbidity-probe'), explosion);
  return <group>
    {!hidden.has('tds-port') && !hidden.has('tds-probe') && <Line points={[[tdsStart[0] - 0.28, tdsStart[1], tdsStart[2]], [tdsStart[0] - 0.8, tdsStart[1] - 0.12, tdsStart[2]], [tdsEnd[0] + 0.7, tdsEnd[1], tdsEnd[2]], [tdsEnd[0] + 0.44, tdsEnd[1], tdsEnd[2]]]} color="#202a32" lineWidth={5} />}
    {!hidden.has('turbidity-port') && !hidden.has('turbidity-probe') && ['#e25248', '#efc445', '#337ee4'].map((color, i) => <Line key={color} points={[[turbidityStart[0] - 0.3, turbidityStart[1] + i * 0.045, turbidityStart[2]], [turbidityStart[0] - 0.8, turbidityStart[1] - 0.1 + i * 0.045, turbidityStart[2] + 0.1], [turbidityEnd[0] + 0.55, turbidityEnd[1] + i * 0.045, turbidityEnd[2]], [turbidityEnd[0], turbidityEnd[1] + 0.1, turbidityEnd[2]]]} color={color} lineWidth={2.5} />)}
  </group>;
}

export default function DeviceModel({ explosion, selected, hidden, onSelect, showLabels, reducedMotion }) {
  return <group>
    {components.map((part) => <Part key={part.id} part={part} explosion={explosion} selected={selected === part.id} hidden={hidden.has(part.id)} onSelect={onSelect} showLabels={showLabels} reducedMotion={reducedMotion} />)}
    <SensorCables explosion={explosion} hidden={hidden} />
    {explosion > 0.1 && !hidden.has('lid') && [-2.23, 2.23].flatMap((x) => [-1.6, 0.72].map((z) => <Line key={`${x}-${z}`} points={[[x, 0.2, z], [x, 1.15 + 3.35 * explosion, z]]} color="#94b7c7" lineWidth={0.8} dashed dashSize={0.07} gapSize={0.08} transparent opacity={0.65} />))}
  </group>;
}
