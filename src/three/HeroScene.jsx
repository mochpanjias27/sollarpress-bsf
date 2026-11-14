import { useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrthographicCamera, RoundedBox, Html } from '@react-three/drei';
import * as THREE from 'three';
import { COL, PLASTIC_COLORS, speckleTexture, beltTexture, screenTexture, LIVE } from './materials.js';

/* =========================================================================
   Diorama isometrik: matahari → panel surya → baterai/inverter → mesin hot press
   sampah plastik → hopper → konveyor → pencacah → konveyor → press → papan
   ========================================================================= */

const DAY = 26; // detik per siklus hari

function dayState(t) {
  // jam 5..19 siang (75% siklus), sisanya malam
  const ph = (t % DAY) / DAY;
  const hour = 6 + ph * 12; // 06.00 → 18.00, selalu siang
  const elev = Math.sin(Math.max(0, Math.min(1, (hour - 6) / 12)) * Math.PI); // 0..1
  return { hour: hour >= 24 ? hour - 24 : hour, elev, ph };
}

/* ---------- Responsive camera ---------- */
function Rig({ children }) {
  const { size } = useThree();
  const group = useRef();
  const mobile = size.width < 860;
  const zoom = mobile ? Math.min(size.width / 15.5, 42) : Math.min(size.width / 31, size.height / 15.5, 54);
  // geser diorama ke kanan agar tidak menimpa teks hero (lebar platform ≈ 17 unit layar)
  const shiftPx = mobile ? 0 : Math.max(0, size.width / 2 - 24 - 8.5 * zoom);
  const shift = shiftPx / zoom / Math.SQRT2 / 0.7;
  useFrame(({ pointer, clock }) => {
    if (!group.current) return;
    const tx = pointer.x * 0.08, ty = pointer.y * 0.04;
    group.current.rotation.y += (tx + Math.sin(clock.elapsedTime * 0.15) * 0.04 - group.current.rotation.y) * 0.04;
    group.current.rotation.x += (-ty - group.current.rotation.x) * 0.04;
  });
  return (
    <>
      <OrthographicCamera makeDefault position={[20, 16.5, 20]} zoom={zoom} near={-100} far={200} onUpdate={(c) => c.lookAt(0, 0.6, 0)} />
      <group position={[shift * 0.7, mobile ? -0.4 : -0.6, -shift * 0.7]}>
        <group ref={group}>{children}</group>
      </group>
    </>
  );
}

/* ---------- Lighting & sun ---------- */
function SunAndLights() {
  const sun = useRef(), light = useRef(), amb = useRef(), glow = useRef();
  useFrame(({ clock }) => {
    const { hour, elev } = dayState(clock.elapsedTime);
    const a = Math.max(0, Math.min(1, (hour - 6) / 12)) * Math.PI;
    const x = Math.cos(a) * 8, y = 1.2 + Math.sin(a) * 5.2;
    if (sun.current) { sun.current.position.set(x, y, -6); sun.current.visible = hour > 5.6 && hour < 18.4; }
    if (light.current) { light.current.position.set(x, Math.max(3, y + 5), -1); light.current.intensity = 1.1 + elev * 1.6; light.current.color.setHSL(0.12, 0.6, 0.78 + elev * 0.17); }
    if (amb.current) amb.current.intensity = 0.9 + elev * 0.4;
    if (glow.current) glow.current.material.opacity = 0.06 + elev * 0.14;
    LIVE.hour = hour;
    LIVE.pv = elev * 70 * 0.8;
  });
  return (
    <>
      <ambientLight ref={amb} intensity={1.1} color="#ffffff" />
      <hemisphereLight args={['#ffffff', '#b9d3b4', 0.7]} />
      <directionalLight ref={light} castShadow position={[6, 12, 2]} intensity={2} shadow-mapSize={[2048, 2048]} shadow-bias={-0.0004}
        shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
      <pointLight position={[2.8, 1.2, 2.2]} color={COL.orange} intensity={1.6} distance={4} />
      <group ref={sun}>
        <mesh><sphereGeometry args={[0.55, 32, 32]} /><meshBasicMaterial color={COL.sun} toneMapped={false} /></mesh>
        <mesh ref={glow} scale={1.9}><sphereGeometry args={[0.55, 24, 24]} /><meshBasicMaterial color={COL.sun} transparent opacity={0.3} depthWrite={false} toneMapped={false} /></mesh>
      </group>
    </>
  );
}

