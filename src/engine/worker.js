// Web Worker: menjalankan optimisasi DP di luar thread UI.
import { toSlots, allocate, optimize, baseline } from './engine.js';

self.onmessage = (e) => {
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
