import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import ChartCanvas from '../components/ChartCanvas.jsx';
import { useImpact, Ticker } from '../components/ImpactCounter.jsx';
import { IMPACT_CONFIG as CFG, monthly } from '../impact.js';
import useReveal from '../components/useReveal.js';

const fmt = (v, d = 0) => (v ?? 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });

const SDGS = [
  { n: 7, t: 'Energi bersih & terjangkau', d: 'Mesin press digerakkan PLTS; jadwal dioptimalkan agar porsi surya maksimal.', c: '#fcc30b' },
  { n: 8, t: 'Pekerjaan layak & pertumbuhan ekonomi', d: 'Lapangan kerja lokal dari pengumpulan, pemilahan, produksi, hingga finishing.', c: '#a21942' },
  { n: 9, t: 'Industri, inovasi & infrastruktur', d: 'Rekayasa mesin, digital twin, dan optimisasi berbasis model matematika.', c: '#fd6925' },
  { n: 11, t: 'Kota & permukiman berkelanjutan', d: 'Mengurangi sampah yang mencemari permukiman dan perairan Saguling.', c: '#fd9d24' },
  { n: 12, t: 'Konsumsi & produksi bertanggung jawab', d: 'Sampah low-value kembali menjadi bahan baku — ekonomi sirkular.', c: '#bf8b2e' },
  { n: 13, t: 'Penanganan perubahan iklim', d: 'Emisi dihindari dari listrik surya, substitusi plastik baru, dan timbunan sampah.', c: '#3f7e44' },
];

