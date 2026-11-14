import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, RoundedBox, Html, ContactShadows, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';
import { COL, speckleTexture } from './materials.js';

/* Digital twin 3D: warna pelat mengikuti suhu terukur, pelat atas turun saat menekan,
   kumparan pemanas menyala sesuai daya heater, panel surya & baterai mengikuti data.
   Data dibaca per frame dari `live.current` (tanpa render ulang React). */

const cold = new THREE.Color('#5b8fd6'), warm = new THREE.Color('#3fae6a'), hot = new THREE.Color('#ef7a35'), over = new THREE.Color('#d03b3b');
function tempColor(t, out) {
  if (t < 120) return out.copy(cold).lerp(warm, Math.max(0, (t - 25) / 95));
  if (t < 185) return out.copy(warm).lerp(hot, (t - 120) / 65);
  if (t <= 200) return out.copy(hot);
  return out.copy(hot).lerp(over, Math.min(1, (t - 200) / 15));
}

function oilCoil(y) {
  const pts = [];
  for (let i = 0; i < 5; i++) { const z = -0.6 + i * 0.3; pts.push(new THREE.Vector3(i % 2 ? 0.8 : -0.8, y, z), new THREE.Vector3(i % 2 ? -0.8 : 0.8, y, z)); }
  return new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.05);
}

function Press({ live }) {
  const bot = useRef(), topM = useRef(), top = useRef(), coil = useRef(), rod = useRef(), label = useRef(), twinLbl = useRef();
  const tex = useMemo(() => speckleTexture('#dfe7dc', 5), []);
  const curve = useMemo(() => oilCoil(0.14), []);
  const c = useMemo(() => new THREE.Color(), []);
  useFrame(() => {
    const L = live.current || {};
    const t = L.temp ?? 27;
    tempColor(t, c);
    if (bot.current) { bot.current.color.copy(c); bot.current.emissive.copy(c); bot.current.emissiveIntensity = Math.max(0, (t - 120) / 160); }
    if (topM.current) { topM.current.color.copy(c); topM.current.emissive.copy(c); topM.current.emissiveIntensity = Math.max(0, (t - 120) / 160); }
    const yT = L.press ? 0.98 : 1.85;
    if (top.current) top.current.position.y += (yT - top.current.position.y) * 0.08;
    if (rod.current && top.current) { const y = top.current.position.y; rod.current.scale.y = (3.0 - y) / 1.2; rod.current.position.y = (3.0 + y) / 2 + 0.1; }
    if (coil.current) coil.current.emissiveIntensity = 0.1 + 1.6 * Math.min(1, (L.heater ?? 0) / 30);
    if (label.current) label.current.textContent = `${t.toFixed(1)} °C`;
    if (twinLbl.current) twinLbl.current.textContent = L.twin != null ? `twin ${L.twin.toFixed(1)} °C` : '';
  });
  const cols = [[-0.95, -0.75], [0.95, -0.75], [-0.95, 0.75], [0.95, 0.75]];
  return (
    <group>
      <RoundedBox args={[2.4, 0.55, 2.0]} radius={0.05} position={[0, 0.27, 0]} castShadow receiveShadow><meshStandardMaterial color={COL.white} roughness={0.45} /></RoundedBox>
      <mesh position={[0, 0.66, 0]} castShadow><boxGeometry args={[2.0, 0.22, 1.6]} /><meshStandardMaterial ref={bot} color="#8a5a3c" roughness={0.45} metalness={0.3} transparent opacity={0.92} /></mesh>
      <mesh><tubeGeometry args={[curve, 160, 0.03, 8, false]} /><meshStandardMaterial ref={coil} color={COL.orange} emissive={COL.orange} emissiveIntensity={0.5} toneMapped={false} /></mesh>
      <mesh position={[0, 0.8, 0]}><boxGeometry args={[1.7, 0.06, 1.3]} /><meshStandardMaterial map={tex} /></mesh>
      {cols.map(([x, z]) => <mesh key={x + '' + z} position={[x, 1.7, z]} castShadow><cylinderGeometry args={[0.07, 0.07, 2.4, 16]} /><meshStandardMaterial color={COL.steel} metalness={0.85} roughness={0.25} /></mesh>)}
      <RoundedBox args={[2.4, 0.4, 1.95]} radius={0.05} position={[0, 3.0, 0]} castShadow><meshStandardMaterial color={COL.green} roughness={0.45} /></RoundedBox>
      <mesh position={[0, 3.45, 0]}><cylinderGeometry args={[0.33, 0.33, 0.55, 24]} /><meshStandardMaterial color={COL.white} /></mesh>
      <mesh ref={rod} position={[0, 2.5, 0]}><cylinderGeometry args={[0.12, 0.12, 1.2, 16]} /><meshStandardMaterial color="#d7e0dd" metalness={0.9} roughness={0.15} /></mesh>
      <group ref={top} position={[0, 1.85, 0]}>
        <mesh castShadow><boxGeometry args={[2.0, 0.22, 1.6]} /><meshStandardMaterial ref={topM} color="#8a5a3c" roughness={0.45} metalness={0.3} /></mesh>
      </group>
      <Html position={[0, 0.66, 1.15]} center>
        <div className="twin-temp"><b ref={label}>—</b><span ref={twinLbl} /></div>
      </Html>
    </group>
  );
}

