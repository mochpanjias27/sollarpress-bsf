import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Html, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { COL, speckleTexture } from './materials.js';

/* Exploded view interaktif: lapisan bergeser saat komponen dipilih (lerp). */

function useExplode(active) {
  const k = useRef(0);
  useFrame((_, dt) => { k.current += ((active ? 1 : 0) - k.current) * Math.min(1, dt * 3); });
  return k;
}

function Layer({ k, base, gap, children, label, tone = '', side = 1 }) {
  const g = useRef();
  useFrame(() => { if (g.current) g.current.position.y = base + gap * k.current; });
  return (
    <group ref={g} position={[0, base, 0]}>
      {children}
      {label && (
        <Html position={[side * 1.75, 0, 0]} center={false} zIndexRange={[10, 0]}>
          <div className={'callout ' + tone + (side < 0 ? ' l' : '')}><b>{label[0]}</b>{label[1]}</div>
        </Html>
      )}
    </group>
  );
}

/* ---------- 1. Mesin hot press ---------- */
function oilChannels(y) {
  const pts = [];
  for (let i = 0; i < 5; i++) {
    const z = -0.6 + i * 0.3;
    pts.push(new THREE.Vector3(i % 2 ? 0.8 : -0.8, y, z), new THREE.Vector3(i % 2 ? -0.8 : 0.8, y, z));
  }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
}
function PressExploded({ active }) {
  const k = useExplode(active);
  const tex = useMemo(() => speckleTexture('#dfe7dc', 11), []);
  const ch = useMemo(() => oilChannels(0.13), []);
  const glow = useRef();
  useFrame(({ clock }) => { if (glow.current) glow.current.emissiveIntensity = 0.9 + Math.sin(clock.elapsedTime * 2) * 0.3; });
  return (
    <group position={[0, -1.5, 0]}>
      <Layer k={k} base={0} gap={0} label={['Rangka baja WF400', 'menahan gaya tekan hidrolik']} side={-1}>
        <RoundedBox args={[2.4, 0.4, 1.9]} radius={0.04}><meshStandardMaterial color={COL.green} roughness={0.5} /></RoundedBox>
      </Layer>
      <Layer k={k} base={0.36} gap={0.55} label={['Pelat bawah berpemanas', 'saluran oli termal · 10 cm baja']} tone="o">
        <mesh><boxGeometry args={[2.1, 0.25, 1.7]} /><meshStandardMaterial color="#9c6a49" emissive={COL.orange} emissiveIntensity={0.2} metalness={0.3} roughness={0.45} transparent opacity={0.8} /></mesh>
        <mesh><tubeGeometry args={[ch, 160, 0.035, 8, false]} /><meshStandardMaterial ref={glow} color={COL.orange} emissive={COL.orange} emissiveIntensity={1} toneMapped={false} /></mesh>
      </Layer>
      <Layer k={k} base={0.55} gap={1.05} label={['Lembar Teflon / oli cetakan', 'mencegah plastik menempel']} side={-1}>
        <mesh><boxGeometry args={[1.85, 0.02, 1.45]} /><meshStandardMaterial color="#d9c9a8" roughness={0.3} transparent opacity={0.85} /></mesh>
      </Layer>
      <Layer k={k} base={0.62} gap={1.5} label={['Serpihan plastik campuran', '5 × 30 kg · 185–200 °C']} tone="t">
        <mesh><boxGeometry args={[1.75, 0.08, 1.35]} /><meshStandardMaterial map={tex} /></mesh>
      </Layer>
      <Layer k={k} base={0.72} gap={1.95} label={['Cetakan 130 × 250 cm', 'tebal 10 / 12 / 16 mm']} side={-1}>
        <mesh><boxGeometry args={[1.9, 0.1, 1.5]} /><meshStandardMaterial color={COL.steel} metalness={0.8} roughness={0.3} wireframe={false} transparent opacity={0.35} /></mesh>
      </Layer>
      <Layer k={k} base={0.92} gap={2.4} label={['Pelat atas berpemanas', 'bergerak vertikal pada guide pin']} tone="o">
        <mesh><boxGeometry args={[2.1, 0.25, 1.7]} /><meshStandardMaterial color="#9c6a49" emissive={COL.orange} emissiveIntensity={0.2} metalness={0.3} roughness={0.45} /></mesh>
      </Layer>
      <Layer k={k} base={1.25} gap={2.8} label={['Silinder hidrolik', 'F = P · A · kompaksi']} side={-1}>
        <mesh position={[0, 0.3, 0]}><cylinderGeometry args={[0.32, 0.32, 0.6, 32]} /><meshStandardMaterial color={COL.white} roughness={0.35} /></mesh>
        <mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.13, 0.13, 0.3, 16]} /><meshStandardMaterial color="#d7e0dd" metalness={0.9} roughness={0.15} /></mesh>
      </Layer>
    </group>
  );
}

