import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, PerspectiveCamera, Html } from '@react-three/drei';
import * as THREE from 'three';
import { speckleTexture, COL } from './materials.js';

/* Animasi: satu lembar papan 120 × 240 cm → dipotong → dirakit menjadi produk.
   Satuan scene = meter. Tebal papan divisualkan 0,03 m. */

const T = 0.03;
const BOARD = { w: 2.4, d: 1.2 };

// Setiap komponen: ukuran [lebar, tinggi, tebal] saat terpasang + posisi rakitan.
export const PRODUCTS = {
  meja: {
    name: 'Meja belajar + bangku',
    parts: [
      { s: [1.2, T, 0.6], p: [0, 0.73, 0] },              // daun meja
      { s: [T, 0.7, 0.52], p: [-0.55, 0.35, 0] },         // kaki panel kiri
      { s: [T, 0.7, 0.52], p: [0.55, 0.35, 0] },          // kaki panel kanan
      { s: [1.0, 0.28, T], p: [0, 0.54, -0.2] },          // panel belakang
      { s: [0.38, T, 0.34], p: [0.95, 0.43, 0.25] },      // dudukan bangku
      { s: [T, 0.42, 0.3], p: [0.78, 0.21, 0.25] },       // kaki bangku
      { s: [T, 0.42, 0.3], p: [1.12, 0.21, 0.25] },
    ],
  },
  rak: {
    name: 'Rak / lemari',
    parts: [
      { s: [T, 0.95, 0.32], p: [-0.345, 0.475, 0] },
      { s: [T, 0.95, 0.32], p: [0.345, 0.475, 0] },
      { s: [0.66, 0.95, T], p: [0, 0.475, -0.145] },      // panel belakang
      { s: [0.66, T, 0.32], p: [0, 0.015, 0] },
      { s: [0.66, T, 0.32], p: [0, 0.32, 0] },
      { s: [0.66, T, 0.32], p: [0, 0.63, 0] },
      { s: [0.72, T, 0.34], p: [0, 0.965, 0] },           // atas
    ],
  },
  sampah: {
    name: 'Tempat sampah',
    parts: [
      { s: [0.5, 0.75, T], p: [0, 0.375, 0.235] },
      { s: [0.5, 0.75, T], p: [0, 0.375, -0.235] },
      { s: [T, 0.75, 0.44], p: [-0.235, 0.375, 0] },
      { s: [T, 0.75, 0.44], p: [0.235, 0.375, 0] },
      { s: [0.44, T, 0.44], p: [0, 0.06, 0] },
      { s: [0.56, T, 0.56], p: [0, 0.78, 0] },          // tutup
    ],
  },
};

// Tata letak potongan di atas lembar papan: pencarian bottom-left pada grid 1 cm,
// potongan boleh diputar 90° di bidang papan.
export function layoutFlat(parts) {
  const gap = 0.03, step = 0.01;
  const base = parts.map((pt, i) => { const d = [...pt.s].sort((a, b) => b - a); return { i, L: d[0], W: d[1] }; });
  const orders = [
    (a, b) => b.L * b.W - a.L * a.W, (a, b) => b.L - a.L, (a, b) => b.W - a.W, (a, b) => b.L + b.W - a.L - a.W,
  ];
  let fallback = null;
  for (const ord of orders) for (const zFirst of [true, false]) {
    const items = [...base].sort(ord), placed = [], out = [];
    let ok = true;
    const free = (x, z, w, h) => x + w <= BOARD.w - gap / 2 + 1e-9 && z + h <= BOARD.d - gap / 2 + 1e-9 &&
      placed.every((r) => x + w + gap <= r.x || r.x + r.w + gap <= x || z + h + gap <= r.z || r.z + r.h + gap <= z);
    for (const it of items) {
      let best = null;
      for (const rot of [false, true]) {
        const w = rot ? it.W : it.L, h = rot ? it.L : it.W;
        const A = zFirst ? BOARD.d - h : BOARD.w - w, B = zFirst ? BOARD.w - w : BOARD.d - h;
        for (let a = gap / 2; a <= A && !best; a += step)
          for (let b = gap / 2; b <= B; b += step) {
            const x = zFirst ? b : a, z = zFirst ? a : b;
            if (free(x, z, w, h)) { best = { x, z, w, h, rot }; break; }
          }
        if (best) break;
      }
      if (!best) { ok = false; best = { x: BOARD.w + 0.1, z: 0, w: it.L, h: it.W, rot: false }; }
      placed.push(best);
      out[it.i] = { x: best.x + best.w / 2 - BOARD.w / 2, z: best.z + best.h / 2 - BOARD.d / 2, L: best.w, W: best.h, rot: best.rot };
    }
    if (ok) return out;
    fallback = fallback || out;
  }
  return fallback;
}

