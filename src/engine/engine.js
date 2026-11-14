// ===== SolarPress ENGINE (ESM): solar forecast -> PV, thermal model, DP scheduler, baseline =====
// Pure JS, no DOM. Used in Web Worker and node tests.

const DT_H = 0.25;            // slot length (hour)
const DT_S = 900;             // slot length (s)
const SPD = 96;               // slots per day

function defaultParams() {
  return {
    lat: -6.9183, lon: 107.4739, tz: 7,
    // PV
    kwp: 70, pr: 0.80, gammaT: -0.0035, noct: 45, invMax: 60,
    // Battery
    batCap: 60, socMin: 0.10, socMax: 0.95, batP: 30, etaC: 0.96, etaD: 0.96, soc0: 0.5, batDeg: 500,
    // Grid
    price: 1444.70, wbp: false, wbpMult: 1.5, wbpStart: 17, wbpEnd: 22, ef: 0.87, carbonPrice: 0,
    // Heater & thermal
    heaterP: 30, etaH: 0.95, mSteel: 2500, cSteel: 0.49, mOil: 150, cOil: 2.2, UA: 22, theta0: 27,
    thMin: 185, thMaxPress: 200, thMaxAbs: 210,
    // Batch
    molds: 5, kgPerMold: 30, cPlast: 2.0, latent: 150, tMelt: 190,
    pressSlots: 3, changeSlots: 1, loadFrac: [0.5, 0.3, 0.2],
    auxPress: 2.0, baseLoad: 6.0,
    // Operations
    target: 6, workStart: 7, workEnd: 17, heatStart: 4, heatEnd: 18, heatOffDays: false,
    workDays: [1, 2, 3, 4, 5, 6], // 0=Sun
    penalty: 3000000,
    // Robustness
    gamma: 0.0,
    // DP grids
    thLo: 20, thHi: 212, thStep: 3, socSteps: 10,
  };
}

// ---------- Solar geometry & synthetic forecast ----------
function solarCosZ(lat, lon, tz, doy, hourLocal) {
  const d2r = Math.PI / 180;
  const B = 2 * Math.PI * (doy - 81) / 364;
  const eot = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B); // min
  const decl = 23.45 * Math.sin(2 * Math.PI * (284 + doy) / 365) * d2r;
  const solarTime = hourLocal + (4 * (lon - 15 * tz) + eot) / 60;
  const ha = (solarTime - 12) * 15 * d2r;
  const c = Math.sin(lat * d2r) * Math.sin(decl) + Math.cos(lat * d2r) * Math.cos(decl) * Math.cos(ha);
  return Math.max(0, c);
}
function dayOfYear(d) {
  const s = Date.UTC(d.getUTCFullYear(), 0, 0);
  return Math.floor((d - s) / 86400000);
}
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// Returns hourly arrays like Open-Meteo: time (local ISO), gti, temp, cloud
function syntheticForecast(p, startDateStr, days, seed = 11) {
  const rnd = mulberry32(seed);
  const out = { time: [], gti: [], temp: [], cloud: [], source: 'synthetic' };
  const start = new Date(startDateStr + 'T00:00:00Z');
  for (let d = 0; d < days; d++) {
    const date = new Date(start.getTime() + d * 86400000);
    const doy = dayOfYear(date);
    // rainy-season pattern: morning clouds base, afternoon convective build-up
    const r0 = rnd();
    const type = r0 < 0.3 ? 0 : r0 < 0.75 ? 1 : 2; // 0 cerah, 1 berawan, 2 mendung/hujan
    const base = [10, 30, 70][type] + 20 * rnd();   // morning cloud %
    const build = [20, 45, 30][type] + 25 * rnd();  // afternoon increase
    const peakH = 12 + 3 * rnd();
    for (let h = 0; h < 24; h++) {
      const ts = date.toISOString().slice(0, 10) + 'T' + String(h).padStart(2, '0') + ':00';
      // Open-Meteo hourly radiation = mean over preceding hour -> evaluate mid of [h-1,h]
      const cz = solarCosZ(p.lat, p.lon, p.tz, doy, h - 0.5);
      const ghiClear = cz > 0 ? 1098 * cz * Math.exp(-0.057 / Math.max(cz, 0.02)) : 0;
      let cl = base + build / (1 + Math.exp(-(h - peakH) * 1.2)) + 12 * (rnd() - 0.5);
      cl = Math.min(100, Math.max(0, cl));
      const kt = 1 - 0.75 * Math.pow(cl / 100, 3.4);
      out.time.push(ts);
      out.gti.push(Math.round(ghiClear * kt));
      out.cloud.push(Math.round(cl));
      out.temp.push(+(22 + 7 * Math.max(0, Math.sin((h - 7) / 14 * Math.PI)) - 2 * cl / 100).toFixed(1));
    }
  }
  return out;
}