export default function Impact() {
  const s = useImpact();
  useReveal([]);
  const months = useMemo(() => monthly(CFG), []);
  const since = new Date(CFG.since + 'T00:00:00+07:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
  const co2Parts = useMemo(() => {
    const grid = s.kwhSolar * CFG.ef, mat = s.kgBoard * CFG.lcaAvoided, stock = s.kgWaste * CFG.lcaStockpile;
    return { grid, mat, stock };
  }, [s]);
  const chartCfg = useMemo(() => ({
    type: 'bar',
    data: { labels: months.map((m) => m.label), datasets: [{ label: 'Sampah terolah', data: months.map((m) => (m.batches * CFG.boardsPerBatch * CFG.kgPerBoard) / CFG.conversion / 1000), backgroundColor: '#2e7d46', borderRadius: 6 }] },
    options: { responsive: true, maintainAspectRatio: false, animation: false,
      plugins: { legend: { display: false }, tooltip: { backgroundColor: '#111', padding: 10, cornerRadius: 8, callbacks: { label: (c) => ` ${fmt(c.parsed.y, 1)} ton sampah plastik` } } },
      scales: { x: { grid: { display: false } }, y: { beginAtZero: true, grid: { color: '#e3e8e1' }, border: { display: false }, title: { display: true, text: 'ton' } } } },
  }), [months]);

  const BIG = [
    ['♻️', 'Sampah plastik terolah', s.kgWaste, 0, 'kg'],
    ['🧱', 'Papan diproduksi', s.boards, 0, 'lembar'],
    ['☀️', 'Listrik surya dipakai', s.kwhSolar, 0, 'kWh'],
    ['🌱', 'Emisi dihindari', s.co2 / 1000, 2, 't CO₂e'],
  ];
  const EQ = [
    ['🛍️', s.sachets, 0, 'sachet & kemasan fleksibel', `setara (asumsi ${CFG.gramPerSachet} g/sachet)`],
    ['🌳', s.trees, 0, 'pohon dewasa', 'menyerap CO₂ sebanyak ini dalam setahun'],
    ['🚗', s.carKm, 0, 'km perjalanan mobil', 'emisi yang setara dihindari'],
    ['💰', s.value / 1e6, 1, 'juta rupiah nilai tambah', 'nilai papan dikurangi harga sampah'],
    ['👷', CFG.workers, 0, 'tenaga kerja lokal', 'terlibat dalam rantai produksi'],
    ['⚡', s.batches, 0, 'siklus hot press', 'dijalankan sejak mulai operasi'],
  ];

  return (
    <main>
      <section className="phead" style={{ paddingBottom: 40 }}>
        <div className="container">
          <span className="eyebrow">Dampak</span>
          <h1>Dampak yang <span className="grad">terus bertambah</span></h1>
          <p className="lead">Akumulasi sejak {since}. Angka diperbarui setiap detik selama jam produksi, dihitung dari rencana produksi dan faktor konversi dari artikel proyek.</p>
          <div className="impact-big">
            {BIG.map(([ic, l, v, d, u]) => (
              <div key={l} className="ib"><span className="ic">{ic}</span><small>{l}</small><b><Ticker value={v} d={d} /></b><em>{u}</em></div>
            ))}
          </div>
          <div className="is-head" style={{ marginTop: 16 }}>
            <span className={'live-dot' + (s.producing ? ' on' : '')} />
            {s.producing ? 'Produksi berjalan sekarang' : 'Di luar jam produksi (09.00–15.00, Senin–Sabtu)'}
            {CFG.isDemo && <span className="demo-tag">estimasi berdasarkan rencana produksi — akan diganti log produksi aktual</span>}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 60 }}>
        <div className="container center">
          <span className="eyebrow reveal">Kesetaraan</span>
          <h2 className="h2 reveal">Agar angkanya terasa <span className="grad">nyata</span></h2>
          <div className="eq-grid">
            {EQ.map(([ic, v, d, l, s2]) => (
              <div key={l} className="eqc reveal"><span className="ic">{ic}</span><b><Ticker value={v} d={d} /></b><strong>{l}</strong><small>{s2}</small></div>
            ))}
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container imp-2">
          <div className="card-w reveal">
            <h3>Sampah plastik terolah per bulan</h3>
            <ChartCanvas config={chartCfg} label="Grafik sampah terolah per bulan" height={260} />
          </div>
          <div className="card-w reveal">
            <h3>Komposisi emisi yang dihindari</h3>
            {[['Listrik surya menggantikan PLN', co2Parts.grid, '#eda100'], ['Papan daur ulang vs plastik baru', co2Parts.mat, '#2e7d46'], ['Timbunan sampah dihindari', co2Parts.stock, '#9aa8a0']].map(([l, v, c]) => {
              const tot = co2Parts.grid + co2Parts.mat + co2Parts.stock || 1;
              return (
                <div key={l} className="co2row">
                  <div><span>{l}</span><b>{fmt(v / 1000, 2)} t</b></div>
                  <i><u style={{ width: `${(v / tot) * 100}%`, background: c }} /></i>
                </div>
              );
            })}
            <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>Faktor: jaringan {CFG.ef} kg CO₂/kWh; LCA plastik baru 3,0 vs daur ulang 1,2 kg CO₂e/kg; timbunan 0,5 kg CO₂e/kg (Supian dkk., 2025).</p>
          </div>
        </div>
      </section>

      <section className="section" style={{ paddingTop: 20 }}>
        <div className="container center">
          <span className="eyebrow reveal">Tujuan Pembangunan Berkelanjutan</span>
          <h2 className="h2 reveal">Kontribusi terhadap <span className="grad">SDGs</span></h2>
          <div className="sdg-grid">
            {SDGS.map((g) => (
              <div key={g.n} className="sdg reveal"><span style={{ background: g.c }}>{g.n}</span><div><b>{g.t}</b><p>{g.d}</p></div></div>
            ))}
          </div>

          <div className="card-w reveal" style={{ textAlign: 'left', marginTop: 40 }}>
            <h3>Metode perhitungan</h3>
            <table className="tbl"><tbody>
              <tr><td>Produksi</td><td>{CFG.batchesPerDay} batch/hari × {CFG.boardsPerBatch} papan × {CFG.kgPerBoard} kg, hari kerja Senin–Sabtu, jam {CFG.prodStart}.00–{CFG.prodEnd}.00</td></tr>
              <tr><td>Sampah terolah</td><td>kg papan ÷ efisiensi konversi {CFG.conversion * 100}% (Supian dkk., 2025)</td></tr>
              <tr><td>Listrik surya</td><td>{CFG.kwhPerBatch} kWh/batch × porsi surya {CFG.solarShare * 100}% (hasil Scheduler)</td></tr>
              <tr><td>Emisi dihindari</td><td>kWh surya × {CFG.ef} + kg papan × {CFG.lcaAvoided.toFixed(1)} + kg sampah × {CFG.lcaStockpile}</td></tr>
              <tr><td>Nilai tambah</td><td>kg papan × Rp{fmt(CFG.price)} − kg sampah × Rp{fmt(CFG.rawCost)} (Supian dkk., 2025)</td></tr>
            </tbody></table>
            <p className="muted" style={{ fontSize: 12.5 }}>Parameter dapat diubah di <span className="mono">src/impact.js</span>. Setelah log produksi atau <Link to="/monitoring" style={{ color: 'var(--green)', fontWeight: 600 }}>telemetri</Link> tersedia, angka estimasi diganti data aktual.</p>
          </div>
        </div>
      </section>
    </main>
  );
}