/* ---------- Platform ---------- */
function Platform() {
  const edges = useMemo(() => [
    { p: [0, 0.01, 5], s: [14, 0.04, 0.04] }, { p: [0, 0.01, -5], s: [14, 0.04, 0.04] },
    { p: [7, 0.01, 0], s: [0.04, 0.04, 10] }, { p: [-7, 0.01, 0], s: [0.04, 0.04, 10] },
  ], []);
  return (
    <group>
      <RoundedBox args={[14, 0.7, 10]} radius={0.12} position={[0, -0.35, 0]} receiveShadow>
        <meshStandardMaterial color={COL.base} roughness={0.9} />
      </RoundedBox>
      <RoundedBox args={[14.06, 0.5, 10.06]} radius={0.12} position={[0, -0.47, 0]}>
        <meshStandardMaterial color={COL.side} roughness={0.9} />
      </RoundedBox>
      {/* jalur kerja */}
      <mesh rotation-x={-Math.PI / 2} position={[0, 0.003, 2.4]} receiveShadow>
        <planeGeometry args={[13.2, 2.6]} /><meshStandardMaterial color={COL.base2} roughness={0.9} />
      </mesh>
      {edges.map((e, i) => (
        <mesh key={i} position={e.p}><boxGeometry args={e.s} /><meshStandardMaterial color={COL.teal} /></mesh>
      ))}
      {/* air waduk di bawah platform */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.75, 0]}>
        <circleGeometry args={[13, 64]} /><meshStandardMaterial color="#cfe3cc" roughness={0.6} transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

/* ---------- Solar array ---------- */
function SolarArray() {
  const cells = useRef([]);
  const panels = useMemo(() => {
    const out = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) out.push([-5.9 + c * 1.25, 0, -4.2 + r * 1.05]);
    return out;
  }, []);
  useFrame(({ clock }) => {
    const { elev } = dayState(clock.elapsedTime);
    cells.current.forEach((m) => { if (m) m.emissiveIntensity = 0.15 + elev * 0.9; });
  });
  return (
    <group>
      {panels.map((p, i) => (
        <group key={i} position={p}>
          <mesh position={[0, 0.3, 0.15]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.6]} /><meshStandardMaterial color={COL.steel} /></mesh>
          <mesh position={[0, 0.45, -0.15]} castShadow><cylinderGeometry args={[0.03, 0.03, 0.9]} /><meshStandardMaterial color={COL.steel} /></mesh>
          <group position={[0, 0.72, 0]} rotation-x={-0.32}>
            <mesh castShadow><boxGeometry args={[1.15, 0.05, 0.85]} /><meshStandardMaterial color="#c9d3d0" metalness={0.6} roughness={0.35} /></mesh>
            <mesh position={[0, 0.03, 0]}>
              <boxGeometry args={[1.08, 0.02, 0.78]} />
              <meshStandardMaterial ref={(m) => (cells.current[i] = m)} color={COL.cell} emissive="#1d5fa8" emissiveIntensity={0.5} metalness={0.4} roughness={0.25} />
            </mesh>
            {[-0.27, 0, 0.27].map((x) => (
              <mesh key={x} position={[x, 0.045, 0]}><boxGeometry args={[0.012, 0.005, 0.78]} /><meshBasicMaterial color="#7fb6ff" transparent opacity={0.5} /></mesh>
            ))}
          </group>
        </group>
      ))}
      <Html position={[-4.1, 1.8, -3.2]} center distanceFactor={undefined} className="sr-hide-mobile">
        <div className="callout t" style={{ transform: 'translate(-50%,-100%)' }}><b>☀ Panel surya</b>70 kWp · menghadap utara</div>
      </Html>
    </group>
  );
}

