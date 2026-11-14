// Digital twin termal: memprediksi suhu pelat dari daya heater & status menekan (data aktual),
// lalu membandingkannya dengan suhu terukur.
import { defaultParams, derived } from '../engine/engine.js';

const DT_S = 900;

/** series: { t:[ISO], temp:[°C], pv:[kW], pvFc:[kW|null], pln:[kW], heater:[kW], soc:[0..1|null], press:[0/1], tamb:[°C|null] } */
export function runTwin(series, params = {}, resyncEvery = 4) {
  const p = { ...defaultParams(), ...params };
  const D = derived(p);
  const n = series.t.length;
  const open = new Array(n), oneStep = new Array(n), resid = new Array(n);
  let th = series.temp[0];
  let pressRun = 0;
  for (let k = 0; k < n; k++) {
    open[k] = th;
    const tamb = series.tamb?.[k] ?? 27;
    // indeks slot tekan untuk beban leleh
    if (series.press[k]) pressRun++; else pressRun = 0;
    const idx = series.press[k] ? Math.min(pressRun - 1, D.qPress.length - 1) : -1;
    const q = idx >= 0 ? D.qPress[idx] : 0;
    const f = (x) => x + DT_S / D.C * 1000 * (p.etaH * (series.heater[k] || 0) - p.UA / 1000 * (x - tamb) - q);
    // prediksi satu langkah ke depan dari suhu terukur
    if (k + 1 < n) oneStep[k + 1] = f(series.temp[k]);
    // twin berjalan bebas, diasimilasi ke pengukuran setiap `resyncEvery` slot (1 jam)
    th = resyncEvery && (k + 1) % resyncEvery === 0 ? f(series.temp[k]) : f(th);
  }
  oneStep[0] = series.temp[0];
  for (let k = 0; k < n; k++) resid[k] = series.temp[k] - oneStep[k];
  const valid = resid.slice(1);
  const rmse = Math.sqrt(valid.reduce((a, r) => a + r * r, 0) / Math.max(1, valid.length));
  // σ robust (MAD) agar gangguan tidak ikut membesarkan ambang
  const absr = valid.map(Math.abs).sort((a, b) => a - b);
  const mad = absr.length ? absr[Math.floor(absr.length / 2)] : 1;
  const sigma = Math.max(0.8, 1.4826 * mad);
  const anomalies = [];
  for (let k = 1; k < n; k++) {
    if (Math.abs(resid[k]) > 3 * sigma) anomalies.push({ k, type: 'residual', msg: `Suhu menyimpang ${resid[k].toFixed(1)} °C dari prediksi twin (>3σ)` });
    if (series.press[k] && (series.temp[k] < p.thMin - 1.5 || series.temp[k] > p.thMaxPress + 1.5)) // toleransi sensor ±1,5 °C
      anomalies.push({ k, type: 'quality', msg: `Suhu tekan ${series.temp[k].toFixed(0)} °C di luar jendela ${p.thMin}–${p.thMaxPress} °C` });
  }
  // galat prakiraan PV (MAPE pada jam siang)
  let mapeN = 0, mapeS = 0;
  for (let k = 0; k < n; k++) {
    const f = series.pvFc?.[k], a = series.pv[k];
    if (f != null && a > 2) { mapeS += Math.abs(f - a) / a; mapeN++; }
  }
  const openRmse = Math.sqrt(series.temp.reduce((a, x, k) => a + (x - open[k]) ** 2, 0) / Math.max(1, n));
  return { open, oneStep, resid, rmse, sigma, openRmse, anomalies, mape: mapeN ? (100 * mapeS) / mapeN : null };
}

export function energyStats(series, upto = series.t.length) {
  const h = 0.25;
  let pv = 0, pln = 0, load = 0, heater = 0, batches = 0;
  for (let k = 0; k < upto; k++) {
    pv += (series.pv[k] || 0) * h; pln += (series.pln[k] || 0) * h; heater += (series.heater[k] || 0) * h;
    load += ((series.load?.[k]) ?? ((series.heater[k] || 0) + 0)) * h;
    if (series.press[k] && (k === 0 || !series.press[k - 1])) batches++;
  }
  return { pv, pln, load, heater, batches, solarShare: load > 0 ? Math.max(0, 1 - pln / load) : 1 };
}