// Parse Open-Meteo JSON (hourly)
function parseOpenMeteo(js) {
  const h = js.hourly;
  if (!h || !h.time) throw new Error('JSON tidak memiliki bagian "hourly.time"');
  const g = h.global_tilted_irradiance || h.shortwave_radiation;
  if (!g) throw new Error('Butuh variabel global_tilted_irradiance atau shortwave_radiation');
  return {
    time: h.time.slice(), gti: g.map(v => v ?? 0),
    temp: (h.temperature_2m || g.map(() => 27)).map(v => v ?? 27),
    cloud: (h.cloud_cover || g.map(() => NaN)).map(v => v ?? NaN),
    source: 'open-meteo'
  };
}

// hourly -> 15-min slots from a given start date (local, 'YYYY-MM-DD'), for `days`
function toSlots(p, fc, startDateStr, days) {
  const idx0 = fc.time.findIndex(t => t.startsWith(startDateStr));
  if (idx0 < 0) throw new Error('Tanggal mulai tidak ada di data prakiraan');
  const n = days * SPD;
  const gti = new Float64Array(n), temp = new Float64Array(n), cloud = new Float64Array(n), pv = new Float64Array(n), sigma = new Float64Array(n);
  const H = fc.time.length;
  const val = (arr, i) => arr[Math.min(H - 1, Math.max(0, i))];
  for (let s = 0; s < n; s++) {
    const hourFloat = s / 4;                // slot start in hours from start
    const hi = idx0 + Math.floor(hourFloat) + 1; // value at hour h = mean of (h-1,h]
    // linear blend between adjacent hourly means for smoothness
    const frac = (hourFloat % 1) + 0.125;
    const a = val(fc.gti, hi), b = val(fc.gti, hi + 1), a0 = val(fc.gti, hi - 1);
    let g = frac < 0.5 ? a0 * (0.5 - frac) + a * (0.5 + frac) : a * (1.5 - frac) + b * (frac - 0.5);
    // keep zero at night
    if (a === 0) g = 0;
    gti[s] = Math.max(0, g);
    temp[s] = val(fc.temp, hi);
    const c = val(fc.cloud, hi);
    cloud[s] = isNaN(c) ? 50 : c;
  }
  for (let s = 0; s < n; s++) {
    const tcell = temp[s] + gti[s] * (p.noct - 20) / 800;
    let P = p.kwp * (gti[s] / 1000) * p.pr * (1 + p.gammaT * (tcell - 25));
    P = Math.min(Math.max(0, P), p.invMax);
    pv[s] = P;
    sigma[s] = P * (0.08 + 0.35 * cloud[s] / 100); // forecast uncertainty (kW)
  }
  return { gti, temp, cloud, pv, sigma, n, startDateStr, days };
}

// ---------- Shared physics ----------
function tgtDay(p, d, S) {
  if (p.targets) return p.targets[d] || 0;
  return slotInfo(p, d * SPD, S.startDateStr).work ? p.target : 0;
}
function tmax(p) { return p.targets ? Math.max(0, ...p.targets) : p.target; }
function derived(p) {
  const C = (p.mSteel * p.cSteel + p.mOil * p.cOil) * 1000; // J/K
  const mB = p.molds * p.kgPerMold;
  const eBatch = mB * (p.cPlast * (p.tMelt - 27) + p.latent) * 1000; // J
  const NPH = p.pressSlots + p.changeSlots;
  const frac = p.loadFrac.slice(0, p.pressSlots);
  const fs = frac.reduce((a, b) => a + b, 0);
  const qPress = frac.map(f => f / fs * eBatch / DT_S / 1000); // kW thermal per press slot
  return { C, mB, eBatch, NPH, qPress };
}

