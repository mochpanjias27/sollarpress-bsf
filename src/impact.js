// Penghitung dampak: estimasi kumulatif sejak tanggal mulai operasi berdasarkan rencana produksi.
// Ganti IMPACT_CONFIG dengan data lapangan (atau hubungkan ke log produksi / /api/telemetry).

export const IMPACT_CONFIG = {
  isDemo: true,                   // tampilkan label "estimasi" sampai data produksi nyata tersedia
  since: '2026-11-01',            // tanggal mulai operasi dengan PLTS (asumsi)
  workDays: [1, 2, 3, 4, 5, 6],   // Senin–Sabtu
  batchesPerDay: 6, boardsPerBatch: 5, kgPerBoard: 30,
  prodStart: 9, prodEnd: 15,      // jam produksi (batch berjalan)
  conversion: 0.8,                // kg papan / kg sampah masuk (Supian dkk., 2025)
  kwhPerBatch: 50, solarShare: 0.92, ef: 0.87,
  lcaAvoided: 3.0 - 1.2,          // kg CO2e/kg papan: plastik baru vs daur ulang (Supian dkk., 2025)
  lcaStockpile: 0.5,              // kg CO2e/kg sampah tidak ditimbun (Supian dkk., 2025)
  price: 10_000, rawCost: 500,    // Rp/kg (Supian dkk., 2025)
  workers: 8,
  gramPerSachet: 2,               // asumsi massa rata-rata sachet/kemasan fleksibel
  treeKgPerYear: 22,              // asumsi serapan CO2 satu pohon dewasa per tahun
  carKgPerKm: 0.12,               // asumsi emisi mobil penumpang per km
};

const DAY = 86400000;

// jumlah batch selesai sejak `since` sampai waktu `now` (WIB)
export function batchesUntil(cfg, nowMs = Date.now()) {
  const start = Date.parse(cfg.since + 'T00:00:00+07:00');
  if (nowMs <= start) return 0;
  const nowJ = new Date(nowMs + 7 * 3600e3);
  const todayStartJ = Date.UTC(nowJ.getUTCFullYear(), nowJ.getUTCMonth(), nowJ.getUTCDate()) - 7 * 3600e3;
  let full = 0;
  for (let t = start; t < todayStartJ; t += DAY) {
    const dow = new Date(t + 7 * 3600e3).getUTCDay();
    if (cfg.workDays.includes(dow)) full++;
  }
  let partial = 0;
  if (cfg.workDays.includes(nowJ.getUTCDay())) {
    const h = nowJ.getUTCHours() + nowJ.getUTCMinutes() / 60 + nowJ.getUTCSeconds() / 3600;
    partial = Math.max(0, Math.min(1, (h - cfg.prodStart) / (cfg.prodEnd - cfg.prodStart)));
  }
  return (full + partial) * cfg.batchesPerDay;
}

export function impactFrom(cfg, batches) {
  const boards = batches * cfg.boardsPerBatch;
  const kgBoard = boards * cfg.kgPerBoard;
  const kgWaste = kgBoard / cfg.conversion;
  const kwhSolar = batches * cfg.kwhPerBatch * cfg.solarShare;
  const co2 = kwhSolar * cfg.ef + kgBoard * cfg.lcaAvoided + kgWaste * cfg.lcaStockpile; // kg CO2e
  return {
    batches, boards, kgBoard, kgWaste, kwhSolar, co2,
    sachets: (kgWaste * 1000) / cfg.gramPerSachet,
    value: kgBoard * cfg.price - kgWaste * cfg.rawCost,
    trees: co2 / cfg.treeKgPerYear,
    carKm: co2 / cfg.carKgPerKm,
  };
}

export function liveState(cfg, nowMs = Date.now()) {
  const nowJ = new Date(nowMs + 7 * 3600e3);
  const h = nowJ.getUTCHours() + nowJ.getUTCMinutes() / 60;
  const producing = cfg.workDays.includes(nowJ.getUTCDay()) && h >= cfg.prodStart && h < cfg.prodEnd;
  return { producing, hour: h };
}

// produksi per bulan untuk grafik
export function monthly(cfg, nowMs = Date.now()) {
  const out = [];
  let y = +cfg.since.slice(0, 4), m = +cfg.since.slice(5, 7) - 1;
  const nowJ = new Date(nowMs + 7 * 3600e3);
  while (y < nowJ.getUTCFullYear() || (y === nowJ.getUTCFullYear() && m <= nowJ.getUTCMonth())) {
    const a = Math.max(Date.parse(cfg.since + 'T00:00:00+07:00'), Date.UTC(y, m, 1) - 7 * 3600e3);
    const b = Math.min(nowMs, Date.UTC(y, m + 1, 1) - 7 * 3600e3);
    out.push({ label: `${['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'][m]} ${String(y).slice(2)}`, batches: batchesUntil(cfg, b) - batchesUntil(cfg, a) });
    m++; if (m > 11) { m = 0; y++; }
  }
  return out;
}