/* ---------- Battery / inverter cabinets + screen ---------- */
function Cabinets() {
  const leds = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { elev } = dayState(t);
    LIVE.battery = Math.min(0.95, Math.max(0.15, 0.4 + 0.5 * Math.sin(((t % DAY) / DAY) * Math.PI * 1.2)));
    leds.current.forEach((m, i) => { if (m) m.opacity = (i / leds.current.length) < LIVE.battery ? 0.95 : 0.15; });
    void elev;
  });
  const strips = [...Array(6)];
  return (
    <group position={[0.9, 0, -3.7]}>
      {[0, 1.05].map((x, k) => (
        <group key={k} position={[x, 0, 0]}>
          <RoundedBox args={[0.9, 2.1, 0.8]} radius={0.05} position={[0, 1.05, 0]} castShadow>
            <meshStandardMaterial color={COL.white} roughness={0.45} />
          </RoundedBox>
          <mesh position={[0, 2.11, 0]}><boxGeometry args={[0.92, 0.04, 0.82]} /><meshStandardMaterial color={COL.green} /></mesh>
          {strips.map((_, i) => (
            <mesh key={i} position={[0, 0.35 + i * 0.28, 0.41]}>
              <boxGeometry args={[0.6, 0.06, 0.01]} />
              <meshBasicMaterial ref={(m) => (leds.current[k * 6 + i] = m)} color={COL.teal} transparent opacity={0.9} toneMapped={false} />
            </mesh>
          ))}
        </group>
      ))}
      {/* inverter */}
      <RoundedBox args={[0.8, 1.0, 0.35]} radius={0.04} position={[2.15, 1.3, 0.05]} castShadow>
        <meshStandardMaterial color="#ffffff" roughness={0.4} />
      </RoundedBox>
      <mesh position={[2.15, 1.45, 0.23]}><planeGeometry args={[0.4, 0.22]} /><meshBasicMaterial color={COL.teal} toneMapped={false} /></mesh>
      {/* layar dashboard */}
      <group position={[3.9, 0, 0.1]}>
        <mesh position={[0, 0.7, 0]} castShadow><boxGeometry args={[0.12, 1.4, 0.12]} /><meshStandardMaterial color={COL.metal} /></mesh>
        <RoundedBox args={[2.1, 1.45, 0.12]} radius={0.04} position={[0, 2.0, 0]} castShadow><meshStandardMaterial color="#ffffff" /></RoundedBox>
        <mesh position={[0, 2.0, 0.065]}><planeGeometry args={[1.92, 1.28]} /><meshBasicMaterial map={screenTexture()} toneMapped={false} /></mesh>
      </group>
      <Html position={[0.5, 2.5, 0]} center>
        <div className="callout t" style={{ transform: 'translate(-50%,-100%)' }}><b>🔋 Baterai 60 kWh</b>inverter hybrid 60 kW</div>
      </Html>
    </group>
  );
}

/* ---------- Energy cables with flowing orbs ---------- */
function EnergyFlow() {
  const curves = useMemo(() => ({
    pv: new THREE.CatmullRomCurve3([new THREE.Vector3(-2.6, 0.5, -3.2), new THREE.Vector3(-1.2, 0.35, -3.4), new THREE.Vector3(0.45, 0.4, -3.7)]),
    press: new THREE.CatmullRomCurve3([new THREE.Vector3(1.4, 2.2, -3.4), new THREE.Vector3(2.0, 3.6, -1.5), new THREE.Vector3(2.6, 4.1, 0.6), new THREE.Vector3(2.8, 3.5, 2.0)]),
  }), []);
  const pvOrbs = useRef([]), prOrbs = useRef([]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const { elev } = dayState(t);
    pvOrbs.current.forEach((m, i) => {
      if (!m) return;
      const u = ((t * (0.15 + elev * 0.35)) + i / 6) % 1;
      m.position.copy(curves.pv.getPointAt(u));
      m.scale.setScalar(elev > 0.05 ? 1 : 0.001);
    });
    prOrbs.current.forEach((m, i) => {
      if (!m) return;
      const u = ((t * 0.32) + i / 8) % 1;
      m.position.copy(curves.press.getPointAt(u));
    });
  });
  return (
    <group>
      {Object.values(curves).map((c, i) => (
        <mesh key={i}><tubeGeometry args={[c, 64, 0.045, 8, false]} /><meshStandardMaterial color="#7fa88a" roughness={0.5} /></mesh>
      ))}
      {[...Array(6)].map((_, i) => (
        <mesh key={'a' + i} ref={(m) => (pvOrbs.current[i] = m)}><sphereGeometry args={[0.09, 12, 12]} /><meshBasicMaterial color={COL.sun} toneMapped={false} /></mesh>
      ))}
      {[...Array(8)].map((_, i) => (
        <mesh key={'b' + i} ref={(m) => (prOrbs.current[i] = m)}><sphereGeometry args={[0.08, 12, 12]} /><meshBasicMaterial color={COL.teal} toneMapped={false} /></mesh>
      ))}
    </group>
  );
}