function Solar({ live }) {
  const cells = useRef(), lbl = useRef();
  useFrame(() => {
    const pv = live.current?.pv ?? 0;
    if (cells.current) cells.current.emissiveIntensity = 0.1 + Math.min(1.2, pv / 45);
    if (lbl.current) lbl.current.textContent = `${pv.toFixed(1)} kW`;
  });
  return (
    <group position={[-3.0, 0, -0.6]}>
      {[0, 1].map((r) => (
        <group key={r} position={[0, 0, r * 1.0 - 0.5]}>
          <mesh position={[0, 0.35, 0.1]}><cylinderGeometry args={[0.03, 0.03, 0.7]} /><meshStandardMaterial color={COL.steel} /></mesh>
          <group position={[0, 0.75, 0]} rotation-x={-0.32}>
            <mesh><boxGeometry args={[1.5, 0.05, 0.85]} /><meshStandardMaterial color="#c9d3d0" metalness={0.6} roughness={0.35} /></mesh>
            <mesh position={[0, 0.03, 0]}><boxGeometry args={[1.42, 0.02, 0.78]} /><meshStandardMaterial ref={r === 0 ? cells : undefined} color={COL.cell} emissive="#3d86e0" emissiveIntensity={0.4} metalness={0.4} roughness={0.25} /></mesh>
          </group>
        </group>
      ))}
      <Html position={[0, 1.6, 0]} center><div className="callout t" style={{ transform: 'translate(-50%,-50%)' }}><b>☀ PV</b><span ref={lbl}>—</span></div></Html>
    </group>
  );
}

function Battery({ live }) {
  const fill = useRef(), lbl = useRef();
  useFrame(() => {
    const soc = live.current?.soc ?? 0.5;
    if (fill.current) { fill.current.scale.y = Math.max(0.02, soc); fill.current.position.y = 0.15 + (1.2 * soc) / 2; }
    if (lbl.current) lbl.current.textContent = `${Math.round(soc * 100)}%`;
  });
  return (
    <group position={[2.8, 0, -0.4]}>
      <RoundedBox args={[0.7, 1.5, 0.6]} radius={0.05} position={[0, 0.75, 0]}><meshStandardMaterial color={COL.white} transparent opacity={0.55} /></RoundedBox>
      <mesh ref={fill} position={[0, 0.75, 0]}><boxGeometry args={[0.55, 1.2, 0.45]} /><meshStandardMaterial color={COL.teal} emissive={COL.teal} emissiveIntensity={0.3} /></mesh>
      <mesh position={[0, 1.52, 0]}><boxGeometry args={[0.72, 0.04, 0.62]} /><meshStandardMaterial color={COL.green} /></mesh>
      <Html position={[0, 1.9, 0]} center><div className="callout t" style={{ transform: 'translate(-50%,-50%)' }}><b>🔋 SOC</b><span ref={lbl}>—</span></div></Html>
    </group>
  );
}

export default function TwinScene({ live }) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0 }}>
      <PerspectiveCamera makeDefault position={[5.5, 4.6, 7.2]} fov={36} />
      <ambientLight intensity={1.0} />
      <hemisphereLight args={['#ffffff', '#b9d3b4', 0.6]} />
      <directionalLight position={[4, 8, 5]} intensity={1.5} castShadow color="#fff6e5" />
      <group position={[0.3, -0.9, 0]}>
        <Press live={live} />
        <Solar live={live} />
        <Battery live={live} />
        <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={12} blur={2.5} far={3} color="#1f5c33" />
      </group>
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.35} minPolarAngle={0.5} maxPolarAngle={1.4} target={[0, 0.4, 0]} />
    </Canvas>
  );
}
