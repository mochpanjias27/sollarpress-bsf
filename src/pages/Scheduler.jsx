import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/scheduler.css';
import ChartCanvas from '../components/ChartCanvas.jsx';
import { defaultParams, parseOpenMeteo } from '../engine/engine.js';
import { loadForecast, synthetic, openMeteoUrl, todayJakarta } from '../engine/forecast.js';

/* ============ util ============ */
const fmt = (v, d = 0) => (v ?? 0).toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d });
const rp = (v) => 'Rp' + fmt(Math.round(v));
const HARI = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const HARI_L = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
const hhmm = (h) => String(Math.floor(h)).padStart(2, '0') + '.' + String(Math.round((h % 1) * 60)).padStart(2, '0');
const dateOf = (s, d) => new Date(new Date(s + 'T00:00:00Z').getTime() + d * 86400000);
const C = { pv: '#eda100', bat: '#1baf7a', pln: '#e34948', load: '#0b0b0b', temp: '#2a78d6', grid: '#e1e0d9' };
const tooltipBase = { backgroundColor: '#111', padding: 10, cornerRadius: 8, titleFont: { weight: '700' }, boxPadding: 4 };
const wxIcon = (kwhPerKwp) => (kwhPerKwp >= 4.2 ? '☀️' : kwhPerKwp >= 3.2 ? '🌤️' : kwhPerKwp >= 2.2 ? '⛅' : kwhPerKwp >= 1.4 ? '🌥️' : '🌧️');

const DEF = { ...defaultParams(), tilt: 10, maxPerDay: 8, mode: 'daily' };

/* ============ form fields ============ */
const GROUPS = [
  { id: 'prod', icon: '🎯', title: 'Produksi & mode optimisasi', open: true, fields: [
    ['target', 'Batch / hari kerja', 1], ['maxPerDay', 'Maks. batch / hari', 1, 'untuk mode mingguan'],
    ['molds', 'Cetakan / batch', 1], ['kgPerMold', 'Massa / cetakan (kg)', 0.5, '130×250×1 cm ≈ 30 kg'],
    ['pressSlots', 'Durasi tekan', 'sel', [[2, '30 menit'], [3, '45 menit']]], ['changeSlots', 'Ganti cetakan', 'sel', [[1, '15 menit'], [2, '30 menit']]],
    ['workStart', 'Jam kerja mulai', 0.25], ['workEnd', 'Jam kerja selesai', 0.25],
  ] },
  { id: 'pv', icon: '☀️', title: 'Panel surya & baterai', open: true, fields: [
    ['kwp', 'Kapasitas PV (kWp)', 1], ['pr', 'Performance ratio', 0.01], ['invMax', 'Inverter maks. (kW)', 1], ['tilt', 'Kemiringan panel (°)', 1, 'menghadap utara'],
    ['batCap', 'Baterai (kWh)', 5, '0 = tanpa baterai'], ['batP', 'Daya baterai (kW)', 1], ['soc0pct', 'SOC awal (%)', 1], ['gamma', 'Ketidakpastian Γ', 0.1, '0 nominal · 1 konservatif'],
  ] },
  { id: 'th', icon: '🔥', title: 'Mesin press & model termal', fields: [
    ['heaterP', 'Daya heater oli (kW)', 1], ['etaH', 'Efisiensi heater', 0.01], ['mSteel', 'Massa pelat baja (kg)', 50], ['mOil', 'Massa oli termal (kg)', 10],
    ['UA', 'Rugi panas UA (W/K)', 1], ['theta0', 'Suhu pelat awal (°C)', 1], ['thMin', 'Suhu tekan min (°C)', 1], ['thMaxPress', 'Suhu tekan maks (°C)', 1],
    ['thMaxAbs', 'Batas suhu pelat (°C)', 1], ['latent', 'Kalor laten (kJ/kg)', 10], ['baseLoad', 'Beban fasilitas lain (kW)', 0.5, 'pencacah, pencuci, lampu'], ['auxPress', 'Pompa hidrolik (kW)', 0.5],
    ['heatStart', 'Heater boleh mulai (jam)', 0.25], ['heatEnd', 'Heater paling lambat (jam)', 0.25],
  ], checks: [['heatOffDays', 'Izinkan pemanasan otomatis di hari libur']] },
  { id: 'tar', icon: '⚡', title: 'Tarif PLN & emisi', fields: [
    ['price', 'Tarif (Rp/kWh)', 0.01, 'B-2/TR: Rp1.444,70'], ['ef', 'Faktor emisi (kg CO₂/kWh)', 0.01], ['wbpMult', 'Pengali WBP', 0.1], ['carbonPrice', 'Harga karbon (Rp/kg CO₂)', 10],
    ['batDeg', 'Degradasi baterai (Rp/kWh)', 50], ['penalty', 'Penalti batch gagal (Rp)', 100000],
  ], checks: [['wbp', 'Tarif waktu beban puncak (WBP 17.00–22.00)']] },
];