function slotInfo(p, s, startDateStr) {
  const day = Math.floor(s / SPD), q = s % SPD, hour = q / 4;
  const date = new Date(new Date(startDateStr + 'T00:00:00Z').getTime() + day * 86400000);
  const dow = date.getUTCDay();
  const work = p.workDays.includes(dow);
  let price = p.price;
  if (p.wbp && hour >= p.wbpStart && hour < p.wbpEnd) price *= p.wbpMult;
  return {
    day, q, hour, dow, work, price,
    inWork: work && hour >= p.workStart && hour < p.workEnd,
    canStart: work && hour >= p.workStart && hour + p.pressSlots / 4 <= p.workEnd + 1e-9,
    heatOk: hour >= p.heatStart && hour < p.heatEnd && (work || p.heatOffDays),
    lastOfDay: q === SPD - 1,
    tgt: p.targets ? (p.targets[day] || 0) : (work ? p.target : 0),
  };
}

// one-slot transition. Returns null if infeasible.
function step(p, D, info, pvUse, tamb, th, soc, u, pressIdx) {
  // pressIdx: -1 none, else 0..pressSlots-1 (which press slot occurs this slot)
  const Ph = u * p.heaterP;
  const q = pressIdx >= 0 ? D.qPress[pressIdx] : 0;
  const th2 = th + DT_S / D.C * 1000 * (p.etaH * Ph - p.UA / 1000 * (th - tamb) - q);
  if (th2 > p.thMaxAbs + 1e-6) return null;
  if (pressIdx >= 0) {
    if (th < p.thMin - 1e-6 || th > p.thMaxPress + 1e-6) return null;
    if (th2 < p.thMin - 1e-6 || th2 > p.thMaxPress + 1e-6) return null;
  }
  const aux = (info.inWork ? p.baseLoad : 0) + (pressIdx >= 0 ? p.auxPress : 0);
  const load = Ph + aux;
  const net = load - pvUse;
  let grid = 0, curt = 0, ch = 0, dis = 0, soc2 = soc;
  if (net > 0) {
    const avail = Math.max(0, (soc - p.socMin) * p.batCap * p.etaD / DT_H);
    dis = Math.min(net, p.batP, avail);
    grid = net - dis;
    soc2 = soc - dis * DT_H / p.etaD / p.batCap;
  } else {
    const room = Math.max(0, (p.socMax - soc) * p.batCap / p.etaC / DT_H);
    ch = Math.min(-net, p.batP, room);
    curt = -net - ch;
    soc2 = soc + ch * DT_H * p.etaC / p.batCap;
  }
  const gkwh = grid * DT_H;
  const cost = gkwh * info.price + gkwh * p.ef * p.carbonPrice + (dis + ch) * DT_H * (p.batDeg || 0) * 0.5;
  return { th2, soc2, grid, curt, ch, dis, Ph, aux, load, cost, gkwh };
}

// ---------- DP ----------
function buildGrid(p) {
  const NT = Math.floor((p.thHi - p.thLo) / p.thStep) + 1;
  const NS = p.socSteps + 1;
  return { NT, NS };
}

// bilinear interpolation of V for fixed (k,phase) block
function interp(V, off, NT, NS, p, th, soc) {
  let x = (th - p.thLo) / p.thStep; if (x < 0) x = 0; if (x > NT - 1) x = NT - 1;
  let y = (soc - p.socMin) / (p.socMax - p.socMin) * (NS - 1); if (y < 0) y = 0; if (y > NS - 1) y = NS - 1;
  let i = Math.floor(x); if (i >= NT - 1) i = NT - 2; const fx = x - i;
  let j = Math.floor(y); if (j >= NS - 1) j = NS - 2; const fy = y - j;
  const b = off + i * NS + j;
  const v00 = V[b], v01 = V[b + 1], v10 = V[b + NS], v11 = V[b + NS + 1];
  return (v00 * (1 - fx) + v10 * fx) * (1 - fy) + (v01 * (1 - fx) + v11 * fx) * fy;
}

const UACT = [0, 0.25, 0.5, 0.75, 1];

