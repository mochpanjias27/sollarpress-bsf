import * as THREE from 'three';

// Palet diorama: gelap–teal (ref. 2) dengan aksen oranye (ref. 1)
// Palet terang (siang hari): putih–sage dengan aksen hijau tua; oranye hanya untuk panas
export const COL = {
  base: '#f7f9f5',     // permukaan platform
  base2: '#e6eee3',    // jalur kerja
  side: '#d6e3d2',     // sisi platform
  dark: '#f2f4f0',     // bodi mesin (putih susu)
  body2: '#e4e9e3',
  metal: '#b8c4bc',
  steel: '#9aa8a0',
  teal: '#2e7d46',     // aksen hijau
  green: '#1f5c33',    // hijau tua
  orange: '#ef7a35',
  sun: '#ffc23d',
  white: '#ffffff',
  cell: '#13335c',
  blue: '#3f7fd0',
};

export const PLASTIC_COLORS = ['#ffffff', '#2e7d46', '#ef7a35', '#2b2f2d', '#ffc23d', '#3f7fd0', '#d9534f', '#8bc49a'];

// Tekstur papan daur ulang: bintik multi-warna (khas recycled plastic board)
const texCache = {};
export function speckleTexture(base = '#dfe7dc', seed = 1, size = 256) {
  const key = base + seed + size;
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  g.fillStyle = base; g.fillRect(0, 0, size, size);
  let s = seed * 9301 + 49297;
  const rnd = () => ((s = (s * 9301 + 49297) % 233280) / 233280);
  for (let i = 0; i < size * 6; i++) {
    g.fillStyle = PLASTIC_COLORS[Math.floor(rnd() * PLASTIC_COLORS.length)];
    g.globalAlpha = 0.55 + rnd() * 0.45;
    const w = 1 + rnd() * 5, h = 1 + rnd() * 3;
    g.save(); g.translate(rnd() * size, rnd() * size); g.rotate(rnd() * Math.PI); g.fillRect(-w / 2, -h / 2, w, h); g.restore();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache[key] = t;
  return t;
}

// Tekstur sabuk konveyor bergaris (offset dianimasikan)
export function beltTexture() {
  if (texCache.belt) return texCache.belt.clone();
  const c = document.createElement('canvas');
  c.width = 64; c.height = 16;
  const g = c.getContext('2d');
  g.fillStyle = '#3a423e'; g.fillRect(0, 0, 64, 16);
  g.fillStyle = '#59635e';
  for (let x = 0; x < 64; x += 8) g.fillRect(x, 0, 3, 16);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  texCache.belt = t;
  return t.clone();
}

// Tekstur layar dashboard
export function screenTexture() {
  if (texCache.screen) return texCache.screen;
  const c = document.createElement('canvas');
  c.width = 256; c.height = 192;
  const g = c.getContext('2d');
  g.fillStyle = '#0d2416'; g.fillRect(0, 0, 256, 192);
  g.strokeStyle = 'rgba(46,125,70,.25)'; g.lineWidth = 1;
  for (let y = 30; y < 180; y += 30) { g.beginPath(); g.moveTo(14, y); g.lineTo(242, y); g.stroke(); }
  // kurva PV (lonceng)
  g.strokeStyle = '#ffc23d'; g.lineWidth = 4; g.beginPath();
  for (let x = 0; x <= 228; x++) { const v = Math.max(0, Math.sin((x / 228) * Math.PI)); const y = 170 - v * 120; x ? g.lineTo(14 + x, y) : g.moveTo(14 + x, y); }
  g.stroke();
  // batang beban
  g.fillStyle = '#5fbf7a';
  [40, 62, 84, 106, 128, 150, 172].forEach((x, i) => g.fillRect(x, 170 - (50 + (i % 3) * 18), 12, 50 + (i % 3) * 18));
  g.fillStyle = '#e9efec'; g.font = 'bold 18px sans-serif'; g.fillText('PV ⚡ 52 kW', 14, 22);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  texCache.screen = t;
  return t;
}

// Status animasi bersama (dibaca HUD di DOM)
export const LIVE = { pv: 0, temp: 27, boards: 0, hour: 6, battery: 0.62 };
