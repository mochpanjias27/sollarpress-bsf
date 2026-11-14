// Model tekno-ekonomi & risiko unit produksi multi-purpose board bertenaga surya.
// Semua nilai Rupiah nominal; arus kas tahunan, diskonto akhir tahun.

export const ECON_DEFAULTS = {
  // Investasi (Rp)
  capexPV: 1_500_000_000,       // PLTS: PV + baterai + inverter (data lokasi)
  capexPress: 450_000_000,      // hot press + cold press (asumsi)
  capexPre: 200_000_000,        // pencacah, pencuci, pengering (asumsi)
  capexBuild: 100_000_000,      // bangunan & instalasi (asumsi)
  // Produksi
  batchPerDay: 6, molds: 5, kgPerBoard: 30, daysPerYear: 300, utilization: 0.8, conversion: 0.8,
  // Harga & biaya
  price: 10_000,                // Rp/kg papan (Supian dkk., 2025)
  priceGrowth: 0.03,
  rawCost: 500,                 // Rp/kg sampah plastik (Supian dkk., 2025)
  auxCost: 300,                 // Rp/kg papan: aditif, oli cetakan, Teflon (asumsi)
  workers: 8, wage: 3_800_000, wageMonths: 13, wageGrowth: 0.05,
  maintPct: 0.02,               // pemeliharaan mesin, % capex mesin/thn
  pvOmPct: 0.01,                // O&M PLTS, % capex PLTS/thn
  // Energi
  kwhPerBatch: 50,              // termasuk pemanasan awal & beban fasilitas (dari model Scheduler)
  solarShare: 0.92,             // porsi kebutuhan listrik dari PLTS (hasil optimisasi)
  tariff: 1444.70, tariffGrowth: 0.03,
  pvDegr: 0.005,
  batteryReplaceYear: 10, batteryReplaceCost: 300_000_000,
  // Finansial
  discount: 0.10, years: 20, tax: 0,
  // Emisi
  ef: 0.87,                     // kg CO2/kWh jaringan
  lcaRecycle: 1.2, lcaVirgin: 3.0, lcaStockpile: 0.5, // kg CO2e/kg (Supian dkk., 2025)
};

export function npv(rate, cfs) { return cfs.reduce((a, c, t) => a + c / Math.pow(1 + rate, t), 0); }
export function irr(cfs) {
  let lo = -0.99, hi = 5;
  const f = (r) => npv(r, cfs);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; (f(lo) * f(m) <= 0) ? (hi = m) : (lo = m); }
  return (lo + hi) / 2;
}
function payback(cfs, rate = 0) {
  let cum = 0;
  for (let t = 0; t < cfs.length; t++) {
    const c = cfs[t] / Math.pow(1 + rate, t);
    if (cum < 0 && cum + c >= 0) return t - 1 + (-cum / c);
    cum += c;
  }
  return null;
}

/** Hitung satu skenario. withPV=false → seluruh listrik dari PLN, tanpa capex/O&M PLTS. */
export function evaluate(inp, withPV = true) {
  const e = { ...ECON_DEFAULTS, ...inp };
  const capexMach = e.capexPress + e.capexPre;
  const capex = capexMach + e.capexBuild + (withPV ? e.capexPV : 0);
  const kgYear = e.batchPerDay * e.molds * e.kgPerBoard * e.daysPerYear * e.utilization;
  const kwhYear = e.batchPerDay * e.kwhPerBatch * e.daysPerYear * e.utilization;
  const rows = [];
  const cfs = [-capex];
  let pvRev = 0, pvCost = capex, solarKwhPV = 0, pvCapexPV = withPV ? e.capexPV : 0;
  for (let y = 1; y <= e.years; y++) {
    const g = (r) => Math.pow(1 + r, y - 1);
    const rev = kgYear * e.price * g(e.priceGrowth);
    const raw = (kgYear / e.conversion) * e.rawCost * g(0.03);
    const aux = kgYear * e.auxCost * g(0.03);
    const labor = e.workers * e.wage * e.wageMonths * g(e.wageGrowth);
    const maint = capexMach * e.maintPct * g(0.03);
    const share = withPV ? e.solarShare * Math.pow(1 - e.pvDegr, y - 1) : 0;
    const gridKwh = kwhYear * (1 - share);
    const elec = gridKwh * e.tariff * g(e.tariffGrowth);
    const pvOm = withPV ? e.capexPV * e.pvOmPct * g(0.03) : 0;
    const batt = withPV && y === e.batteryReplaceYear ? e.batteryReplaceCost : 0;
    const opex = raw + aux + labor + maint + elec + pvOm + batt;
    const ebit = rev - opex;
    const taxv = Math.max(0, ebit) * e.tax;
    const net = ebit - taxv;
    cfs.push(net);
    const df = Math.pow(1 + e.discount, y);
    pvRev += rev / df; pvCost += (opex + taxv) / df;
    if (withPV) { solarKwhPV += (kwhYear * share) / df; pvCapexPV += (pvOm + batt) / df; }
    rows.push({ y, rev, raw, aux, labor, maint, elec, pvOm, batt, opex, net, gridKwh, solarKwh: kwhYear * share, kg: kgYear });
  }
  let cum = 0; const cumDisc = cfs.map((c, t) => (cum += c / Math.pow(1 + e.discount, t)));
  const co2Grid = rows.reduce((a, r) => a + r.solarKwh * e.ef, 0) / 1000;        // t CO2, listrik surya menggantikan PLN
  const co2Mat = (kgYear * e.years * (e.lcaVirgin - e.lcaRecycle)) / 1000;         // t CO2e, papan daur ulang vs plastik baru
  const co2Stock = ((kgYear / e.conversion) * e.years * e.lcaStockpile) / 1000;  // t CO2e, timbunan dihindari
  return {
    e, capex, kgYear, kwhYear, rows, cfs, cumDisc,
    npv: npv(e.discount, cfs), irr: irr(cfs), payback: payback(cfs), dpayback: payback(cfs, e.discount),
    bcr: pvRev / pvCost,
    lcoe: withPV && solarKwhPV > 0 ? pvCapexPV / solarKwhPV : null,
    co2: { grid: co2Grid, material: co2Mat, stockpile: co2Stock },
  };
}