/* ---------- Conveyor ---------- */
function Conveyor({ from, to, z, width = 0.7 }) {
  const tex = useMemo(() => { const t = beltTexture(); t.repeat.set((to - from) * 2, 1); return t; }, [from, to]);
  useFrame((_, dt) => { tex.offset.x -= dt * 0.6; });
  const len = to - from, cx = (from + to) / 2;
  return (
    <group position={[cx, 0, z]}>
      <mesh position={[0, 0.42, 0]} castShadow receiveShadow>
        <boxGeometry args={[len, 0.08, width]} />
        <meshStandardMaterial attach="material-2" map={tex} roughness={0.8} />
        <meshStandardMaterial attach="material-0" color={COL.metal} />
        <meshStandardMaterial attach="material-1" color={COL.metal} />
        <meshStandardMaterial attach="material-3" color={COL.metal} />
        <meshStandardMaterial attach="material-4" color={COL.teal} />
        <meshStandardMaterial attach="material-5" color={COL.teal} />
      </mesh>
      {[-len / 2 + 0.15, len / 2 - 0.15].map((x) => [-width / 2 + 0.06, width / 2 - 0.06].map((zz) => (
        <mesh key={x + '_' + zz} position={[x, 0.19, zz]} castShadow><boxGeometry args={[0.08, 0.38, 0.08]} /><meshStandardMaterial color={COL.metal} /></mesh>
      )))}
    </group>
  );
}

function MovingItems({ from, to, z, count, size, y = 0.5, speed = 0.55, flakes = false }) {
  const refs = useRef([]);
  const items = useMemo(() => [...Array(count)].map((_, i) => ({
    c: PLASTIC_COLORS[i % PLASTIC_COLORS.length], o: i / count,
    dz: (Math.sin(i * 12.9898) * 0.5) * 0.4, r: i * 1.7,
    s: flakes ? [size, size * 0.35, size * 0.8] : [size, size * (0.7 + (i % 3) * 0.2), size * 0.9],
  })), [count, size, flakes]);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * speed / (to - from) + items[i].o) % 1;
      m.position.set(from + u * (to - from), y + items[i].s[1] / 2, z + items[i].dz);
      m.rotation.y = items[i].r + u * 0.6;
      const edge = Math.min(u, 1 - u);
      m.scale.setScalar(edge < 0.04 ? edge / 0.04 : 1);
    });
  });
  return items.map((it, i) => (
    <mesh key={i} ref={(m) => (refs.current[i] = m)} castShadow>
      <boxGeometry args={it.s} /><meshStandardMaterial color={it.c} roughness={0.5} />
    </mesh>
  ));
}