// Rotasi agar balok berukuran L×T×W (rebah) menjadi ukuran rakitan s
function flatToAssembled(s) {
  // geometri dibuat dengan ukuran rakitan s; cari rotasi supaya dimensi terkecil menghadap atas saat rebah
  const minAxis = s.indexOf(Math.min(...s));
  const maxAxis = s.indexOf(Math.max(...s));
  const e = new THREE.Euler();
  if (minAxis === 0) e.set(0, 0, Math.PI / 2);          // tebal di x → putar ke y
  else if (minAxis === 2) e.set(Math.PI / 2, 0, 0);     // tebal di z → putar ke y
  // sejajarkan sisi terpanjang dengan sumbu x papan
  const q = new THREE.Quaternion().setFromEuler(e);
  const longDir = new THREE.Vector3(maxAxis === 0 ? 1 : 0, maxAxis === 1 ? 1 : 0, maxAxis === 2 ? 1 : 0).applyQuaternion(q);
  if (Math.abs(longDir.z) > 0.9) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
  return q;
}

const ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

function Assembly({ product }) {
  const P = PRODUCTS[product];
  const tex = useMemo(() => speckleTexture('#cfd9cc', 21, 160), []);
  const flat = useMemo(() => layoutFlat(P.parts), [P]);
  const qFlat = useMemo(() => P.parts.map((pt, i) => {
    const q = flatToAssembled(pt.s);
    if (flat[i].rot) q.premultiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2));
    return q;
  }), [P, flat]);
  const refs = useRef([]);
  const board = useRef();
  const lines = useRef();
  const t0 = useRef(null);
  const label = useRef();
  const qId = useMemo(() => new THREE.Quaternion(), []);
  const tmpQ = useMemo(() => new THREE.Quaternion(), []);
  const CYCLE = 9;
  useFrame(({ clock }) => {
    if (t0.current == null) t0.current = clock.elapsedTime;
    const c = ((clock.elapsedTime - t0.current) % CYCLE) / CYCLE;
    // 0–.15 papan utuh, .15–.28 garis potong, .28–.4 potongan terpisah, .4–.75 dirakit, .75–1 tahan
    const sep = Math.min(1, Math.max(0, (c - 0.28) / 0.12));
    const asm = ease(Math.min(1, Math.max(0, (c - 0.4) / 0.35)));
    if (board.current) board.current.visible = c < 0.28;
    if (lines.current) lines.current.visible = c >= 0.15 && c < 0.28;
    if (label.current) label.current.style.opacity = c > 0.72 ? 1 : 0;
    refs.current.forEach((m, i) => {
      if (!m) return;
      m.visible = c >= 0.28;
      const f = flat[i], pt = P.parts[i];
      const fx = f.x * (1 + 0.1 * sep), fz = f.z * (1 + 0.2 * sep), fy = T / 2;
      const lift = Math.sin(asm * Math.PI) * 0.5;
      m.position.set(
        THREE.MathUtils.lerp(fx, pt.p[0], asm),
        THREE.MathUtils.lerp(fy, pt.p[1], asm) + lift,
        THREE.MathUtils.lerp(fz, pt.p[2], asm),
      );
      tmpQ.copy(qFlat[i]).slerp(qId, asm);
      m.quaternion.copy(tmpQ);
    });
  });
  const cutGeo = useMemo(() => {
    const pts = [];
    flat.forEach((f) => {
      const x0 = f.x - f.L / 2, x1 = f.x + f.L / 2, z0 = f.z - f.W / 2, z1 = f.z + f.W / 2, y = T + 0.002;
      pts.push(x0, y, z0, x1, y, z0, x1, y, z0, x1, y, z1, x1, y, z1, x0, y, z1, x0, y, z1, x0, y, z0);
    });
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g;
  }, [flat]);
  return (
    <group key={product}>
      <mesh ref={board} position={[0, T / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[BOARD.w, T, BOARD.d]} />
        <meshStandardMaterial map={tex} roughness={0.7} />
      </mesh>
      <lineSegments ref={lines} geometry={cutGeo}><lineBasicMaterial color={COL.green} linewidth={2} /></lineSegments>
      {P.parts.map((pt, i) => (
        <mesh key={i} ref={(m) => (refs.current[i] = m)} castShadow>
          <boxGeometry args={pt.s} />
          <meshStandardMaterial map={tex} roughness={0.7} />
        </mesh>
      ))}
      <Html position={[0, 1.35, 0]} center>
        <div ref={label} className="callout t" style={{ transform: 'translate(-50%,-50%)', transition: 'opacity .4s', opacity: 0 }}>
          <b>{P.name}</b>dari 1 lembar papan 120 × 240 cm
        </div>
      </Html>
    </group>
  );
}

export default function BoardAssembler({ product = 'meja' }) {
  return (
    <Canvas shadows dpr={[1, 2]} gl={{ antialias: true, alpha: true }} style={{ position: 'absolute', inset: 0 }}>
      <PerspectiveCamera makeDefault position={[2.4, 2.1, 2.9]} fov={40} />
      <ambientLight intensity={1.0} />
      <hemisphereLight args={['#ffffff', '#b9d3b4', 0.6]} />
      <directionalLight position={[3, 6, 3]} intensity={1.6} castShadow shadow-mapSize={[1024, 1024]} color="#fff6e5" />
      <Assembly product={product} />
      <ContactShadows position={[0, 0, 0]} opacity={0.3} scale={6} blur={2.4} far={2} color="#1f5c33" />
      <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.5} minPolarAngle={0.4} maxPolarAngle={1.35} target={[0, 0.45, 0]} />
    </Canvas>
  );
}
