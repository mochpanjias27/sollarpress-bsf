import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { PROCESS, SITE } from '../site.js';
import { LIVE } from '../three/materials.js';
import useReveal from '../components/useReveal.js';
import { loadForecast } from '../engine/forecast.js';
import { defaultParams, toSlots } from '../engine/engine.js';

const HeroScene = lazy(() => import('../three/HeroScene.jsx'));
const TechExplorer = lazy(() => import('../three/TechExplorer.jsx'));

const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const ICONS = ['♻️', '🔪', '🌀', '🔥', '❄️', '🪑'];

function useWebGL() {
  return useMemo(() => {
    try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; }
  }, []);
}

function Hud() {
  const [s, setS] = useState({ ...LIVE });
  useEffect(() => { const id = setInterval(() => setS({ ...LIVE }), 250); return () => clearInterval(id); }, []);
  const h = Math.floor(s.hour), m = Math.floor((s.hour % 1) * 60);
  return (
    <div className="hero-hud" aria-hidden="true">
      <div className="hud"><div className="l">Jam simulasi</div><div className="v mono">{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}</div></div>
      <div className="hud"><div className="l">Daya PV</div><div className="v" style={{ color: 'var(--sun)' }}>{s.pv.toFixed(1)}<small>kW</small></div></div>
      <div className="hud"><div className="l">Suhu pelat</div><div className="v" style={{ color: 'var(--orange-2)' }}>{s.temp.toFixed(0)}<small>°C</small></div></div>
      <div className="hud"><div className="l">Baterai</div><div className="v" style={{ color: 'var(--teal)' }}>{(s.battery * 100).toFixed(0)}<small>%</small></div></div>
    </div>
  );
}

const TECH = [
  { id: 'press', t: 'Mesin hot press', d: 'Dua pelat baja 10 cm dipanaskan oli termal hingga 185–200 °C, lalu silinder hidrolik memadatkan serpihan plastik di dalam cetakan selama 30–45 menit.',
    specs: [['30 kW', 'heater oli'], ['185–200 °C', 'jendela kualitas'], ['5 cetakan', 'per siklus'], ['1,56 MJ/K', 'massa termal']] },
  { id: 'solar', t: 'Panel surya', d: 'Array PV atap/lahan menghadap utara menjadi sumber energi utama. Prakiraan iradiasi Open-Meteo diubah menjadi prakiraan daya untuk penjadwalan.',
    specs: [['70 kWp', 'kapasitas (asumsi)'], ['0,80', 'performance ratio'], ['10°', 'kemiringan'], ['≈ 280 kWh', 'per hari cerah']] },
  { id: 'battery', t: 'Baterai & kontrol', d: 'Inverter hybrid mengatur aliran PV–baterai–beban–PLN. Panel kontrol dengan termokopel menjalankan jadwal heater dan batch hasil optimisasi.',
    specs: [['60 kWh', 'LiFePO₄'], ['60 kW', 'inverter hybrid'], ['15 menit', 'resolusi jadwal'], ['Rp1,5 M', 'investasi PLTS']] },
];