// enumerate candidate actions from discrete state (k,ph) at slot info
function actions(p, D, info, k, ph) {
  // returns list of {u, start, pressIdx, k2, ph2, done}
  const res = [];
  const us = info.heatOk ? UACT : [0];
  let modes = [];
  if (ph === 0) {
    modes.push({ start: 0, pressIdx: -1, k2: k, ph2: 0 });
    if (info.canStart && k < info.tgt) {
      const ph2 = 1 >= D.NPH ? 0 : 1;
      const k2 = p.pressSlots === 1 ? k + 1 : k;
      modes.push({ start: 1, pressIdx: 0, k2, ph2 });
    }
  } else {
    // continuing batch: ph = number of slots already done (1..NPH-1)
    const pressIdx = ph < p.pressSlots ? ph : -1;
    const k2 = (ph === p.pressSlots - 1) ? k + 1 : k;
    const ph2 = ph + 1 >= D.NPH ? 0 : ph + 1;
    modes.push({ start: 0, pressIdx, k2, ph2 });
  }
  for (const m of modes) for (const u of (m.pressIdx >= 0 ? (info.heatOk ? UACT : UACT) : us)) res.push({ u, ...m });
  return res;
}

function terminalBlock(p, D, G) {
  // value at horizon end: credit for stored battery energy
  const TM = tmax(p);
  const size = (TM + 1) * D.NPH * G.NT * G.NS;
  const V = new Float64Array(size);
  for (let k = 0; k <= TM; k++) for (let ph = 0; ph < D.NPH; ph++) for (let i = 0; i < G.NT; i++) for (let j = 0; j < G.NS; j++) {
    const soc = p.socMin + (p.socMax - p.socMin) * j / (G.NS - 1);
    V[((k * D.NPH + ph) * G.NT + i) * G.NS + j] = -(soc - p.socMin) * p.batCap * p.etaD * p.price * 0.8 + (ph ? 1e12 : 0);
  }
  return V;
}

// Map next-slot value block when crossing midnight: V_next(th,soc,k,ph) := Vstart(th,soc,0,0) + penalty
function dayBoundaryBlock(p, D, G, Vstart, tgtPrev) {
  const TM = tmax(p);
  const size = (TM + 1) * D.NPH * G.NT * G.NS;
  const V = new Float64Array(size);
  const blk = G.NT * G.NS;
  for (let k = 0; k <= TM; k++) for (let ph = 0; ph < D.NPH; ph++) {
    const off = (k * D.NPH + ph) * blk;
    const pen = ph ? 1e12 : Math.max(0, tgtPrev - k) * p.penalty;
    for (let x = 0; x < blk; x++) V[off + x] = Vstart[x] + pen; // Vstart block at k=0,ph=0 is offset 0
  }
  return V;
}

// Backward DP over slots [s0, s1) given V at s1 (Vend). Optionally store all V.
function backward(p, D, G, S, s0, s1, Vend, store) {
  const blk = G.NT * G.NS, size = (tmax(p) + 1) * D.NPH * blk;
  let Vnext = Vend;
  const all = store ? new Array(s1 - s0 + 1) : null;
  if (store) all[s1 - s0] = Vend;
  for (let s = s1 - 1; s >= s0; s--) {
    const info = slotInfo(p, s, S.startDateStr);
    let Vn = Vnext;
    if (info.lastOfDay && s + 1 < S.n && s + 1 === s1 && false) { /* handled by caller */ }
    const pvUse = Math.max(0, S.pv[s] - p.gamma * S.sigma[s]);
    const tamb = S.temp[s];
    const V = new Float64Array(size);
    const kMax = p.noPrune ? tmax(p) : ((!info.work || info.hour < p.workStart) ? 0 : info.tgt);
    const phOk = p.noPrune || info.work && info.hour >= p.workStart && info.hour < p.workEnd + D.NPH / 4 + 0.01;
    V.fill(1e12);
    for (let k = 0; k <= kMax; k++) for (let ph = 0; ph < (phOk ? D.NPH : 1); ph++) {
      const acts = actions(p, D, info, k, ph);
      const off = (k * D.NPH + ph) * blk;
      for (let i = 0; i < G.NT; i++) {
        const th = p.thLo + i * p.thStep;
        for (let j = 0; j < G.NS; j++) {
          const soc = p.socMin + (p.socMax - p.socMin) * j / (G.NS - 1);
          let best = 1e15;
          for (let a = 0; a < acts.length; a++) {
            const A = acts[a];
            const r = step(p, D, info, pvUse, tamb, th, soc, A.u, A.pressIdx);
            if (!r) continue;
            const v = r.cost + interp(Vn, (A.k2 * D.NPH + A.ph2) * blk, G.NT, G.NS, p, r.th2, r.soc2);
            if (v < best) best = v;
          }
          V[off + i * G.NS + j] = best;
        }
      }
    }
    Vnext = V;
    if (store) all[s - s0] = V;
  }
  return store ? all : Vnext;
}