/** Inkremental PLTS: arus kas (dengan PLTS) − (tanpa PLTS). */
export function incrementalPV(inp) {
  const a = evaluate(inp, true), b = evaluate(inp, false);
  const cfs = a.cfs.map((c, t) => c - b.cfs[t]);
  const e = a.e;
  return { cfs, npv: npv(e.discount, cfs), irr: irr(cfs), payback: payback(cfs), savingsY1: b.rows[0].elec - a.rows[0].elec - a.rows[0].pvOm };
}

/* ---------- Monte Carlo ---------- */
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function tri(r, a, m, b) { const u = r(), F = (m - a) / (b - a); return u < F ? a + Math.sqrt(u * (b - a) * (m - a)) : b - Math.sqrt((1 - u) * (b - a) * (b - m)); }

export const RISK_FACTORS = [
  { k: 'price', label: 'Harga jual papan', lo: 0.75, hi: 1.2, unit: 'Rp/kg' },
  { k: 'utilization', label: 'Utilisasi / serapan pasar', lo: 0.7, hi: 1.15, unit: '' },
  { k: 'rawCost', label: 'Harga bahan sampah', lo: 0.6, hi: 1.8, unit: 'Rp/kg' },
  { k: 'kwhPerBatch', label: 'Konsumsi listrik/batch', lo: 0.85, hi: 1.3, unit: 'kWh' },
  { k: 'solarShare', label: 'Porsi energi surya', lo: 0.87, hi: 1.05, unit: '' },
  { k: 'wage', label: 'Upah tenaga kerja', lo: 0.95, hi: 1.15, unit: 'Rp' },
];

export function monteCarlo(inp, N = 4000, seed = 2026) {
  const r = mulberry32(seed);
  const base = { ...ECON_DEFAULTS, ...inp };
  const out = new Float64Array(N), irrs = [];
  for (let i = 0; i < N; i++) {
    const s = { ...base };
    for (const f of RISK_FACTORS) s[f.k] = base[f.k] * tri(r, f.lo, 1, f.hi);
    s.solarShare = Math.min(0.99, s.solarShare);
    s.utilization = Math.min(1, s.utilization);
    s.tariffGrowth = r() * 0.06;
    s.priceGrowth = base.priceGrowth + (r() - 0.5) * 0.04;
    const ev = evaluate(s, true);
    out[i] = ev.npv; if (ev.irr != null) irrs.push(ev.irr);
  }
  const sorted = Array.from(out).sort((a, b) => a - b);
  const q = (p) => sorted[Math.min(N - 1, Math.max(0, Math.floor(p * N)))];
  const a = 0.05, k = Math.max(1, Math.floor(a * N));
  const cvar = sorted.slice(0, k).reduce((s, v) => s + v, 0) / k;
  irrs.sort((x, y) => x - y);
  return {
    sorted, mean: sorted.reduce((s, v) => s + v, 0) / N, p5: q(0.05), p50: q(0.5), p95: q(0.95),
    var5: q(0.05), cvar5: cvar, probLoss: sorted.filter((v) => v < 0).length / N,
    irrP50: irrs.length ? irrs[Math.floor(irrs.length / 2)] : null, N,
  };
}

export function tornado(inp, swing = 0.2) {
  const base = evaluate(inp, true).npv;
  const keys = [
    ['price', 'Harga jual papan'], ['utilization', 'Utilisasi / serapan pasar'], ['rawCost', 'Harga bahan sampah'],
    ['wage', 'Upah tenaga kerja'], ['kwhPerBatch', 'Konsumsi listrik/batch'], ['tariff', 'Tarif PLN'],
    ['solarShare', 'Porsi energi surya'], ['capexPV', 'Investasi PLTS'], ['capexPress', 'Investasi mesin press'], ['discount', 'Tingkat diskonto'],
  ];
  const e0 = { ...ECON_DEFAULTS, ...inp };
  return keys.map(([k, label]) => {
    const lo = evaluate({ ...inp, [k]: Math.min(k === 'solarShare' || k === 'utilization' ? 1 : Infinity, e0[k] * (1 - swing)) }, true).npv - base;
    const hi = evaluate({ ...inp, [k]: Math.min(k === 'solarShare' || k === 'utilization' ? 1 : Infinity, e0[k] * (1 + swing)) }, true).npv - base;
    return { k, label, lo, hi, range: Math.abs(hi - lo) };
  }).sort((a, b) => b.range - a.range);
}