function Field({ k, label, step, help, P, set }) {
  if (step === 'sel') {
    return (
      <div className="f"><label htmlFor={k}>{label}</label>
        <select id={k} value={P[k]} onChange={(e) => set(k, +e.target.value)}>{help.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
      </div>
    );
  }
  const val = k === 'soc0pct' ? Math.round(P.soc0 * 100) : P[k];
  return (
    <div className="f"><label htmlFor={k}>{label}</label>
      <input id={k} type="number" step={step} value={val} onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (isNaN(v)) return;
        if (k === 'soc0pct') set('soc0', Math.min(0.95, Math.max(0.1, v / 100))); else set(k, v);
      }} />
      {help && <small>{help}</small>}
    </div>
  );
}

/* ============ page ============ */
export default function Scheduler() {
  const [P, setP] = useState(() => {
    try { const s = localStorage.getItem('solarpress.params'); if (s) return { ...DEF, ...JSON.parse(s) }; } catch { /* abaikan */ }
    return { ...DEF };
  });
  const [fc, setFc] = useState(null);
  const [src, setSrc] = useState('loading');
  const [start, setStart] = useState('');
  const [days, setDays] = useState(7);
  const [busy, setBusy] = useState(null);
  const [res, setRes] = useState(null);
  const [sel, setSel] = useState(0);
  const [dlg, setDlg] = useState(false);
  const [paste, setPaste] = useState('');
  const [dlgMsg, setDlgMsg] = useState('');
  const [toast, setToast] = useState('');
  const workerRef = useRef(null);

  const set = useCallback((k, v) => setP((p) => ({ ...p, [k]: v })), []);
  const showToast = (m) => { setToast(m); setTimeout(() => setToast(''), 2400); };

  useEffect(() => { try { localStorage.setItem('solarpress.params', JSON.stringify(P)); } catch { /* abaikan */ } }, [P]);

  const dates = useMemo(() => (fc ? [...new Set(fc.time.map((t) => t.slice(0, 10)))] : []), [fc]);
  const availDays = useMemo(() => {
    if (!dates.length || !start) return 7;
    return dates.length - dates.indexOf(start) - (src === 'synthetic' ? 0 : 1);
  }, [dates, start, src]);

  const applyForecast = useCallback((f, source) => {
    setFc(f); setSrc(source);
    const ds = [...new Set(f.time.map((t) => t.slice(0, 10)))];
    const td = todayJakarta();
    setStart(ds.includes(td) ? td : ds[0]);
  }, []);

  useEffect(() => {
    loadForecast({ ...P }).then(({ fc: f, source }) => applyForecast(f, source));
    return () => workerRef.current?.terminate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = useCallback((override) => {
    const f = override?.fc || fc;
    const st = override?.start || start;
    if (!f || !st) return;
    const nd = Math.max(1, Math.min(days, override ? 7 : availDays));
    const p = { ...P, loadFrac: P.pressSlots === 2 ? [0.6, 0.4] : [0.5, 0.3, 0.2], target: Math.round(P.target), maxPerDay: Math.max(1, Math.round(P.maxPerDay)) };
    if (p.batCap <= 0) { p.batCap = 0.001; p.batP = 0; }
    let nWork = 0; for (let d = 0; d < nd; d++) if (p.workDays.includes(dateOf(st, d).getUTCDay())) nWork++;
    const total = p.target * nWork;
    if (!workerRef.current) workerRef.current = new Worker(new URL('../engine/worker.js', import.meta.url), { type: 'module' });
    const w = workerRef.current;
    const t0 = performance.now();
    setBusy({ prog: 0.02, txt: 'Menyiapkan…' });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.prog != null) { setBusy({ prog: m.prog, txt: m.txt }); return; }
      setBusy(null);
      if (m.error) { showToast('Gagal: ' + m.error); return; }
      const R = { ...m, total, mode: p.mode, p, secs: (performance.now() - t0) / 1000 };
      setRes(R);
      setSel(Math.max(0, R.O.perDay.findIndex((x) => x.batches > 0)));
    };
    w.postMessage({ p, fc: f, start: st, days: nd, mode: p.mode, total, maxPerDay: p.maxPerDay });
  }, [P, fc, start, days, availDays]);

  // jalankan otomatis setelah prakiraan pertama tersedia
  const ranOnce = useRef(false);
  useEffect(() => { if (fc && start && !ranOnce.current) { ranOnce.current = true; run(); } }, [fc, start, run]);

  /* ---------- dialog ---------- */
  const tryLive = async () => {
    setDlgMsg('Menghubungi server prakiraan…');
    const r = await loadForecast(P);
    if (r.source === 'live') { applyForecast(r.fc, 'live'); setDlg(false); showToast('Prakiraan live dimuat'); run({ fc: r.fc, start: r.fc.time[0].slice(0, 10) }); }
    else setDlgMsg('Tidak bisa mengambil data live. Gunakan cara salin–tempel.');
  };
  const applyPaste = () => {
    try { const f = parseOpenMeteo(JSON.parse(paste)); applyForecast(f, 'pasted'); setDlg(false); showToast('Prakiraan diterapkan'); run({ fc: f, start: f.time[0].slice(0, 10) }); }
    catch (e) { setDlgMsg('JSON tidak valid: ' + e.message); }
  };
  const useSynth = () => { const r = synthetic(P); applyForecast(r.fc, 'synthetic'); setDlg(false); run({ fc: r.fc, start: r.fc.time[0].slice(0, 10) }); };

  const srcInfo = { live: ['#0ca30c', 'Prakiraan live · Open-Meteo'], pasted: ['#2a78d6', 'Open-Meteo (ditempel)'], synthetic: ['#eda100', 'Data sintetis (demo)'], loading: ['#898781', 'Memuat prakiraan…'] }[src];

  return (
    <div className="sched">
      <div className="sched-bar">
        <div style={{ flex: 1, minWidth: 260 }}>
          <h1>SolarPress Scheduler</h1>
          <p>Optimisasi jadwal siklus mesin press bertenaga surya · Bening Saguling, Cihampelas</p>
        </div>
        <span className="badge"><span className="dot" style={{ background: srcInfo[0] }} />{srcInfo[1]}</span>
        <button className="btn sm" onClick={() => { setDlg(true); setDlgMsg(''); }}>☁️ Perbarui prakiraan</button>
        <button className="btn primary" disabled={!!busy || !fc} onClick={() => run()}>▶ Optimalkan</button>
      </div>

      <div className="wrap">
        <aside className="side">
          {GROUPS.map((g) => (
            <details className="grp" key={g.id} open={g.open}>
              <summary><span className="gi">{g.icon}</span>{g.title}<span className="chev">›</span></summary>
              <div className="fields">
                {g.id === 'prod' && (
                  <div className="f full">
                    <label>Mode target produksi</label>
                    <div className="seg">
                      {[['daily', 'Target harian tetap'], ['weekly', 'Mingguan fleksibel']].map(([v, t]) => (
                        <button key={v} className={P.mode === v ? 'on' : ''} onClick={() => set('mode', v)}>{t}</button>
                      ))}
                    </div>
                    <small>{P.mode === 'daily'
                      ? 'Setiap hari kerja memproduksi jumlah batch yang sama; optimisasi mengatur jam pemanasan & jam mulai batch.'
                      : 'Total batch seminggu tetap, tetapi pembagian per hari ikut cuaca: hari cerah lebih banyak, hari mendung lebih sedikit.'}</small>
                  </div>
                )}
                {g.fields.map(([k, label, step, help]) => <Field key={k} k={k} label={label} step={step} help={help} P={P} set={set} />)}
                {g.id === 'prod' && (
                  <div className="f full"><label>Hari kerja</label>
                    <div className="daychips">
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <label key={d} className={P.workDays.includes(d) ? 'on' : ''} style={P.workDays.includes(d) ? { background: 'var(--brand)', borderColor: 'var(--brand)', color: '#fff' } : {}}>
                          <input type="checkbox" checked={P.workDays.includes(d)} onChange={(e) => set('workDays', e.target.checked ? [...P.workDays, d] : P.workDays.filter((x) => x !== d))} />{HARI[d]}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                {(g.checks || []).map(([k, label]) => (
                  <div className="f full" key={k}><label className="chk"><input type="checkbox" checked={!!P[k]} onChange={(e) => set(k, e.target.checked)} /> {label}</label></div>
                ))}
              </div>
            </details>
          ))}
          <details className="grp">
            <summary><span className="gi">📅</span>Horizon perencanaan<span className="chev">›</span></summary>
            <div className="fields">
              <div className="f"><label>Mulai tanggal</label>
                <select value={start} onChange={(e) => setStart(e.target.value)}>
                  {dates.slice(0, src === 'synthetic' ? dates.length : Math.max(1, dates.length - 1)).map((d) => { const dt = new Date(d + 'T00:00:00Z'); return <option key={d} value={d}>{HARI[dt.getUTCDay()]}, {dt.getUTCDate()} {BULAN[dt.getUTCMonth()]}</option>; })}
                </select>
              </div>
              <div className="f"><label>Jumlah hari</label>
                <select value={days} onChange={(e) => setDays(+e.target.value)}>{[3, 5, 7].map((n) => <option key={n} value={n} disabled={n > availDays}>{n}</option>)}</select>
              </div>
              <div className="f full"><button className="btn sm" onClick={() => { const m = P.mode; setP({ ...DEF, mode: m }); showToast('Asumsi awal dikembalikan — klik Optimalkan'); }}>↺ Kembalikan asumsi awal</button></div>
            </div>
          </details>
        </aside>

        <main>
          {busy && (
            <div className="card"><div className="busy-card"><div className="spin" /><div style={{ flex: 1 }}><b>{busy.txt}</b><div className="progress"><i style={{ width: `${(busy.prog * 100).toFixed(0)}%` }} /></div></div></div></div>
          )}
          {src === 'synthetic' && (
            <div className="note warn">⚠️ <b>Mode demo:</b> prakiraan di bawah ini <b>sintetis</b> (pola musim hujan Bandung). Setelah situs di-deploy ke Vercel, prakiraan nyata Open-Meteo dimuat otomatis lewat <span className="mono">/api/forecast</span>. Bisa juga klik <b>☁️ Perbarui prakiraan</b>.</div>
          )}
          {(src === 'live' || src === 'pasted') && (
            <div className="note">✅ Prakiraan iradiasi bidang panel (GTI, kemiringan {P.tilt}°, menghadap utara) dari Open-Meteo untuk koordinat {P.lat}, {P.lon}. Parameter lainnya masih asumsi — ganti di panel kiri bila data lapangan tersedia.</div>
          )}
          {res ? <Results R={res} sel={sel} setSel={setSel} showToast={showToast} /> : !busy && <div className="card">Memuat prakiraan dan menyiapkan optimisasi…</div>}
          <div className="card" style={{ fontSize: 13, color: 'var(--ink-2)' }}>
            Formulasi lengkap model (termal RC, neraca daya, DP & dekomposisi dua tingkat) ada di halaman <Link to="/metodologi" style={{ color: 'var(--brand)', fontWeight: 700 }}>Metodologi →</Link>
          </div>
        </main>
      </div>

      <div className={'overlay' + (dlg ? ' on' : '')} onClick={(e) => e.target === e.currentTarget && setDlg(false)}>
        <div className="modal">
          <h3>Perbarui prakiraan cuaca</h3>
          <p style={{ color: 'var(--ink-2)', margin: '0 0 8px', fontSize: 13 }}>Situs mencoba <span className="mono">/api/forecast</span> lalu Open-Meteo langsung. Jika keduanya gagal, buka tautan berikut di tab baru, salin seluruh teksnya, dan tempel di bawah.</p>
          <a className="url mono" href={openMeteoUrl(P)} target="_blank" rel="noopener noreferrer">{openMeteoUrl(P)}</a>
          <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder='{"latitude":-6.92, ... "hourly":{...}}' />
          <div style={{ fontSize: 12.5, marginTop: 8, color: dlgMsg.startsWith('JSON') || dlgMsg.startsWith('Tidak') ? 'var(--crit)' : 'var(--ink-2)' }}>{dlgMsg}</div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
            <button className="btn sm" onClick={tryLive}>🔄 Ambil live</button>
            <button className="btn sm" onClick={useSynth}>🎲 Data sintetis</button>
            <button className="btn sm" onClick={() => setDlg(false)}>Tutup</button>
            <button className="btn sm primary" onClick={applyPaste}>Terapkan</button>
          </div>
        </div>
      </div>
      <div className={'toast' + (toast ? ' on' : '')}>{toast}</div>
    </div>
  );
}

/* ============ results ============ */
function Results({ R, sel, setSel, showToast }) {
  const { O, B, S, p } = R;
  const dayL = (d) => { const dt = dateOf(S.startDateStr, d); return { short: HARI[dt.getUTCDay()], date: `${dt.getUTCDate()} ${BULAN[dt.getUTCMonth()]}`, long: `${HARI_L[dt.getUTCDay()]}, ${dt.getUTCDate()} ${BULAN[dt.getUTCMonth()]} ${dt.getUTCFullYear()}`, dow: dt.getUTCDay() }; };
  return (
    <>
      <KPIs R={R} />
      <section className="card">
        <h2>Prakiraan daya panel surya</h2>
        <p className="sub">Daya keluaran PV per 15 menit; pita = rentang ketidakpastian ±σ. Klik grafik atau kartu hari untuk memilih hari.</p>
        <div className="legend"><span><i className="sw" style={{ background: C.pv }} />Daya PV prakiraan (kW)</span><span><i className="sw" style={{ background: 'rgba(237,161,0,.22)' }} />Rentang ketidakpastian</span><span><i className="sw line" style={{ background: C.load }} />Beban total jadwal optimal (kW)</span></div>
        <ForecastChart R={R} sel={sel} setSel={setSel} dayL={dayL} />
        <div className="days">
          {O.perDay.map((x, d) => {
            const L = dayL(d), work = p.workDays.includes(L.dow);
            return (
              <button key={d} className={'day' + (d === sel ? ' on' : '') + (work ? '' : ' off')} onClick={() => setSel(d)}>
                <div className="dn">{L.short}</div><div className="dd">{L.date}</div>
                <div className="wx">{wxIcon(x.pvE / p.kwp)}</div>
                <div className="kwh">{fmt(x.pvE)} kWh</div>
                <div className="bt">{work || x.batches ? <><b>{x.batches}</b> batch · PLN {fmt(x.gridE, 1)}</> : 'Libur'}</div>
              </button>
            );
          })}
        </div>
      </section>
      <DayDetail R={R} d={sel} setSel={setSel} dayL={dayL} />
      <CompareTable R={R} dayL={dayL} />
      <Operator R={R} dayL={dayL} showToast={showToast} />
      <p style={{ fontSize: 12, color: 'var(--muted)', margin: 0 }}>Dihitung dalam {fmt(R.secs, 1)} detik di browser Anda (Web Worker).</p>
    </>
  );
}

function KPIs({ R }) {
  const { O, B, p, mode, curves } = R; const o = O.total, b = B.total;
  const dG = b.gridE > 0 ? (1 - o.gridE / b.gridE) * 100 : 0;
  const share = o.loadE > 0 ? 1 - o.gridE / o.loadE : 1, shareB = b.loadE > 0 ? 1 - b.gridE / b.loadE : 1;
  let cap = null;
  if (curves) { let c = 0; curves.forEach((cv) => { let n = 0; for (let i = 0; i < cv.length; i++) if (cv[i] <= p.price) n = i; c += cv.length > 1 ? n : 0; }); cap = c; }
  const K = ({ lab, val, unit, cmp, hero }) => (
    <div className={'kpi' + (hero ? ' kpi-hero' : '')}><div className="lab">{lab}</div><div className="val">{val}<small>{unit}</small></div><div className="cmp">{cmp}</div></div>
  );
  return (
    <section className="kpis">
      <K hero lab="⚡ Listrik PLN terpakai" val={fmt(o.gridE, 1)} unit="kWh" cmp={<><span className={'delta ' + (dG >= 0 ? 'good' : 'bad')}>{dG >= 0 ? '▼' : '▲'} {fmt(Math.abs(dG))}%</span> vs konvensional {fmt(b.gridE, 1)} kWh</>} />
      <K lab="💰 Biaya listrik PLN" val={rp(o.cost)} unit="" cmp={<>hemat <b>{rp(b.cost - o.cost)}</b> (konvensional {rp(b.cost)})</>} />
      <K lab="🌱 Emisi CO₂ dari PLN" val={fmt(o.co2, 1)} unit="kg" cmp={`berkurang ${fmt(b.co2 - o.co2, 1)} kg dari ${fmt(b.co2, 1)} kg`} />
      <K lab="☀️ Porsi energi surya" val={fmt(share * 100, 1)} unit="%" cmp={`konvensional ${fmt(shareB * 100, 1)}% · PV terbuang ${fmt(o.curtE)} kWh`} />
      <K lab="🧱 Produksi terjadwal" val={fmt(o.batches)} unit="batch" cmp={`≈ ${fmt(o.batches * p.molds)} papan · ${mode === 'weekly' ? 'alokasi mingguan fleksibel' : 'target harian tetap'}`} />
      {cap != null
        ? <K lab="🌞 Kapasitas bebas-PLN" val={cap} unit="batch" cmp="perkiraan konservatif: maks. batch dengan PLN ≤1 kWh/hari" />
        : <K lab="✅ Suhu tekan sesuai standar" val="100" unit="%" cmp={`jendela ${p.thMin}–${p.thMaxPress} °C · konvensional: ${fmt(B.total.violations)} slot di luar jendela`} />}
    </section>
  );
}

function ForecastChart({ R, sel, setSel, dayL }) {
  const { O, S } = R;
  const selRef = useRef(sel); selRef.current = sel;
  const config = useMemo(() => {
    const n = S.n;
    const labels = [...Array(n)].map((_, s) => { const L = dayL(Math.floor(s / 96)); return `${L.short} ${L.date} ${hhmm((s % 96) / 4)}`; });
    const lo = S.pv.map((v, i) => Math.max(0, v - S.sigma[i])), hi = S.pv.map((v, i) => v + S.sigma[i]);
    return {
      type: 'line',
      data: { labels, datasets: [
        { label: 'Batas atas', data: hi, borderWidth: 0, pointRadius: 0, fill: '+1', backgroundColor: 'rgba(237,161,0,.20)' },
        { label: 'Batas bawah', data: lo, borderWidth: 0, pointRadius: 0, fill: false },
        { label: 'Daya PV prakiraan', data: S.pv, borderColor: C.pv, borderWidth: 2, pointRadius: 0, fill: 'origin', backgroundColor: 'rgba(237,161,0,.10)', tension: 0.25 },
        { label: 'Beban total (optimal)', data: O.trace.map((x) => x.load), borderColor: C.load, borderWidth: 1.25, pointRadius: 0, stepped: true },
      ] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase, filter: (i) => i.datasetIndex >= 2, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y, 1)} kW` } } },
        scales: {
          x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, callback: (v, i) => (i % 96 === 48 ? labels[i].split(' ').slice(0, 3).join(' ') : null) } },
          y: { beginAtZero: true, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: 'kW' } },
        },
        onClick: (e, els, ch) => { const x = ch.scales.x.getValueForPixel(e.x); if (x != null) setSel(Math.min(S.days - 1, Math.max(0, Math.floor(x / 96)))); },
      },
      plugins: [{ id: 'dayLines', beforeDatasetsDraw(ch) {
        const { ctx, chartArea: a, scales: { x } } = ch; const s = selRef.current; ctx.save();
        for (let d = 0; d <= S.days; d++) { const px = x.getPixelForValue(d * 96); const on = d === s || d === s + 1; ctx.strokeStyle = on ? '#0f6b4f' : '#e1e0d9'; ctx.lineWidth = on ? 1.5 : 1; ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke(); }
        ctx.fillStyle = 'rgba(15,107,79,.05)'; const x0 = x.getPixelForValue(s * 96); ctx.fillRect(x0, a.top, x.getPixelForValue((s + 1) * 96) - x0, a.bottom - a.top); ctx.restore();
      } }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [R]);
  // key={sel} memaksa gambar ulang agar sorotan hari terpilih ikut berpindah
  return <ChartCanvas config={config} label="Grafik prakiraan daya PV dan beban" key={sel} />;
}

function DayDetail({ R, d, setSel, dayL }) {
  const { O, B, S, p } = R; const L = dayL(d); const a = d * 96, z = a + 96;
  const od = O.perDay[d], bd = B.perDay[d];
  const pct = (h) => (h / 24) * 100 + '%';
  const work = p.workDays.includes(L.dow);
  const pvMax = Math.max(1, ...S.pv.slice(a, z));
  const batchesOn = (Rr) => Rr.batches.filter((b) => b.day === d).map((b) => (b.s % 96) / 4);
  const WorkBand = () => (work ? <div className="work" style={{ left: pct(p.workStart), width: pct(p.workEnd - p.workStart) }} /> : null);
  const Heat = ({ Rr }) => Rr.trace.slice(a, z).map((t, i) => t.u > 0 ? <div key={i} className="g-seg" title={`${hhmm(i / 4)} · heater ${Math.round(t.u * 100)}% (${fmt(t.u * p.heaterP, 1)} kW)`} style={{ left: pct(i / 4), width: `calc(${pct(0.25)} + .5px)`, background: `rgba(42,120,214,${0.18 + 0.72 * t.u})` }} /> : null);
  const Press = ({ Rr }) => batchesOn(Rr).map((st, i) => (
    <span key={i}>
      <div className="g-blk" title={`Batch ${i + 1}: ${hhmm(st)}–${hhmm(st + p.pressSlots / 4)}`} style={{ left: pct(st), width: pct(p.pressSlots / 4) }}>{i + 1}</div>
      <div className="g-blk chg" style={{ left: pct(st + p.pressSlots / 4), width: pct(p.changeSlots / 4) }} />
    </span>
  ));
  const lab = useMemo(() => [...Array(96)].map((_, i) => hhmm(i / 4)), []);
  const tr = O.trace.slice(a, z);
  const enCfg = useMemo(() => ({
    type: 'bar',
    data: { labels: lab, datasets: [
      { type: 'line', label: 'Beban', data: tr.map((x) => x.load), borderColor: C.load, borderWidth: 1.5, pointRadius: 0, stepped: 'middle', order: 0 },
      { label: 'PLN', data: tr.map((x) => x.grid), backgroundColor: C.pln, stack: 's', order: 1 },
      { label: 'PV langsung', data: tr.map((x) => Math.max(0, x.load - x.grid - x.dis)), backgroundColor: C.pv, stack: 's', order: 1 },
      { label: 'Baterai', data: tr.map((x) => x.dis), backgroundColor: C.bat, stack: 's', order: 1 },
    ] },
    options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false }, barPercentage: 1, categoryPercentage: 0.92,
      plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y, 1)} kW`, afterBody: (it) => { const x = tr[it[0].dataIndex]; return [`SOC baterai: ${fmt(x.soc * 100)}%`, `PV tersedia: ${fmt(x.pv, 1)} kW`]; } } } },
      scales: { x: { stacked: true, grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, callback: (v, i) => (i % 12 === 0 ? lab[i] : null) } }, y: { stacked: true, beginAtZero: true, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: 'kW' } } } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [R, d]);
  const thCfg = useMemo(() => {
    const pressMask = tr.map((x) => x.press >= 0);
    return {
      type: 'line',
      data: { labels: lab, datasets: [
        { label: 'Optimal', data: tr.map((x) => x.th2), borderColor: C.temp, borderWidth: 2, pointRadius: 0, tension: 0.2 },
        { label: 'Konvensional', data: B.trace.slice(a, z).map((x) => x.th2), borderColor: '#9a9890', borderWidth: 1.5, borderDash: [5, 4], pointRadius: 0, tension: 0.2 },
      ] },
      options: { responsive: true, maintainAspectRatio: false, animation: false, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { display: false }, tooltip: { ...tooltipBase, callbacks: { label: (c) => ` ${c.dataset.label}: ${fmt(c.parsed.y, 1)} °C`, afterBody: (it) => (pressMask[it[0].dataIndex] ? ['● sedang menekan (optimal)'] : []) } } },
        scales: { x: { grid: { display: false }, ticks: { autoSkip: false, maxRotation: 0, callback: (v, i) => (i % 12 === 0 ? lab[i] : null) } }, y: { suggestedMin: 20, suggestedMax: 215, grid: { color: C.grid }, border: { display: false }, title: { display: true, text: '°C' } } } },
      plugins: [{ id: 'band', beforeDatasetsDraw(ch) {
        const { ctx, chartArea: ar, scales: { y, x } } = ch; ctx.save();
        ctx.fillStyle = 'rgba(19,144,106,.14)'; const t = y.getPixelForValue(p.thMaxPress), b = y.getPixelForValue(p.thMin); ctx.fillRect(ar.left, t, ar.right - ar.left, b - t);
        ctx.fillStyle = 'rgba(235,104,52,.25)'; const w = x.getPixelForValue(1) - x.getPixelForValue(0);
        pressMask.forEach((m, i) => { if (m) ctx.fillRect(x.getPixelForValue(i) - w / 2, ar.bottom - 5, w, 5); }); ctx.restore();
      } }],
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [R, d]);
  return (
    <>
      <section className="card">
        <div className="card-h">
          <div className="grow"><h2>Jadwal harian · {L.long}</h2><p className="sub">Timeline 24 jam: profil matahari, daya heater, dan batch press — optimal vs konvensional.</p></div>
          <div className="tabs">{O.perDay.map((_, i) => <button key={i} className={'btn sm' + (i === d ? ' primary' : '')} onClick={() => setSel(i)}>{dayL(i).short} {dayL(i).date.split(' ')[0]}</button>)}</div>
        </div>
        <div className="gantt">
          <div className="g-axis"><div /><div className="ticks">{[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => <span key={h} style={{ left: pct(h) }}>{String(h).padStart(2, '0')}.00</span>)}</div></div>
          <div className="g-row"><div className="rl">Matahari<small>{fmt(od.pvE)} kWh PV</small></div><div className="g-track"><WorkBand />{S.pv.slice(a, z).map((v, i) => v / pvMax > 0.01 ? <div key={i} className="g-sun" style={{ left: pct(i / 4), width: pct(0.25), top: `${(1 - v / pvMax) * 100}%` }} /> : null)}</div></div>
          <div style={{ margin: '8px 0 2px', fontSize: 11.5, fontWeight: 800, color: 'var(--brand)' }}>JADWAL OPTIMAL · PLN {fmt(od.gridE, 1)} kWh · {rp(od.cost)}</div>
          <div className="g-row"><div className="rl">Heater<small>{fmt(od.heatE)} kWh</small></div><div className="g-track"><WorkBand /><Heat Rr={O} /></div></div>
          <div className="g-row"><div className="rl">Press<small>{od.batches} batch</small></div><div className="g-track"><WorkBand /><Press Rr={O} /></div></div>
          <div style={{ margin: '10px 0 2px', fontSize: 11.5, fontWeight: 800, color: 'var(--ink-2)' }}>JADWAL KONVENSIONAL · PLN {fmt(bd.gridE, 1)} kWh · {rp(bd.cost)}</div>
          <div className="g-row"><div className="rl">Heater<small>{fmt(bd.heatE)} kWh</small></div><div className="g-track"><WorkBand /><Heat Rr={B} /></div></div>
          <div className="g-row"><div className="rl">Press<small>{bd.batches} batch</small></div><div className="g-track"><WorkBand /><Press Rr={B} /></div></div>
          <div className="legend" style={{ marginTop: 10 }}>
            <span><i className="sw" style={{ background: 'rgba(237,161,0,.5)' }} />Profil matahari</span>
            <span><i className="sw" style={{ background: 'rgba(42,120,214,.85)' }} />Heater (makin pekat = daya makin besar)</span>
            <span><i className="sw" style={{ background: 'var(--s-press)' }} />Menekan (nomor batch)</span>
            <span><i className="sw" style={{ background: '#f6c3ad' }} />Ganti cetakan</span>
            <span><i className="sw" style={{ background: 'rgba(15,107,79,.12)', border: '1px dashed rgba(15,107,79,.4)' }} />Jam kerja</span>
          </div>
        </div>
      </section>
      <section className="grid2">
        <div className="card">
          <h2>Sumber energi untuk beban</h2><p className="sub">Daya per 15 menit (kW) — jadwal optimal.</p>
          <div className="legend"><span><i className="sw" style={{ background: C.pln }} />PLN</span><span><i className="sw" style={{ background: C.pv }} />PV langsung</span><span><i className="sw" style={{ background: C.bat }} />Baterai</span><span><i className="sw line" style={{ background: C.load }} />Beban</span></div>
          <ChartCanvas config={enCfg} label="Grafik sumber energi" />
        </div>
        <div className="card">
          <h2>Suhu pelat press</h2><p className="sub">Area hijau = jendela kualitas; tanda oranye di bawah = slot menekan.</p>
          <div className="legend"><span><i className="sw line" style={{ background: C.temp }} />Optimal</span><span><i className="sw line" style={{ background: '#9a9890' }} />Konvensional</span><span><i className="sw" style={{ background: 'rgba(19,144,106,.16)' }} />Jendela kualitas</span></div>
          <ChartCanvas config={thCfg} label="Grafik suhu pelat" />
        </div>
      </section>
    </>
  );
}