function optimize(p, S, onProgress) {
  const D = derived(p), G = buildGrid(p);
  const days = S.days;
  // Pass 1: backward across days storing day-start blocks (k=0,ph=0 slice only needed)
  const dayStartFull = new Array(days + 1);
  let Vend = terminalBlock(p, D, G);
  dayStartFull[days] = Vend;
  const blk = G.NT * G.NS;
  for (let d = days - 1; d >= 0; d--) {
    const s0 = d * SPD, s1 = (d + 1) * SPD;
    let Vb;
    if (d === days - 1) Vb = Vend;
    else {
      Vb = dayBoundaryBlock(p, D, G, dayStartFull[d + 1].subarray(0, blk), slotInfo(p, s1 - 1, S.startDateStr).tgt);
    }
    if (d === days - 1) {
      // penalty for last day target shortfall too
      const tg = slotInfo(p, s1 - 1, S.startDateStr).tgt;
      const V2 = new Float64Array(Vb.length);
      for (let k = 0; k <= tmax(p); k++) for (let ph = 0; ph < D.NPH; ph++) {
        const off = (k * D.NPH + ph) * blk;
        const pen = ph ? 1e12 : Math.max(0, tg - k) * p.penalty;
        for (let x = 0; x < blk; x++) V2[off + x] = Vb[off + x] + pen;
      }
      Vb = V2;
    }
    dayStartFull[d] = backward(p, D, G, S, s0, s1, Vb, false);
    dayStartFull[d]._end = Vb;
    if (onProgress) onProgress(0.5 * (days - d) / days);
  }
  // Pass 2: forward day by day, recompute stored V for the day, simulate with lookahead
  let th = p.theta0, soc = p.soc0, k = 0, ph = 0;
  const trace = [];
  const batches = [];
  for (let d = 0; d < days; d++) {
    const s0 = d * SPD, s1 = (d + 1) * SPD;
    const Vall = backward(p, D, G, S, s0, s1, dayStartFull[d]._end, true);
    k = 0; ph = 0;
    for (let s = s0; s < s1; s++) {
      const info = slotInfo(p, s, S.startDateStr);
      const pvUse = Math.max(0, S.pv[s] - p.gamma * S.sigma[s]);
      const Vn = Vall[s - s0 + 1];
      const acts = actions(p, D, info, k, ph);
      let best = null, bestV = 1e15, bestA = null;
      for (const A of acts) {
        const r = step(p, D, info, pvUse, S.temp[s], th, soc, A.u, A.pressIdx);
        if (!r) continue;
        // prefer starting batches earlier on ties & lower heater on ties
        const v = r.cost + interp(Vn, (A.k2 * D.NPH + A.ph2) * blk, G.NT, G.NS, p, r.th2, r.soc2) + A.u * 1e-3 - A.start * 1e-2;
        if (v < bestV) { bestV = v; best = r; bestA = A; }
      }
      if (!best) { // fallback: heater off (should not happen)
        bestA = { u: 0, start: 0, pressIdx: -1, k2: k, ph2: 0 };
        best = step(p, D, info, pvUse, S.temp[s], th, soc, 0, -1) || { th2: th, soc2: soc, grid: 0, curt: 0, ch: 0, dis: 0, Ph: 0, aux: 0, load: 0, cost: 0, gkwh: 0 };
      }
      // re-evaluate with ACTUAL (nominal) PV to report realistic flows
      const real = step(p, D, info, S.pv[s], S.temp[s], th, soc, bestA.u, bestA.pressIdx) || best;
      if (bestA.start) batches.push({ s, day: d, k: k + 1 });
      trace.push({ s, th, soc, u: bestA.u, press: bestA.pressIdx, pv: S.pv[s], ...pick(real) });
      th = real.th2; soc = real.soc2; k = bestA.k2; ph = bestA.ph2;
    }
    if (onProgress) onProgress(0.5 + 0.5 * (d + 1) / days);
  }
  return summarize(p, S, trace, batches, 'optimal');
}
function pick(r) { return { grid: r.grid, curt: r.curt, ch: r.ch, dis: r.dis, Ph: r.Ph, aux: r.aux, load: r.load, cost: r.cost, gkwh: r.gkwh, th2: r.th2 }; }