/* ---------- Hopper & shredder ---------- */
function Hopper() {
  const pile = useMemo(() => [...Array(26)].map((_, i) => ({
    p: [(Math.sin(i * 3.1) * 0.35), 1.05 + (i % 4) * 0.08, (Math.cos(i * 2.3) * 0.3)],
    r: [i, i * 2, i * 0.5], c: PLASTIC_COLORS[i % PLASTIC_COLORS.length],
  })), []);
  return (
    <group position={[-5.6, 0, 2.4]}>
      <mesh position={[0, 0.55, 0]} castShadow>
        <cylinderGeometry args={[0.75, 0.5, 1.1, 4, 1, true]} />
        <meshStandardMaterial color={COL.teal} side={THREE.DoubleSide} roughness={0.5} />
      </mesh>
      {pile.map((b, i) => (
        <mesh key={i} position={b.p} rotation={b.r} castShadow><boxGeometry args={[0.2, 0.12, 0.16]} /><meshStandardMaterial color={b.c} /></mesh>
      ))}
      <Html position={[0, 1.7, 0]} center>
        <div className="callout o" style={{ transform: 'translate(-50%,-100%)' }}><b>♻ Plastik low-value</b>PP · HDPE · LDPE · MLP</div>
      </Html>
    </group>
  );
}

function Shredder() {
  const rollers = useRef([]);
  useFrame((_, dt) => rollers.current.forEach((r, i) => r && (r.rotation.z += (i ? -1 : 1) * dt * 6)));
  return (
    <group position={[-1.1, 0, 2.4]}>
      <RoundedBox args={[1.3, 1.25, 1.2]} radius={0.06} position={[0, 0.62, 0]} castShadow>
        <meshStandardMaterial color={COL.white} roughness={0.45} />
      </RoundedBox>
      <mesh position={[0, 1.26, 0]}><boxGeometry args={[0.9, 0.02, 0.8]} /><meshStandardMaterial color={COL.green} /></mesh>
      {[-0.2, 0.2].map((x, i) => (
        <mesh key={x} ref={(m) => (rollers.current[i] = m)} position={[x, 1.2, 0]} rotation-x={Math.PI / 2}>
          <cylinderGeometry args={[0.15, 0.15, 0.75, 8]} /><meshStandardMaterial color={COL.steel} metalness={0.8} roughness={0.3} />
        </mesh>
      ))}
      <mesh position={[0, 0.85, 0.61]}><boxGeometry args={[0.9, 0.12, 0.01]} /><meshStandardMaterial color={COL.teal} /></mesh>
      <Html position={[0, 1.8, 0]} center>
        <div className="callout" style={{ transform: 'translate(-50%,-100%)' }}><b>Pencacah</b>serpihan 5–10 mm</div>
      </Html>
    </group>
  );
}