function CompareTable({ R, dayL }) {
  const { O, B, p } = R; const o = O.total, b = B.total;
  return (
    <section className="card">
      <h2>Perbandingan per hari</h2>
      <p className="sub">Jadwal optimal vs konvensional (heater penuh mulai jam kerja, batch berurutan, termostat 195 °C).</p>
      <div style={{ overflowX: 'auto' }}>
        <table className="t">
          <thead><tr><th>Hari</th><th className="n">PV (kWh)</th><th className="n">Batch opt.</th><th className="n">Batch konv.</th><th className="n">PLN opt.</th><th className="n">PLN konv.</th><th className="n">Biaya opt.</th><th className="n">Biaya konv.</th><th className="n">Hemat</th><th className="n">CO₂ dihindari</th><th>Kualitas konv.</th></tr></thead>
          <tbody>
            {O.perDay.map((x, d) => {
              const y = B.perDay[d], L = dayL(d), work = p.workDays.includes(L.dow) || x.batches;
              return (
                <tr key={d}>
                  <td><b>{L.short}</b> <span style={{ color: 'var(--muted)' }}>{L.date}</span></td>
                  <td className="n">{fmt(x.pvE)}</td>
                  <td className="n">{work ? x.batches : <span className="pill off">libur</span>}</td>
                  <td className="n">{work ? y.batches : '—'}</td>
                  <td className="n">{fmt(x.gridE, 1)}</td><td className="n">{fmt(y.gridE, 1)}</td>
                  <td className="n">{rp(x.cost)}</td><td className="n">{rp(y.cost)}</td>
                  <td className="n"><b>{rp(y.cost - x.cost)}</b></td><td className="n">{fmt(y.co2 - x.co2, 1)}</td>
                  <td>{y.batches ? (y.violations ? <span className="pill bad">✕ {y.violations} slot &lt; {p.thMin} °C</span> : <span className="pill ok">✓ sesuai</span>) : '—'}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot><tr><td>Total</td><td className="n">{fmt(o.pvE)}</td><td className="n">{o.batches}</td><td className="n">{b.batches}</td><td className="n">{fmt(o.gridE, 1)}</td><td className="n">{fmt(b.gridE, 1)}</td><td className="n">{rp(o.cost)}</td><td className="n">{rp(b.cost)}</td><td className="n">{rp(b.cost - o.cost)}</td><td className="n">{fmt(b.co2 - o.co2, 1)}</td><td /></tr></tfoot>
        </table>
      </div>
    </section>
  );
}

function Operator({ R, dayL, showToast }) {
  const { O, p, S } = R;
  const data = useMemo(() => O.perDay.map((_, d) => {
    const tr = O.trace.slice(d * 96, d * 96 + 96);
    const first = tr.findIndex((t) => t.u > 0); let last = -1; tr.forEach((t, i) => { if (t.u > 0) last = i; });
    return { d, L: dayL(d), first: first >= 0 ? first / 4 : null, last: last >= 0 ? (last + 1) / 4 : null, batches: O.batches.filter((b) => b.day === d).map((b) => (b.s % 96) / 4) };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [R]);
  const copy = async () => {
    const rows = [['tanggal', 'hari', 'heater_on', 'heater_off', 'batch', 'masuk', 'keluar']];
    data.forEach((o) => {
      const dt = dateOf(S.startDateStr, o.d).toISOString().slice(0, 10);
      if (!o.batches.length) rows.push([dt, HARI_L[o.L.dow], o.first != null ? hhmm(o.first) : '', o.last != null ? hhmm(o.last) : '', 0, '', '']);
      o.batches.forEach((b, i) => rows.push([dt, HARI_L[o.L.dow], hhmm(o.first), hhmm(o.last), i + 1, hhmm(b), hhmm(b + p.pressSlots / 4)]));
    });
    const csv = rows.map((r) => r.join(',')).join('\n');
    try { await navigator.clipboard.writeText(csv); showToast('Jadwal disalin ke clipboard (CSV)'); } catch { showToast('Clipboard ditolak browser'); }
  };
  const download = () => {
    const rows = [['tanggal', 'hari', 'heater_on', 'heater_off', 'batch', 'masuk', 'keluar']];
    data.forEach((o) => { const dt = dateOf(S.startDateStr, o.d).toISOString().slice(0, 10); o.batches.forEach((b, i) => rows.push([dt, HARI_L[o.L.dow], hhmm(o.first), hhmm(o.last), i + 1, hhmm(b), hhmm(b + p.pressSlots / 4)])); });
    const blob = new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `jadwal-solarpress-${S.startDateStr}.csv`; a.click(); URL.revokeObjectURL(a.href);
  };
  return (
    <section className="card">
      <div className="card-h">
        <div className="grow"><h2>Instruksi untuk operator</h2><p className="sub">Jalankan ulang optimisasi setiap pagi dengan prakiraan terbaru (rolling horizon).</p></div>
        <button className="btn sm" onClick={copy}>📋 Salin CSV</button>
        <button className="btn sm" onClick={download}>⬇ Unduh CSV</button>
      </div>
      <div className="ops">
        {data.map((o) => (
          <div className="op" key={o.d}>
            <h4>{o.L.long}</h4>
            {!o.batches.length
              ? <div className="ph">Tidak ada produksi{o.first != null ? ` · heater otomatis ${hhmm(o.first)}–${hhmm(o.last)}` : ''}.</div>
              : <>
                <div className="ph">🔥 Nyalakan heater: <b>{o.first != null ? hhmm(o.first) : '—'}</b> · matikan: <b>{o.last != null ? hhmm(o.last) : '—'}</b></div>
                <ol>{o.batches.map((b, i) => <li key={i}>Batch {i + 1}: masuk <b>{hhmm(b)}</b>, keluar {hhmm(b + p.pressSlots / 4)}</li>)}</ol>
              </>}
          </div>
        ))}
      </div>
    </section>
  );
}

