// Web Worker: menjalankan optimisasi DP & pembangkitan telemetri di luar thread UI.
import { toSlots, allocate, optimize, baseline, replay } from './engine.js';

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function gauss(r) { let u = 0, v = 0; while (u === 0) u = r(); while (v === 0) v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }

// Telemetri sintetis: jadwal optimal dijalankan pada "mesin nyata" yang parameternya sedikit berbeda dari model,
// PV aktual berfluktuasi di sekitar prakiraan, ditambah derau sensor dan (opsional) satu gangguan.
function telemetry({ p, fc, start, fault, seed = 7 }) {
  const S = toSlots(p, fc, start, 1);
  // perencana memakai margin 1,5–2 °C di dalam jendela kualitas agar ada ruang bagi derau & ketidakcocokan model
  const O = optimize({ ...p, thMin: p.thMin + 2, thMaxPress: p.thMaxPress - 1.5 }, S);
  const r = mulberry32(seed);
  const pvAct = new Array(S.n); let e = 0;
  for (let k = 0; k < S.n; k++) {
    e = 0.85 * e + 0.15 * gauss(r);
    const cloud = S.cloud[k] / 100;
    const dip = r() < 0.03 * cloud ? 0.5 : 1;
    pvAct[k] = Math.max(0, Math.min(p.invMax, S.pv[k] * (1 + (0.1 + 0.25 * cloud) * e) * dip));
  }
  const pReal = { ...p, UA: p.UA * 1.06, mSteel: p.mSteel * 0.98, etaH: p.etaH * 0.99 };
  const actions = O.trace.map((x) => ({ u: x.u, press: x.press }));
  // suhu rencana di awal tiap slot (referensi termostat)
  const plan = O.trace.map((x) => x.th);
  let R;
  if (fault) {
    // gangguan: insulasi/pintu panel terbuka 12.30–13.30 → rugi panas 4× (tidak diketahui twin)
    const F0 = 50, F1 = 54;
    const a = replay(pReal, S, actions.slice(0, F0), pvAct.slice(0, F0), plan.slice(0, F0), 0);
    const la = a[a.length - 1];
    const b = replay({ ...pReal, UA: pReal.UA * 4, theta0: la.th2, soc0: la.soc }, S, actions.slice(F0, F1), pvAct.slice(F0, F1), plan.slice(F0, F1), F0);
    const lb = b[b.length - 1];
    const c = replay({ ...pReal, theta0: lb.th2, soc0: lb.soc }, S, actions.slice(F1), pvAct.slice(F1), plan.slice(F1), F1);
    R = [...a, ...b, ...c];
  } else {
    R = replay(pReal, S, actions, pvAct, plan, 0);
  }
  const t = [...Array(S.n)].map((_, k) => `${start}T${String(Math.floor(k / 4)).padStart(2, '0')}:${String((k % 4) * 15).padStart(2, '0')}`);
  return {
    t,
    temp: R.map((x) => +(x.th + gauss(r) * 0.5).toFixed(2)),
    heater: R.map((x) => +x.Ph.toFixed(2)),
    pv: pvAct.map((x) => +x.toFixed(2)),
    pvFc: Array.from(S.pv).map((x) => +x.toFixed(2)),
    pln: R.map((x) => +x.grid.toFixed(2)),
    load: R.map((x) => +x.load.toFixed(2)),
    soc: R.map((x) => +x.soc.toFixed(3)),
    press: R.map((x) => (x.press >= 0 ? 1 : 0)),
    tamb: R.map((x) => x.tamb),
    planTemp: O.trace.map((x) => x.th),
  };
}

self.onmessage = (e) => {
  if (e.data && e.data.kind === 'telemetry') {
    try { self.postMessage({ done: true, series: telemetry(e.data) }); }
    catch (err) { self.postMessage({ error: String((err && err.message) || err) }); }
    return;
  }
  const { p, fc, start, days, mode, total, maxPerDay } = e.data;
  try {
    const S = toSlots(p, fc, start, days);
    const pp = { ...p };
    let alloc = null, curves = null;
    if (mode === 'weekly') {
      const A = allocate(p, S, total, maxPerDay, (f) =>
        self.postMessage({ prog: 0.45 * f, txt: 'Tingkat atas: mengalokasikan batch per hari sesuai cuaca…' }));
      alloc = A.alloc; curves = A.curves; pp.targets = alloc;
    }
    const off = mode === 'weekly' ? 0.45 : 0;
    const O = optimize(pp, S, (f) =>
      self.postMessage({ prog: off + (1 - off) * f, txt: 'Tingkat bawah: menyusun jadwal per 15 menit (dynamic programming)…' }));
    const B = baseline(p, S);
    self.postMessage({
      done: true, O, B, alloc, curves,
      S: { pv: Array.from(S.pv), sigma: Array.from(S.sigma), temp: Array.from(S.temp), cloud: Array.from(S.cloud), gti: Array.from(S.gti), n: S.n, startDateStr: S.startDateStr, days: S.days },
    });
  } catch (err) {
    self.postMessage({ error: String((err && err.message) || err) });
  }
};