/* ---------- Hot press ---------- */
const PRESS_CYCLE = 9;
function HotPress() {
  const top = useRef(), heat = useRef(), board = useRef(), stack = useRef(), ring = useRef(), rod = useRef();
  const boardTex = useMemo(() => speckleTexture('#dfe7dc', 3), []);
  const stackTex = useMemo(() => speckleTexture('#d6e0d3', 7), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    const c = (t % PRESS_CYCLE) / PRESS_CYCLE;
    const cycleNo = Math.floor(t / PRESS_CYCLE);
    // 0-.15 turun, .15-.6 tekan, .6-.75 naik, .75-1 keluarkan papan
    let y;
    if (c < 0.15) y = 1.95 - (c / 0.15) * 1.05;
    else if (c < 0.6) y = 0.9;
    else if (c < 0.75) y = 0.9 + ((c - 0.6) / 0.15) * 1.05;
    else y = 1.95;
    if (top.current) top.current.position.y = y;
    if (rod.current) { rod.current.scale.y = (3.1 - y) / 1.2; rod.current.position.y = (3.1 + y) / 2 + 0.1; }
    const hot = c > 0.1 && c < 0.65 ? 1 : 0.35;
    if (heat.current) heat.current.emissiveIntensity += (hot * 1.6 - heat.current.emissiveIntensity) * 0.06;
    if (ring.current) { ring.current.rotation.z += 0.02; ring.current.material.opacity = 0.25 + 0.5 * hot; }
    LIVE.temp = 150 + 45 * (heat.current ? heat.current.emissiveIntensity / 1.6 : 0.5);
    // papan keluar
    if (board.current) {
      if (c >= 0.75) { const u = (c - 0.75) / 0.25; board.current.visible = true; board.current.position.set(2.8 + u * 2.4, 0.78 - u * 0.2 + Math.sin(u * Math.PI) * 0.15, 2.4); }
      else board.current.visible = false;
    }
    const n = (cycleNo % 9) + (c >= 0.99 ? 1 : 0);
    if (stack.current) { stack.current.scale.y = Math.max(0.001, n); stack.current.position.y = 0.32 + (n * 0.07) / 2; }
    LIVE.boards = 120 + cycleNo;
  });
  const cols = [[-0.95, -0.75], [0.95, -0.75], [-0.95, 0.75], [0.95, 0.75]];
  return (
    <group>
      <group position={[2.8, 0, 2.4]}>
        <RoundedBox args={[2.3, 0.55, 1.9]} radius={0.05} position={[0, 0.27, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={COL.white} roughness={0.45} />
        </RoundedBox>
        {/* pelat bawah berpemanas */}
        <mesh position={[0, 0.66, 0]} castShadow>
          <boxGeometry args={[2.0, 0.22, 1.6]} />
          <meshStandardMaterial ref={heat} color="#8a5a3c" emissive={COL.orange} emissiveIntensity={0.6} metalness={0.4} roughness={0.45} />
        </mesh>
        {/* cetakan + bahan */}
        <mesh position={[0, 0.8, 0]}><boxGeometry args={[1.7, 0.06, 1.3]} /><meshStandardMaterial map={boardTex} /></mesh>
        {cols.map(([x, z]) => (
          <mesh key={x + '' + z} position={[x, 1.75, z]} castShadow><cylinderGeometry args={[0.08, 0.08, 2.5, 16]} /><meshStandardMaterial color={COL.steel} metalness={0.85} roughness={0.25} /></mesh>
        ))}
        <RoundedBox args={[2.4, 0.42, 1.95]} radius={0.05} position={[0, 3.1, 0]} castShadow>
          <meshStandardMaterial color={COL.green} roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, 3.55, 0]} castShadow><cylinderGeometry args={[0.35, 0.35, 0.6, 24]} /><meshStandardMaterial color={COL.white} roughness={0.4} /></mesh>
        <mesh ref={rod} position={[0, 2.6, 0]}><cylinderGeometry args={[0.13, 0.13, 1.2, 16]} /><meshStandardMaterial color="#cfd8d5" metalness={0.9} roughness={0.15} /></mesh>
        {/* pelat atas bergerak */}
        <group ref={top} position={[0, 1.95, 0]}>
          <mesh castShadow><boxGeometry args={[2.0, 0.24, 1.6]} /><meshStandardMaterial color="#8a5a3c" emissive={COL.orange} emissiveIntensity={0.3} metalness={0.4} roughness={0.45} /></mesh>
        </group>
        <mesh ref={ring} position={[0, 0.66, 1.05]} rotation-x={0}>
          <torusGeometry args={[0.32, 0.025, 8, 48, Math.PI * 1.6]} /><meshBasicMaterial color={COL.orange} transparent opacity={0.6} toneMapped={false} />
        </mesh>
        <Html position={[1.4, 3.6, 0]} center>
          <div className="callout o" style={{ transform: 'translate(0,-50%)' }}><b>🔥 Hot press 185–200 °C</b>heater oli 30 kW · 5 cetakan</div>
        </Html>
      </group>
      {/* meja rol keluaran */}
      <group position={[4.6, 0, 2.4]}>
        {[...Array(6)].map((_, i) => (
          <mesh key={i} position={[-0.6 + i * 0.25, 0.5, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.05, 0.05, 1.3, 10]} /><meshStandardMaterial color={COL.steel} metalness={0.8} /></mesh>
        ))}
        <mesh position={[0, 0.25, 0]}><boxGeometry args={[1.5, 0.5, 0.15]} /><meshStandardMaterial color={COL.metal} /></mesh>
      </group>
      {/* papan bergerak & tumpukan */}
      <mesh ref={board} castShadow><boxGeometry args={[1.7, 0.07, 1.3]} /><meshStandardMaterial map={boardTex} /></mesh>
      <group position={[5.9, 0, 2.4]}>
        <mesh position={[0, 0.15, 0]} castShadow><boxGeometry args={[1.9, 0.3, 1.5]} /><meshStandardMaterial color="#c8a77f" roughness={0.9} /></mesh>
        <mesh ref={stack} position={[0, 0.34, 0]} castShadow><boxGeometry args={[1.7, 0.07, 1.3]} /><meshStandardMaterial map={stackTex} /></mesh>
        <Html position={[0.9, 0.6, 0.6]}>
          <div className="callout t"><b>Multi-purpose board</b>120 × 240 cm</div>
        </Html>
      </group>
    </group>
  );
}