// ---------- Baseline: conventional operation ----------
function baseline(p, S) {
  const D = derived(p);
  let th = p.theta0, soc = p.soc0, k = 0, ph = 0;
  const trace = [], batches = [];
  for (let s = 0; s < S.n; s++) {
    const info = slotInfo(p, s, S.startDateStr);
    if (info.q === 0) { k = 0; ph = 0; }
    let start = 0, pressIdx = -1, u = 0;
    const needHeat = info.work && info.hour >= p.workStart && k < info.tgt;
    if (ph === 0 && info.canStart && k < info.tgt && th >= 190 && th <= p.thMaxPress) { start = 1; pressIdx = 0; }
    else if (ph > 0 && ph < p.pressSlots) pressIdx = ph;
    // thermostat: target 195 while producing
    const producing = needHeat || ph > 0;
    if (producing) {
      // choose largest u that keeps th2 <= 198 (simple thermostat)
      for (let ui = UACT.length - 1; ui >= 0; ui--) {
        const r = step(p, D, info, S.pv[s], S.temp[s], th, soc, UACT[ui], -1);
        const thTest = r ? r.th2 - (pressIdx >= 0 ? DT_S / D.C * 1000 * D.qPress[pressIdx] : 0) : 999;
        if (thTest <= 198) { u = UACT[ui]; break; }
      }
    }
    let r = step(p, D, info, S.pv[s], S.temp[s], th, soc, u, pressIdx);
    if (!r) { // press quality violated -> record anyway with relaxed check
      const q = pressIdx >= 0 ? D.qPress[pressIdx] : 0;
      const pp = Object.assign({}, p, { thMin: -999, thMaxPress: 999 });
      r = step(pp, D, info, S.pv[s], S.temp[s], th, soc, u, pressIdx);
      r.violation = true;
    }
    if (start) { batches.push({ s, day: info.day, k: k + 1 }); }
    trace.push({ s, th, soc, u, press: pressIdx, pv: S.pv[s], ...pick(r), violation: !!r.violation });
    th = r.th2; soc = r.soc2;
    if (start) { ph = D.NPH > 1 ? 1 : 0; if (p.pressSlots === 1) k++; }
    else if (ph > 0) { if (ph === p.pressSlots - 1) k++; ph = ph + 1 >= D.NPH ? 0 : ph + 1; }
  }
  return summarize(p, S, trace, batches, 'baseline');
}

function summarize(p, S, trace, batches, name) {
  const days = S.days;
  const perDay = [];
  for (let d = 0; d < days; d++) {
    const t = trace.slice(d * SPD, (d + 1) * SPD);
    const sum = f => t.reduce((a, x) => a + f(x), 0);
    const pvE = sum(x => x.pv) * DT_H, loadE = sum(x => x.load) * DT_H, gridE = sum(x => x.grid) * DT_H, curtE = sum(x => x.curt) * DT_H;
    const heatE = sum(x => x.Ph) * DT_H;
    perDay.push({
      d, pvE, loadE, gridE, curtE, heatE,
      cost: sum(x => x.gkwh * slotInfo(p, x.s, S.startDateStr).price),
      co2: gridE * p.ef,
      batches: batches.filter(b => b.day === d).length,
      solarShare: loadE > 0 ? 1 - gridE / loadE : 1,
      violations: t.filter(x => x.violation).length,
    });
  }
  const tot = k => perDay.reduce((a, x) => a + x[k], 0);
  return {
    name, trace, batches, perDay,
    total: { pvE: tot('pvE'), loadE: tot('loadE'), gridE: tot('gridE'), curtE: tot('curtE'), cost: tot('cost'), co2: tot('co2'), batches: tot('batches'), heatE: tot('heatE'), violations: tot('violations') }
  };
}