/* ---------- 2. Panel surya ---------- */
function cellTexture() {
  const c = document.createElement('canvas'); c.width = 512; c.height = 320;
  const g = c.getContext('2d');
  g.fillStyle = '#0a1d36'; g.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 10; i++) for (let j = 0; j < 6; j++) {
    const x = 6 + i * 50.5, y = 6 + j * 51.5;
    const gr = g.createLinearGradient(x, y, x + 46, y + 46); gr.addColorStop(0, '#163d6e'); gr.addColorStop(1, '#0c2547');
    g.fillStyle = gr; g.fillRect(x, y, 46, 47);
    g.strokeStyle = 'rgba(190,215,255,.35)'; g.lineWidth = 1;
    for (let b = 1; b < 4; b++) { g.beginPath(); g.moveTo(x + b * 11.5, y); g.lineTo(x + b * 11.5, y + 47); g.stroke(); }
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}
function SolarExploded({ active }) {
  const k = useExplode(active);
  const cells = useMemo(cellTexture, []);
  return (
    <group position={[0, -1.3, 0]}>
      <Layer k={k} base={0} gap={0} label={['Rangka aluminium', 'kemiringan 10° menghadap utara']} side={-1}>
        <mesh><boxGeometry args={[2.6, 0.08, 1.6]} /><meshStandardMaterial color="#b9c3c0" metalness={0.7} roughness={0.3} /></mesh>
      </Layer>
      <Layer k={k} base={0.08} gap={0.4} label={['Backsheet', 'isolasi & pelindung kelembapan']}>
        <mesh><boxGeometry args={[2.5, 0.02, 1.5]} /><meshStandardMaterial color="#f4f6f3" /></mesh>
      </Layer>
      <Layer k={k} base={0.12} gap={0.8} label={['Sel surya monokristalin', '70 kWp total · PR 0,80']} tone="t" side={-1}>
        <mesh><boxGeometry args={[2.45, 0.03, 1.45]} /><meshStandardMaterial map={cells} metalness={0.3} roughness={0.25} emissive="#1d5fa8" emissiveIntensity={0.25} /></mesh>
      </Layer>
      <Layer k={k} base={0.16} gap={1.2} label={['Lapisan EVA', 'enkapsulasi sel']}>
        <mesh><boxGeometry args={[2.45, 0.015, 1.45]} /><meshStandardMaterial color="#ffffff" transparent opacity={0.3} /></mesh>
      </Layer>
      <Layer k={k} base={0.2} gap={1.6} label={['Kaca tempered 3,2 mm', 'anti-reflektif']} tone="o" side={-1}>
        <mesh><boxGeometry args={[2.5, 0.03, 1.5]} /><meshPhysicalMaterial color="#cfe9ff" transmission={0.6} transparent opacity={0.35} roughness={0.05} /></mesh>
      </Layer>
      <SunRays k={k} />
    </group>
  );
}
function SunRays({ k }) {
  const g = useRef();
  useFrame(({ clock }) => {
    if (!g.current) return;
    g.current.children.forEach((m, i) => { m.position.y = 3.6 - ((clock.elapsedTime * 1.2 + i * 0.37) % 1.8); m.material.opacity = 0.2 + 0.6 * k.current; });
  });
  return (
    <group ref={g}>
      {[...Array(6)].map((_, i) => (
        <mesh key={i} position={[-1 + i * 0.4, 3, -0.2 + (i % 2) * 0.4]}><boxGeometry args={[0.03, 0.4, 0.03]} /><meshBasicMaterial color={COL.sun} transparent toneMapped={false} /></mesh>
      ))}
    </group>
  );
}

