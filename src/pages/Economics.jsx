import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ChartCanvas from '../components/ChartCanvas.jsx';
import { ECON_DEFAULTS, evaluate, incrementalPV, monteCarlo, tornado } from '../econ/model.js';

const fmt = (v, d = 0) => (v ?? 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const M = (v, d = 2) => `Rp${fmt(v / 1e9, d)} M`;
const JT = (v) => `Rp${fmt(v / 1e6, 0)} jt`;
const tooltipBase = { backgroundColor: '#111', padding: 10, cornerRadius: 8, titleFont: { weight: '700' }, boxPadding: 4 };

const GROUPS = [
  { t: 'Investasi', f: [
    ['capexPV', 'PLTS (PV + baterai + inverter)', 'Rp', 1e7, 'data lokasi'], ['capexPress', 'Mesin hot & cold press', 'Rp', 1e7, 'asumsi'],
    ['capexPre', 'Pencacah, pencuci, pengering', 'Rp', 1e7, 'asumsi'], ['capexBuild', 'Bangunan & instalasi', 'Rp', 1e7, 'asumsi'],
  ] },
  { t: 'Produksi', f: [
    ['batchPerDay', 'Batch per hari', '', 1], ['molds', 'Papan per batch', '', 1], ['kgPerBoard', 'Massa per papan (kg)', 'kg', 0.5],
    ['daysPerYear', 'Hari kerja per tahun', 'hari', 1], ['utilization', 'Utilisasi & serapan pasar', '0–1', 0.01], ['conversion', 'Efisiensi konversi bahan', '0–1', 0.01, 'Supian dkk.: 80%'],
  ] },
  { t: 'Harga & biaya operasional', f: [
    ['price', 'Harga jual papan (Rp/kg)', 'Rp', 100, 'Supian dkk.: Rp10.000'], ['priceGrowth', 'Kenaikan harga/tahun', '0–1', 0.005],
    ['rawCost', 'Harga sampah plastik (Rp/kg)', 'Rp', 50, 'Supian dkk.: Rp500'], ['auxCost', 'Bahan penolong (Rp/kg papan)', 'Rp', 50],
    ['workers', 'Jumlah tenaga kerja', 'orang', 1], ['wage', 'Upah per bulan', 'Rp', 100000], ['maintPct', 'Pemeliharaan mesin (%/thn)', '0–1', 0.005],
  ] },
  { t: 'Energi', f: [
    ['kwhPerBatch', 'Listrik per batch (kWh)', 'kWh', 1, 'termasuk pemanasan awal'], ['solarShare', 'Porsi energi surya', '0–1', 0.01, 'hasil Scheduler ±0,92'],
    ['tariff', 'Tarif PLN (Rp/kWh)', 'Rp', 0.1], ['tariffGrowth', 'Kenaikan tarif/tahun', '0–1', 0.005], ['pvOmPct', 'O&M PLTS (%/thn)', '0–1', 0.005],
    ['batteryReplaceYear', 'Ganti baterai tahun ke-', 'thn', 1], ['batteryReplaceCost', 'Biaya ganti baterai', 'Rp', 1e7],
  ] },
  { t: 'Finansial', f: [['discount', 'Tingkat diskonto', '0–1', 0.005], ['years', 'Umur proyek (tahun)', 'thn', 1], ['tax', 'Pajak penghasilan', '0–1', 0.01]] },
];

export default function Economics() {
  const [inp, setInp] = useState(() => { try { return { ...ECON_DEFAULTS, ...JSON.parse(localStorage.getItem('solarpress.econ') || '{}') }; } catch { return { ...ECON_DEFAULTS }; } });
  useEffect(() => { try { localStorage.setItem('solarpress.econ', JSON.stringify(inp)); } catch { /* abaikan */ } }, [inp]);
  const set = (k, v) => setInp((s) => ({ ...s, [k]: v }));

  const A = useMemo(() => evaluate(inp, true), [inp]);
  const B = useMemo(() => evaluate(inp, false), [inp]);
  const INC = useMemo(() => incrementalPV(inp), [inp]);
  const TOR = useMemo(() => tornado(inp), [inp]);
  const [mc, setMc] = useState(null);
  useEffect(() => { const id = setTimeout(() => setMc(monteCarlo(inp, 4000)), 250); return () => clearTimeout(id); }, [inp]);

  // nilai PLTS terhadap jumlah batch per hari (memanfaatkan surplus PV)
  const pvCurve = useMemo(() => [4, 5, 6, 7, 8, 9, 10].map((b) => {
    const share = Math.min(0.97, inp.solarShare * (b <= 6 ? 1 : 1 - (b - 6) * 0.04));
    return { b, npv: incrementalPV({ ...inp, batchPerDay: b, solarShare: share }).npv };
  }), [inp]);

  const years = A.rows.map((r) => `Th ${r.y}`);
  const cfCfg = useMemo(() => ({
    type: 'bar',
    data: { labels: ['Th 0', ...years], datasets: [
      { type: 'line', label: 'Kumulatif terdiskonto', data: A.cumDisc.map((v) => v / 1e9), borderColor: '#1f5c33', borderWidth: 2, pointRadius: 2, yAxisID: 'y', order: 0 },
      { label: 'Arus kas bersih', data: A.cfs.map((v) => v / 1e9), backgroundColor: A.cfs.map((v) => (v < 0 ? '#e34948' : '#8cc49a')), borderRadius: 4, order: 1 },
    ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => ` ${c.dataset.label}: Rp${fmt(c.parsed.y, 2)} M` } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#e3e8e1' }, border: { display: false }, title: { display: true, text: 'Rp miliar' } } } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [A]);
  const opexCfg = useMemo(() => {
    const r = A.rows[0];
    const parts = [['Bahan sampah', r.raw, '#c27a3a'], ['Bahan penolong', r.aux, '#e8b07a'], ['Tenaga kerja', r.labor, '#2a78d6'], ['Pemeliharaan', r.maint, '#9aa8a0'], ['Listrik PLN', r.elec, '#e34948'], ['O&M PLTS', r.pvOm, '#eda100']];
    return {
      type: 'bar',
      data: { labels: parts.map((p) => p[0]), datasets: [{ data: parts.map((p) => p[1] / 1e6), backgroundColor: parts.map((p) => p[2]), borderRadius: 6 }] },
      options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => ` Rp${fmt(c.parsed.x, 0)} juta/tahun` } } },
        scales: { x: { grid: { color: '#e3e8e1' }, border: { display: false }, title: { display: true, text: 'Rp juta (tahun 1)' } }, y: { grid: { display: false } } } },
    };
  }, [A]);
  const torCfg = useMemo(() => ({
    type: 'bar',
    data: { labels: TOR.map((t) => t.label), datasets: [
      { label: '−20%', data: TOR.map((t) => t.lo / 1e9), backgroundColor: '#e8a0a0', borderRadius: 4 },
      { label: '+20%', data: TOR.map((t) => t.hi / 1e9), backgroundColor: '#8cc49a', borderRadius: 4 },
    ] },
    options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => ` ${c.dataset.label}: ΔNPV Rp${fmt(c.parsed.x, 2)} M` } } },
      scales: { x: { stacked: true, grid: { color: '#e3e8e1' }, border: { display: false }, title: { display: true, text: 'Perubahan NPV (Rp miliar)' } }, y: { stacked: true, grid: { display: false } } } },
  }), [TOR]);
  const histCfg = useMemo(() => {
    if (!mc) return null;
    const lo = mc.sorted[0], hi = mc.sorted[mc.sorted.length - 1], nb = 30, w = (hi - lo) / nb || 1;
    const bins = new Array(nb).fill(0); mc.sorted.forEach((v) => { bins[Math.min(nb - 1, Math.floor((v - lo) / w))]++; });
    const centers = bins.map((_, i) => lo + (i + 0.5) * w);
    return {
      type: 'bar',
      data: { labels: centers.map((c) => fmt(c / 1e9, 1)), datasets: [{ data: bins, backgroundColor: centers.map((c) => (c < mc.var5 ? '#e34948' : c < 0 ? '#e8a0a0' : '#8cc49a')), borderRadius: 3, barPercentage: 1, categoryPercentage: 0.95 }] },
      options: { responsive: true, maintainAspectRatio: false, animation: false,
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { title: (it) => `NPV ≈ Rp${it[0].label} M`, label: (c) => ` ${c.parsed.y} skenario` } } },
        scales: { x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 }, title: { display: true, text: 'NPV (Rp miliar)' } }, y: { grid: { color: '#e3e8e1' }, border: { display: false }, title: { display: true, text: 'jumlah skenario' } } } },
    };
  }, [mc]);
  const pvCfg = useMemo(() => ({
    type: 'line',
    data: { labels: pvCurve.map((p) => `${p.b} batch`), datasets: [{ label: 'NPV inkremental PLTS', data: pvCurve.map((p) => p.npv / 1e9), borderColor: '#eda100', backgroundColor: 'rgba(237,161,0,.15)', fill: 'origin', borderWidth: 2, pointRadius: 4 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => ` NPV inkremental: Rp${fmt(c.parsed.y, 2)} M` } } },
      scales: { x: { grid: { display: false } }, y: { grid: { color: '#e3e8e1' }, border: { display: false }, title: { display: true, text: 'Rp miliar' } } } },
  }), [pvCurve]);

  const K = ({ t, v, s, hero }) => <div className={'ek' + (hero ? ' ek-hero' : '')}><span>{t}</span><b>{v}</b><small>{s}</small></div>;
  const pct = (x) => (x == null ? '—' : `${fmt(x * 100, 1)}%`);

  return (
    <main>
      <section className="phead" style={{ paddingBottom: 30 }}>
        <div className="container">
          <span className="eyebrow">Tekno-ekonomi & risiko</span>
          <h1>Kelayakan usaha <span className="grad">dan risikonya</span></h1>
          <p className="lead">Kalkulator arus kas 20 tahun untuk unit produksi multi-purpose board bertenaga surya: NPV, IRR, payback, BCR, LCOE PLTS, nilai inkremental PLTS, simulasi Monte Carlo dengan Value-at-Risk, dan analisis sensitivitas.</p>
        </div>
      </section>

      <section className="container econ" style={{ paddingTop: 26, paddingBottom: 80 }}>
        <aside className="econ-in">
          {GROUPS.map((g, gi) => (
            <details key={g.t} open={gi < 2}>
              <summary>{g.t}</summary>
              <div className="ef">
                {g.f.map(([k, label, unit, step, hint]) => (
                  <label key={k}>
                    <span>{label}{hint && <em>{hint}</em>}</span>
                    <input type="number" step={step} value={inp[k]} onChange={(e) => { const v = parseFloat(e.target.value); if (!isNaN(v)) set(k, v); }} />
                  </label>
                ))}
              </div>
            </details>
          ))}
          <button className="btn sm" style={{ margin: '10px 16px 16px' }} onClick={() => setInp({ ...ECON_DEFAULTS })}>↺ Kembalikan asumsi awal</button>
        </aside>

        <div className="econ-out">
          <div className="ek-grid">
            <K hero t="NPV usaha (dengan PLTS)" v={M(A.npv)} s={`diskonto ${pct(inp.discount)} · ${inp.years} tahun`} />
            <K t="IRR" v={pct(A.irr)} s={`tanpa PLTS: ${pct(B.irr)}`} />
            <K t="Payback" v={A.payback != null ? `${fmt(A.payback, 1)} th` : '—'} s={`terdiskonto ${A.dpayback != null ? fmt(A.dpayback, 1) + ' th' : '—'}`} />
            <K t="BCR" v={fmt(A.bcr, 2)} s="PV manfaat / PV biaya" />
            <K t="Produksi" v={`${fmt(A.kgYear / 1000, 0)} t/th`} s={`≈ ${fmt(A.kgYear / inp.kgPerBoard)} papan/tahun`} />
            <K t="Investasi total" v={M(A.capex)} s={`pendapatan th-1 ${M(A.rows[0].rev)}`} />
          </div>

          <div className="card-w">
            <h3>Arus kas tahunan & kumulatif terdiskonto</h3>
            <div className="legend"><span><i className="sw" style={{ background: '#8cc49a' }} />Arus kas positif</span><span><i className="sw" style={{ background: '#e34948' }} />Negatif (investasi / ganti baterai)</span><span><i className="sw line" style={{ background: '#1f5c33' }} />Kumulatif terdiskonto</span></div>
            <ChartCanvas config={cfCfg} label="Grafik arus kas" height={270} />
          </div>

          <div className="econ-2">
            <div className="card-w">
              <h3>Struktur biaya operasional (tahun 1)</h3>
              <ChartCanvas config={opexCfg} label="Grafik struktur biaya" height={230} />
              <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Total OPEX {JT(A.rows[0].opex)}/tahun · listrik PLN hanya {JT(A.rows[0].elec)} berkat porsi surya {pct(inp.solarShare)}.</p>
            </div>
            <div className="card-w pvbox">
              <h3>☀️ Nilai PLTS secara terpisah (inkremental)</h3>
              <div className="pvk">
                <div><span>NPV inkremental</span><b className={INC.npv < 0 ? 'neg' : 'pos'}>{M(INC.npv)}</b></div>
                <div><span>LCOE efektif PLTS</span><b>Rp{fmt(A.lcoe)}/kWh</b></div>
                <div><span>Tarif PLN</span><b>Rp{fmt(inp.tariff, 0)}/kWh</b></div>
                <div><span>Hemat listrik th-1</span><b>{JT(INC.savingsY1)}</b></div>
              </div>
              <ChartCanvas config={pvCfg} label="NPV inkremental PLTS terhadap batch per hari" height={150} />
              <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>
                {INC.npv < 0
                  ? 'Dengan beban saat ini, penghematan listrik saja belum menutup investasi PLTS — kapasitasnya lebih besar dari kebutuhan. Nilai PLTS naik bila produksi ditambah untuk memakai surplus surya (lihat grafik), bila tarif naik, atau bila manfaat emisi dihitung. Inilah alasan optimisasi jadwal penting.'
                  : 'Penghematan listrik PLN menutup investasi PLTS dalam umur proyek.'}
              </p>
            </div>
          </div>

          <div className="card-w">
            <h3>Risiko: simulasi Monte Carlo ({mc ? fmt(mc.N) : '…'} skenario)</h3>
            <p className="muted" style={{ fontSize: 13, marginBottom: 10 }}>Harga jual, utilisasi, harga bahan, konsumsi listrik, porsi surya, dan upah diambil dari distribusi segitiga; kenaikan tarif dan harga diambil acak. Value-at-Risk (VaR) 5% = NPV pada persentil ke-5; Conditional VaR = rata-rata 5% skenario terburuk.</p>
            {mc && (
              <div className="risk">
                <div className="rk">
                  <div><span>NPV rata-rata</span><b>{M(mc.mean)}</b></div>
                  <div><span>Median (P50)</span><b>{M(mc.p50)}</b></div>
                  <div className="warn"><span>VaR 5% (P5)</span><b>{M(mc.var5)}</b></div>
                  <div className="warn"><span>CVaR 5%</span><b>{M(mc.cvar5)}</b></div>
                  <div><span>P(NPV &lt; 0)</span><b>{fmt(mc.probLoss * 100, 1)}%</b></div>
                  <div><span>IRR median</span><b>{pct(mc.irrP50)}</b></div>
                </div>
                <div><ChartCanvas config={histCfg} label="Histogram NPV Monte Carlo" height={240} /></div>
              </div>
            )}
          </div>

          <div className="card-w">
            <h3>Sensitivitas NPV (tornado, ±20%)</h3>
            <div className="legend"><span><i className="sw" style={{ background: '#e8a0a0' }} />Parameter −20%</span><span><i className="sw" style={{ background: '#8cc49a' }} />Parameter +20%</span></div>
            <ChartCanvas config={torCfg} label="Diagram tornado sensitivitas" height={320} />
          </div>

          <div className="card-w">
            <h3>🌱 Emisi yang dihindari selama {inp.years} tahun</h3>
            <div className="pvk" style={{ gridTemplateColumns: 'repeat(4,1fr)' }}>
              <div><span>Listrik surya menggantikan PLN</span><b>{fmt(A.co2.grid, 0)} t CO₂</b></div>
              <div><span>Papan daur ulang vs plastik baru</span><b>{fmt(A.co2.material, 0)} t CO₂e</b></div>
              <div><span>Timbunan sampah dihindari</span><b>{fmt(A.co2.stockpile, 0)} t CO₂e</b></div>
              <div><span>Total</span><b className="pos">{fmt(A.co2.grid + A.co2.material + A.co2.stockpile, 0)} t CO₂e</b></div>
            </div>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 8 }}>Faktor LCA 1,2 / 3,0 / 0,5 kg CO₂e per kg mengikuti ilustrasi Supian dkk. (2025); faktor emisi jaringan {inp.ef} kg CO₂/kWh.</p>
          </div>

          <p className="muted" style={{ fontSize: 12.5 }}>Catatan: angka investasi mesin, bangunan, upah, dan bahan penolong adalah asumsi — ganti dengan RAB aktual. Harga jual & bahan baku mengikuti ilustrasi Supian dkk. (2025). Konsumsi listrik per batch dan porsi surya sebaiknya diambil dari <Link to="/scheduler" style={{ color: 'var(--green)', fontWeight: 600 }}>Scheduler</Link> atau data <Link to="/monitoring" style={{ color: 'var(--green)', fontWeight: 600 }}>Monitoring</Link>.</p>
        </div>
      </section>
    </main>
  );
}