/* ---------- Workers & trees ---------- */
function Worker({ position, rot = 0, phase = 0 }) {
  const g = useRef();
  useFrame(({ clock }) => { if (g.current) g.current.position.y = Math.abs(Math.sin(clock.elapsedTime * 2 + phase)) * 0.04; });
  return (
    <group position={position} rotation-y={rot}>
      <group ref={g}>
        <mesh position={[0, 0.42, 0]} castShadow><capsuleGeometry args={[0.16, 0.42, 6, 12]} /><meshStandardMaterial color={COL.green} /></mesh>
        <mesh position={[0, 0.88, 0]} castShadow><sphereGeometry args={[0.13, 16, 16]} /><meshStandardMaterial color="#e2b48f" /></mesh>
        <mesh position={[0, 0.94, 0]}><sphereGeometry args={[0.145, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} /><meshStandardMaterial color={COL.orange} /></mesh>
      </group>
    </group>
  );
}
function Trees() {
  const pos = [[-6.4, 4.2], [6.3, -4.2], [6.5, -2.9], [-6.5, 0.6], [5.2, -4.4]];
  return pos.map(([x, z], i) => (
    <group key={i} position={[x, 0, z]} scale={0.7 + (i % 3) * 0.15}>
      <mesh position={[0, 0.3, 0]} castShadow><cylinderGeometry args={[0.06, 0.08, 0.6]} /><meshStandardMaterial color="#5b3a22" /></mesh>
      <mesh position={[0, 0.95, 0]} castShadow><coneGeometry args={[0.45, 1.1, 7]} /><meshStandardMaterial color="#5d9e6a" flatShading /></mesh>
    </group>
  ));
}

function Sparkles() {
  const pts = useRef();
  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    const n = 120, a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = (Math.random() - 0.5) * 16; a[i * 3 + 1] = Math.random() * 7; a[i * 3 + 2] = (Math.random() - 0.5) * 12; }
    g.setAttribute('position', new THREE.BufferAttribute(a, 3));
    return g;
  }, []);
  useFrame((_, dt) => { if (pts.current) pts.current.rotation.y += dt * 0.02; });
  return <points ref={pts} geometry={geo}><pointsMaterial size={0.05} color="#ffffff" transparent opacity={0.8} /></points>;
}

function Scene() {
  return (
    <Rig>
      <SunAndLights />
      <Platform />
      <SolarArray />
      <Cabinets />
      <EnergyFlow />
      <Hopper />
      <Conveyor from={-5.0} to={-1.75} z={2.4} />
      <MovingItems from={-4.9} to={-1.85} z={2.4} count={9} size={0.22} />
      <Shredder />
      <Conveyor from={-0.45} to={1.65} z={2.4} />
      <MovingItems from={-0.4} to={1.6} z={2.4} count={16} size={0.12} flakes speed={0.45} />
      <HotPress />
      <Worker position={[-3.3, 0, 3.5]} rot={-0.6} />
      <Worker position={[1.0, 0, 3.6]} rot={0.4} phase={1.2} />
      <Worker position={[5.4, 0, 3.6]} rot={-0.2} phase={2.1} />
      <Trees />
      <Sparkles />

    </Rig>
  );
}

export default function HeroScene() {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ width: '100%', height: '100%' }}>
      <Scene />
    </Canvas>
  );
}