// ---------- Upper level: allocate weekly total across days ----------
function sliceDays(S, d0, nd) {
  const a = d0 * SPD, b = (d0 + nd) * SPD;
  const date = new Date(new Date(S.startDateStr + 'T00:00:00Z').getTime() + d0 * 86400000).toISOString().slice(0, 10);
  return { gti: S.gti.subarray(a, b), temp: S.temp.subarray(a, b), cloud: S.cloud.subarray(a, b), pv: S.pv.subarray(a, b), sigma: S.sigma.subarray(a, b), n: b - a, startDateStr: date, days: nd };
}
function dailyCostCurve(p, S, d, nMax) {
  // One backward DP with target T=nMax; starting at k = T-n  <=>  n batches remaining.
  const Sd = sliceDays(S, d, 1);
  const pc = Object.assign({}, p, { socSteps: 6, targets: null, target: nMax, noPrune: true, workDays: [0, 1, 2, 3, 4, 5, 6] });
  const D = derived(pc), G = buildGrid(pc), blk = G.NT * G.NS;
  const Vt = terminalBlock(pc, D, G);
  const Vb = new Float64Array(Vt.length);
  for (let k = 0; k <= nMax; k++) for (let ph = 0; ph < D.NPH; ph++) {
    const off = (k * D.NPH + ph) * blk, pen = ph ? 1e12 : (nMax - k) * p.penalty;
    for (let x = 0; x < blk; x++) Vb[off + x] = Vt[off + x] + pen;
  }
  const V0 = backward(pc, D, G, Sd, 0, SPD, Vb, false);
  const out = [];
  const base = interp(V0, (nMax * D.NPH) * blk, G.NT, G.NS, pc, p.theta0, p.soc0); // n=0
  for (let n = 0; n <= nMax; n++) out.push(interp(V0, ((nMax - n) * D.NPH) * blk, G.NT, G.NS, pc, p.theta0, p.soc0) - base);
  return out;
}
function allocate(p, S, total, maxPerDay, onProgress) {
  const days = S.days, curves = [];
  for (let d = 0; d < days; d++) {
    const work = slotInfo(p, d * SPD, S.startDateStr).work;
    curves.push(work ? dailyCostCurve(p, S, d, maxPerDay) : [0]);
    if (onProgress) onProgress((d + 1) / days);
  }
  // DP over days: F[d][m] min cost using days < d to produce m batches
  const INF = 1e18;
  let F = new Array(total + 1).fill(INF); F[0] = 0;
  const choice = [];
  for (let d = 0; d < days; d++) {
    const G2 = new Array(total + 1).fill(INF), ch = new Array(total + 1).fill(0);
    for (let m = 0; m <= total; m++) if (F[m] < INF) for (let n = 0; n < curves[d].length && m + n <= total; n++) {
      const v = F[m] + curves[d][n];
      if (v < G2[m + n]) { G2[m + n] = v; ch[m + n] = n; }
    }
    choice.push(ch); F = G2;
  }
  let m = total; const alloc = new Array(days).fill(0);
  if (F[total] >= INF) { // infeasible: fill greedily
    let best = 0; for (let x = 0; x <= total; x++) if (F[x] < INF) best = x; m = best;
  }
  for (let d = days - 1; d >= 0; d--) { alloc[d] = choice[d][m]; m -= alloc[d]; }
  return { alloc, curves };
}
function optimizeCore(p, S, onProgress) { return optimize(p, S, onProgress); }


// ---------- Replay: jalankan ulang aksi (u, press) pada "mesin nyata" dengan parameter berbeda ----------
// Dipakai untuk membangkitkan data telemetri sintetis yang realistis (digital twin demo).
function replay(p, S, actions, pvActual, track = null, s0 = 0) {
  // track: suhu rencana per slot → pengendali umpan balik (termostat) mengoreksi daya heater
  const D = derived(p);
  const pr = Object.assign({}, p, { thMin: -1e9, thMaxPress: 1e9, thMaxAbs: 1e9 });
  let th = p.theta0, soc = p.soc0;
  const out = [];
  for (let s = 0; s < actions.length; s++) {
    const info = slotInfo(p, s + s0, S.startDateStr);
    const a = actions[s];
    let u = a.u;
    if (track && (a.u > 0 || a.press >= 0)) {
      // target = suhu rencana di awal slot; koreksi proporsional lembut di atas umpan maju (u rencana)
      const err = track[s] - th;
      u = Math.min(1, Math.max(0, a.u + 0.04 * err));
    }
    const r = step(pr, D, info, pvActual[s], S.temp[s + s0], th, soc, u, a.press);
    out.push({ s: s + s0, th, th2: r.th2, soc, pv: pvActual[s], grid: r.grid, load: r.load, Ph: r.Ph, dis: r.dis, curt: r.curt, press: a.press, tamb: S.temp[s + s0] });
    th = r.th2; soc = r.soc2;
  }
  return out;
}

export { replay, allocate, sliceDays, defaultParams, syntheticForecast, parseOpenMeteo, toSlots, optimize, baseline, derived, slotInfo, SPD, DT_H };