/* ---------- 3. Baterai & kontrol ---------- */
function BatteryExploded({ active }) {
  const k = useExplode(active);
  const leds = useRef([]);
  useFrame(({ clock }) => {
    const lvl = 0.5 + 0.45 * Math.sin(clock.elapsedTime * 0.6);
    leds.current.forEach((m, i) => { if (m) m.opacity = i / leds.current.length < lvl ? 1 : 0.15; });
  });
  const Mod = ({ x }) => (
    <group position={[x, 0, 0]}>
      <RoundedBox args={[0.55, 1.6, 0.9]} radius={0.04} position={[0, 0.8, 0]}><meshStandardMaterial color={COL.white} roughness={0.45} /></RoundedBox>
      <mesh position={[0, 1.61, 0]}><boxGeometry args={[0.56, 0.04, 0.91]} /><meshStandardMaterial color={COL.green} /></mesh>
    </group>
  );
  const G = ({ dx, children, label, tone, side, ly = 2.25 }) => {
    const g = useRef();
    useFrame(() => { if (g.current) g.current.position.x = dx * (0.6 + 0.9 * k.current); });
    return <group ref={g}>{children}{label && <Html position={[0, ly, 0]} center><div className={'callout ' + (tone || '')} style={{ transform: 'translate(-50%,-100%)' }}><b>{label[0]}</b>{label[1]}</div></Html>}{void side}</group>;
  };
  return (
    <group position={[0, -1.5, 0]}>
      <G dx={-1.6} ly={1.95} label={['Modul LiFePO₄', '4 × 15 kWh = 60 kWh']} tone="t">
        {[-0.3, 0.3].map((x) => <Mod key={x} x={x} />)}
        {[...Array(8)].map((_, i) => (
          <mesh key={i} position={[-0.3 + (i % 2) * 0.6, 0.35 + Math.floor(i / 2) * 0.32, 0.46]}><boxGeometry args={[0.35, 0.06, 0.01]} /><meshBasicMaterial ref={(m) => (leds.current[i] = m)} color={COL.teal} transparent toneMapped={false} /></mesh>
        ))}
      </G>
      <G dx={0} ly={3.5} label={['Inverter hybrid 60 kW', 'PV ↔ baterai ↔ beban ↔ PLN']}>
        <RoundedBox args={[0.9, 1.2, 0.4]} radius={0.05} position={[0, 1.0, 0]}><meshStandardMaterial color="#ffffff" roughness={0.4} /></RoundedBox>
        <mesh position={[0, 1.2, 0.21]}><planeGeometry args={[0.5, 0.26]} /><meshBasicMaterial color={COL.teal} toneMapped={false} /></mesh>
        {[-0.2, 0, 0.2].map((x) => <mesh key={x} position={[x, 0.65, 0.21]}><circleGeometry args={[0.04, 16]} /><meshBasicMaterial color={x ? COL.orange : COL.teal} toneMapped={false} /></mesh>)}
      </G>
      <G dx={1.6} ly={2.05} label={['Panel kontrol + termokopel', 'menjalankan jadwal optimal']} tone="o">
        <RoundedBox args={[0.8, 1.5, 0.35]} radius={0.04} position={[0, 0.9, 0]}><meshStandardMaterial color={COL.green} roughness={0.45} /></RoundedBox>
        <mesh position={[0, 1.25, 0.18]}><planeGeometry args={[0.55, 0.4]} /><meshBasicMaterial color="#0d2416" /></mesh>
        <mesh position={[0, 1.25, 0.181]}><planeGeometry args={[0.45, 0.06]} /><meshBasicMaterial color={COL.sun} toneMapped={false} /></mesh>
        <mesh position={[0, 0.6, 0.18]}><circleGeometry args={[0.09, 24]} /><meshBasicMaterial color="#d03b3b" /></mesh>
      </G>
    </group>
  );
}

const VIEWS = { press: PressExploded, solar: SolarExploded, battery: BatteryExploded };

export default function TechExplorer({ view = 'press' }) {
  const V = VIEWS[view];
  return (
    <Canvas dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0 }}>
      <PerspectiveCamera makeDefault position={[6.6, 4.4, 7.9]} fov={38} />
      <ambientLight intensity={1.1} color="#ffffff" />
      <hemisphereLight args={['#ffffff', '#b9d3b4', 0.6]} />
      <directionalLight position={[4, 8, 5]} intensity={1.6} color="#fff6e5" />
      <pointLight position={[-3, 2, -2]} intensity={1} color="#cfe8d4" distance={9} />
      <group key={view}>
        <V active />
      </group>
      <ContactShadows position={[0, -1.55, 0]} opacity={0.3} scale={10} blur={2.6} far={3} color="#1f5c33" />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.6} minPolarAngle={0.5} maxPolarAngle={1.45} target={[0, 0.75, 0]} />
    </Canvas>
  );
}