function ForecastTeaser() {
  const [st, setSt] = useState(null);
  useEffect(() => {
    let alive = true;
    const p = { ...defaultParams(), tilt: 10 };
    loadForecast(p).then(({ fc, source }) => {
      if (!alive) return;
      const start = fc.time[0].slice(0, 10);
      const S = toSlots(p, fc, start, 7);
      const days = [...Array(7)].map((_, d) => {
        let e = 0, peak = 0; for (let s = d * 96; s < d * 96 + 96; s++) { e += S.pv[s] * 0.25; peak = Math.max(peak, S.pv[s]); }
        const dt = new Date(new Date(start + 'T00:00:00Z').getTime() + d * 86400000);
        return { e, peak, dow: dt.getUTCDay(), date: dt.getUTCDate() };
      });
      const hourly = []; for (let s = 0; s < 96 * 2; s += 2) hourly.push(S.pv[s]);
      setSt({ days, hourly, source });
    }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const icon = (e) => (e / 70 >= 4.2 ? '☀️' : e / 70 >= 3.2 ? '🌤️' : e / 70 >= 2.2 ? '⛅' : e / 70 >= 1.4 ? '🌥️' : '🌧️');
  const maxH = st ? Math.max(1, ...st.hourly) : 1;
  return (
    <div className="fc-card reveal">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 14 }}>
        <b>Prakiraan energi surya 7 hari</b>
        <span className="mono" style={{ fontSize: 12, color: 'var(--tx-3)' }}>{SITE.lat}, {SITE.lon}</span>
      </div>
      <div className="fc-days">
        {(st ? st.days : [...Array(7)].map(() => null)).map((d, i) => (
          <div className="fc-day" key={i}>
            <div className="d">{d ? `${HARI[d.dow]} ${d.date}` : '—'}</div>
            <div className="w">{d ? icon(d.e) : '·'}</div>
            <div className="k">{d ? Math.round(d.e) : '—'}<small>kWh</small></div>
          </div>
        ))}
      </div>
      <div className="fc-bars" aria-label="Profil daya PV 48 jam ke depan">
        {(st ? st.hourly : [...Array(48)].fill(0)).map((v, i) => <i key={i} style={{ height: `${(v / maxH) * 100}%` }} />)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--tx-3)' }}><span>Hari ini 00.00</span><span>+24 jam</span><span>+48 jam</span></div>
      <div className="fc-src">
        <span className="dot" style={{ width: 8, height: 8, borderRadius: '50%', background: st?.source === 'live' ? 'var(--teal)' : 'var(--sun)' }} />
        {st ? (st.source === 'live' ? 'Prakiraan live Open-Meteo (iradiasi bidang panel)' : 'Data sintetis — prakiraan live tersedia setelah deploy (/api/forecast)') : 'Memuat prakiraan…'}
      </div>
    </div>
  );
}

export default function Home() {
  const webgl = useWebGL();
  const [tech, setTech] = useState('press');
  useReveal([]);
  return (
    <main>
      {/* ===== HERO ===== */}
      <div className="hero-shell">
      <section className="hero">
        <div className="hero-canvas">
          {webgl ? <Suspense fallback={null}><HeroScene /></Suspense> : null}
        </div>
        <div className="hero-in">
          <div className="hero-copy">
            <span className="eyebrow">(2026) Ekonomi sirkular · Waduk Saguling</span>
            <h1>Sampah plastik jadi papan, <span className="grad">digerakkan matahari.</span></h1>
            <p className="lead">
              SolarPress memprakirakan sinar matahari di lokasi mesin, lalu menyusun jadwal siklus hot press
              agar pemanasan dan pengepresan berjalan saat panel surya paling produktif — listrik PLN seminimal mungkin.
            </p>
            <div className="hero-actions">
              <Link to="/scheduler" className="btn primary arrow">Coba scheduler</Link>
              <Link to="/metodologi" className="btn">Lihat model matematika</Link>
            </div>
            <div className="hero-chips">
              <span className="chip"><span className="dot" /> <b>Prakiraan</b> iradiasi 7 hari</span>
              <span className="chip"><b>DP</b> per 15 menit</span>
              <span className="chip"><b>−35%</b> listrik PLN (simulasi)</span>
            </div>
          </div>
        </div>
        {webgl && <Hud />}
        <div className="scroll-cue"><i />gulir</div>
      </section>
      </div>

      {/* ===== STATS ===== */}
      <section className="container" style={{ position: 'relative', zIndex: 4 }}>
        <div className="stats reveal" style={{ marginTop: 28 }}>
          <div className="stat"><div className="v">Rp1,5<small>M</small></div><div className="l">investasi PLTS di lokasi</div></div>
          <div className="stat"><div className="v">30<small>kW</small></div><div className="l">heater oli mesin press</div></div>
          <div className="stat"><div className="v">185–200<small>°C</small></div><div className="l">jendela suhu kualitas papan</div></div>
          <div className="stat"><div className="v">≈10<small>%</small></div><div className="l">tingkat daur ulang plastik Indonesia</div></div>
        </div>
      </section>

      {/* ===== PROCESS ===== */}
      <section className="section" id="proses">
        <div className="container center">
          <span className="eyebrow reveal">Alur proses</span>
          <h2 className="h2 reveal">Dari sachet ke <span className="grad">multi-purpose board</span></h2>
          <p className="lead reveal">Plastik low-value yang tak laku di pasar daur ulang diolah lewat enam tahap menjadi papan pengganti kayu yang tahan air dan cuaca.</p>
          <div className="process" style={{ textAlign: 'left' }}>
            {PROCESS.map((s, i) => (
              <div key={s.k} className={'pcard reveal' + (i === 3 ? ' hot' : '')} style={{ transitionDelay: `${i * 60}ms` }}>
                <div className="ic">{ICONS[i]}</div>
                <div className="k">{s.k}</div>
                <h3>{s.t}</h3>
                <p>{s.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== TECH EXPLORER ===== */}
      <section className="section" style={{ paddingTop: 20 }} id="teknologi">
        <div className="container center">
          <span className="eyebrow reveal">Teknologi</span>
          <h2 className="h2 reveal">Bongkar komponennya</h2>
          <p className="lead reveal">Pilih komponen untuk melihat lapisannya dalam tampilan 3D terurai. Seret untuk memutar.</p>
          <div className="tech reveal" style={{ textAlign: 'left' }}>
            <div className="tech-list">
              {TECH.map((t) => (
                <button key={t.id} className={'tech-item' + (tech === t.id ? ' on' : '')} onClick={() => setTech(t.id)} aria-expanded={tech === t.id}>
                  <h4>{t.t}</h4>
                  <div className="body"><div>
                    <p>{t.d}</p>
                    <div className="tech-specs">{t.specs.map(([b, s]) => <div key={s}><b>{b}</b><span>{s}</span></div>)}</div>
                  </div></div>
                </button>
              ))}
              <Link to="/metodologi#termal" className="btn sm arrow" style={{ marginTop: 'auto', alignSelf: 'flex-start' }}>Model termal</Link>
            </div>
            <div className="tech-view">
              {webgl ? <Suspense fallback={null}><TechExplorer view={tech} /></Suspense> : <div style={{ padding: 30, color: 'var(--tx-3)' }}>Browser tidak mendukung WebGL.</div>}
              <div className="hint">⟲ seret untuk memutar</div>
            </div>
          </div>
        </div>
      </section>

      {/* ===== FORECAST ===== */}
      <section className="section" id="prakiraan">
        <div className="container fc-wrap">
          <div>
            <span className="eyebrow reveal">Prakiraan matahari</span>
            <h2 className="h2 reveal">Jadwal mengikuti <span className="grad">cuaca besok</span></h2>
            <p className="lead reveal">
              Setiap pagi, prakiraan iradiasi pada bidang panel diubah menjadi prakiraan daya PV per 15 menit.
              Optimisasi lalu memutuskan kapan heater dinyalakan, kapan tiap batch masuk press, dan — pada mode mingguan —
              hari mana yang mendapat produksi lebih banyak.
            </p>
            <div className="hero-actions reveal"><Link to="/scheduler" className="btn orange arrow">Susun jadwal minggu ini</Link></div>
          </div>
          <ForecastTeaser />
        </div>
      </section>

      {/* ===== IMPACT ===== */}
      <section className="section" style={{ paddingTop: 30 }}>
        <div className="container center">
          <span className="eyebrow reveal">Hasil simulasi</span>
          <h2 className="h2 reveal">Lebih banyak matahari, lebih sedikit PLN</h2>
          <p className="lead reveal">Simulasi 7 hari musim hujan, 36 batch (≈180 papan), dengan asumsi PLTS 70 kWp + baterai 60 kWh.</p>
          <div className="impact" style={{ textAlign: 'left' }}>
            <div className="icard reveal"><div className="big">−17%</div><p>listrik PLN dengan target harian tetap — heater digeser ke jam surya dan pelat dipakai sebagai "baterai panas".</p></div>
            <div className="icard g reveal"><div className="big">−35%</div><p>listrik PLN dengan target mingguan fleksibel — produksi dipindah dari hari mendung ke hari cerah.</p></div>
            <div className="icard reveal"><div className="big">100%</div><p>slot pengepresan dalam jendela 185–200 °C, sedangkan jadwal konvensional kerap turun di bawah standar.</p></div>
          </div>
          <div className="cta reveal" style={{ marginTop: 56, textAlign: 'left' }}>
            <div>
              <h3>Siap menjadwalkan produksi besok?</h3>
              <p>Ubah parameter mesin, PLTS, dan tarif sesuai kondisi lapangan, lalu dapatkan instruksi jam untuk operator.</p>
            </div>
            <Link to="/scheduler" className="btn primary arrow">Buka SolarPress Scheduler</Link>
          </div>
        </div>
      </section>
    </main>
  );
}
